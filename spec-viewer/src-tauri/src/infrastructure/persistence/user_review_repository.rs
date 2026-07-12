//! Filesystem-backed repository for single-document user reviews.

use std::{
    collections::{BTreeMap, BTreeSet},
    ffi::{OsStr, OsString},
    io::{self, Read, Write},
    path::{Component, Path, PathBuf},
    sync::{Arc, Mutex, MutexGuard},
    time::{Duration, SystemTime},
};

use cap_std::{
    ambient_authority,
    fs::{Dir, DirEntry, File, Metadata, OpenOptions, OpenOptionsExt},
};
use chrono::{DateTime, Utc};
use uuid::{Uuid, Variant, Version};

use crate::{
    domain::{
        spec::SpecId,
        user_review::{
            UserReview, UserReviewArchiveOutcome, UserReviewCreateOutcome, UserReviewId,
            UserReviewListOutcome, UserReviewRecordLocator, UserReviewRecordProblem,
            UserReviewRecordProblemKind, UserReviewRepository, UserReviewRepositoryError,
            UserReviewStatus, UserReviewTarget,
        },
        workspace::{WorkspaceConfig, WorkspaceLayout},
    },
    infrastructure::{
        filesystem::spec_directory_path,
        persistence::{
            user_review_document::{
                decode_user_review_document, encode_user_review_document,
                UserReviewRecordProblem as DocumentRecordProblem,
            },
            user_review_paths::{
                UserReviewCollection, ACTIVE_USER_REVIEW_DIRECTORY, ARCHIVE_USER_REVIEW_DIRECTORY,
                USER_REVIEW_DIRECTORY,
            },
        },
    },
};

const DEFAULT_TEMP_CLEANUP_AGE: Duration = Duration::from_secs(24 * 60 * 60);
const TEMP_FILE_CREATE_ATTEMPTS: usize = 3;
const TEMP_FILE_PREFIX: &str = ".user-review-";
const TEMP_FILE_SUFFIX: &str = ".tmp";
const CAPTURE_FILE_PREFIX: &str = ".user-review-capture-";
const CLEANUP_FILE_PREFIX: &str = ".user-review-cleanup-";

static USER_REVIEW_STORE_LOCK: Mutex<()> = Mutex::new(());

#[doc(hidden)]
pub trait ArchiveMutationObserver: Send + Sync {
    fn before_archive_publish(&self) {}
    fn after_archive_publish(&self) {}
    fn after_active_capture(&self) {}
    fn after_temp_cleanup_validation(&self) {}
    fn after_temp_cleanup_capture(&self) {}
}

#[derive(Debug)]
struct NoopArchiveMutationObserver;

impl ArchiveMutationObserver for NoopArchiveMutationObserver {}

#[derive(Clone)]
pub struct JsonUserReviewRepository {
    layout: WorkspaceLayout,
    config: WorkspaceConfig,
    temp_cleanup_age: Duration,
    archive_observer: Arc<dyn ArchiveMutationObserver>,
}

struct StoreDirectories {
    spec_id: SpecId,
    active: Option<Dir>,
    archive: Option<Dir>,
}

struct WritableStoreDirectories {
    spec_id: SpecId,
    active: Dir,
    archive: Dir,
}

impl JsonUserReviewRepository {
    pub fn new(layout: WorkspaceLayout, config: WorkspaceConfig) -> Self {
        Self::with_temp_cleanup_age(layout, config, DEFAULT_TEMP_CLEANUP_AGE)
    }

    pub fn with_temp_cleanup_age(
        layout: WorkspaceLayout,
        config: WorkspaceConfig,
        temp_cleanup_age: Duration,
    ) -> Self {
        Self::with_temp_cleanup_age_and_observer(
            layout,
            config,
            temp_cleanup_age,
            Arc::new(NoopArchiveMutationObserver),
        )
    }

    #[doc(hidden)]
    pub fn with_temp_cleanup_age_and_observer(
        layout: WorkspaceLayout,
        config: WorkspaceConfig,
        temp_cleanup_age: Duration,
        archive_observer: Arc<dyn ArchiveMutationObserver>,
    ) -> Self {
        Self {
            layout,
            config,
            temp_cleanup_age,
            archive_observer,
        }
    }

    #[doc(hidden)]
    pub fn with_archive_observer(
        layout: WorkspaceLayout,
        config: WorkspaceConfig,
        archive_observer: Arc<dyn ArchiveMutationObserver>,
    ) -> Self {
        Self::with_temp_cleanup_age_and_observer(
            layout,
            config,
            DEFAULT_TEMP_CLEANUP_AGE,
            archive_observer,
        )
    }

    fn spec_relative_path(&self, spec_id: &SpecId) -> Result<PathBuf, UserReviewRepositoryError> {
        let workspace_root = Path::new(self.layout.root().as_str());
        spec_directory_path(&self.layout, spec_id)
            .strip_prefix(workspace_root)
            .map(Path::to_path_buf)
            .map_err(|_| UserReviewRepositoryError::Unavailable)
    }

    fn open_spec_directory(&self, spec_id: &SpecId) -> Result<Dir, UserReviewRepositoryError> {
        let workspace = Dir::open_ambient_dir(self.layout.root().as_str(), ambient_authority())
            .map_err(|_| UserReviewRepositoryError::Unavailable)?;
        let relative_spec_path = self.spec_relative_path(spec_id)?;

        workspace
            .open_dir(relative_spec_path)
            .map_err(|_| UserReviewRepositoryError::Unavailable)
    }

    fn prepare_directories(
        &self,
        target: &UserReviewTarget,
    ) -> Result<WritableStoreDirectories, UserReviewRepositoryError> {
        let spec = self.open_spec_directory(target.spec_id())?;
        spec.create_dir_all(Path::new(USER_REVIEW_DIRECTORY).join(ACTIVE_USER_REVIEW_DIRECTORY))
            .map_err(|_| UserReviewRepositoryError::Unavailable)?;
        spec.create_dir_all(Path::new(USER_REVIEW_DIRECTORY).join(ARCHIVE_USER_REVIEW_DIRECTORY))
            .map_err(|_| UserReviewRepositoryError::Unavailable)?;

        let user_review = spec
            .open_dir(USER_REVIEW_DIRECTORY)
            .map_err(|_| UserReviewRepositoryError::Unavailable)?;
        let active = user_review
            .open_dir(ACTIVE_USER_REVIEW_DIRECTORY)
            .map_err(|_| UserReviewRepositoryError::Unavailable)?;
        let archive = user_review
            .open_dir(ARCHIVE_USER_REVIEW_DIRECTORY)
            .map_err(|_| UserReviewRepositoryError::Unavailable)?;

        sync_directory(&spec).map_err(|_| UserReviewRepositoryError::Unavailable)?;
        sync_directory(&user_review).map_err(|_| UserReviewRepositoryError::Unavailable)?;
        sync_directory(&active).map_err(|_| UserReviewRepositoryError::Unavailable)?;
        sync_directory(&archive).map_err(|_| UserReviewRepositoryError::Unavailable)?;

        Ok(WritableStoreDirectories {
            spec_id: target.spec_id().clone(),
            active,
            archive,
        })
    }

    fn existing_directories(
        &self,
        target: &UserReviewTarget,
    ) -> Result<StoreDirectories, UserReviewRepositoryError> {
        let spec = self.open_spec_directory(target.spec_id())?;
        let Some(user_review) = open_optional_directory(&spec, USER_REVIEW_DIRECTORY)? else {
            return Ok(StoreDirectories {
                spec_id: target.spec_id().clone(),
                active: None,
                archive: None,
            });
        };
        let active = open_optional_directory(&user_review, ACTIVE_USER_REVIEW_DIRECTORY)?;
        let archive = open_optional_directory(&user_review, ARCHIVE_USER_REVIEW_DIRECTORY)?;

        Ok(StoreDirectories {
            spec_id: target.spec_id().clone(),
            active,
            archive,
        })
    }

    fn cleanup_stale_temps(&self, spec_id: &SpecId, active: Option<&Dir>, archive: Option<&Dir>) {
        if let Some(active) = active {
            self.cleanup_collection_temps(spec_id, active, UserReviewCollection::Active);
        }
        if let Some(archive) = archive {
            self.cleanup_collection_temps(spec_id, archive, UserReviewCollection::Archive);
        }
    }

    fn cleanup_collection_temps(
        &self,
        spec_id: &SpecId,
        directory: &Dir,
        collection: UserReviewCollection,
    ) {
        let Ok(entries) = directory.entries() else {
            return;
        };

        for entry in entries.flatten() {
            let file_name = entry.file_name();
            let Some((id, _nonce)) = parse_owned_temp_name(&file_name) else {
                continue;
            };

            if !self.temp_is_cleanup_eligible(spec_id, directory, &file_name, &id, collection) {
                continue;
            }
            self.archive_observer.after_temp_cleanup_validation();
            let Ok(Some(capture_name)) =
                capture_cleanup_entry_no_replace(directory, &file_name, &id)
            else {
                continue;
            };
            self.archive_observer.after_temp_cleanup_capture();

            if self.temp_is_cleanup_eligible(spec_id, directory, &capture_name, &id, collection) {
                if directory.remove_file(&capture_name).is_ok() {
                    let _ = sync_directory(directory);
                }
                continue;
            }

            if rename_no_replace(directory, &capture_name, &file_name).is_ok() {
                let _ = sync_directory(directory);
            }
        }
    }

    fn temp_is_cleanup_eligible(
        &self,
        spec_id: &SpecId,
        directory: &Dir,
        file_name: &OsStr,
        id: &UserReviewId,
        collection: UserReviewCollection,
    ) -> bool {
        let Ok(mut file) = open_file_no_follow(directory, file_name) else {
            return false;
        };
        let Ok(metadata) = file.metadata() else {
            return false;
        };
        if !metadata.is_file() {
            return false;
        }
        let Some(age) = file_age(&metadata) else {
            return false;
        };
        if age < self.temp_cleanup_age {
            return false;
        }
        let mut contents = String::new();
        if file.read_to_string(&mut contents).is_err() {
            return false;
        }
        let Ok(review) = decode_user_review_document(&contents) else {
            return false;
        };

        review.id() == id
            && collection_matches_status(collection, review.status())
            && review.target().spec_id() == spec_id
            && self.source_paths_match(&review)
    }

    fn source_paths_match(&self, review: &UserReview) -> bool {
        let workspace_root = Path::new(self.layout.root().as_str());

        review.comments().iter().all(|comment| {
            let source = comment.source();
            let Some(mapping) = self.config.file_for_key(source.file_key()) else {
                return false;
            };
            let absolute =
                spec_directory_path(&self.layout, source.spec_id()).join(mapping.file_name());
            let Ok(relative) = absolute.strip_prefix(workspace_root) else {
                return false;
            };
            let Some(relative) = slash_separated_relative_path(relative) else {
                return false;
            };

            relative == source.file_path().as_str()
        })
    }

    fn scan_collection(
        &self,
        spec_id: &SpecId,
        directory: Option<&Dir>,
        collection: UserReviewCollection,
    ) -> Result<CollectionScan, UserReviewRepositoryError> {
        let Some(directory) = directory else {
            return Ok(CollectionScan::default());
        };

        let mut entries = directory
            .entries()
            .map_err(|_| UserReviewRepositoryError::Unavailable)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|_| UserReviewRepositoryError::Unavailable)?;
        entries.sort_by_key(|entry| entry.file_name());

        let mut scan = CollectionScan::default();
        for entry in entries {
            let file_name = entry.file_name();
            let locator = locator_from_name(&file_name)?;
            let file_type = entry
                .file_type()
                .map_err(|_| UserReviewRepositoryError::Unavailable)?;

            if file_type.is_dir() {
                scan.problems.push(UserReviewRecordProblem::new(
                    locator,
                    UserReviewRecordProblemKind::LegacyRecord,
                ));
                continue;
            }

            let display_file_name = file_name.to_string_lossy().into_owned();
            if display_file_name.ends_with(TEMP_FILE_SUFFIX) {
                continue;
            }
            if !file_type.is_file() || !display_file_name.ends_with(".json") {
                scan.problems.push(UserReviewRecordProblem::new(
                    locator,
                    UserReviewRecordProblemKind::MalformedRecord,
                ));
                continue;
            }

            let contents = match read_entry_to_string_no_follow(&entry) {
                Ok(contents) => contents,
                Err(_) => {
                    scan.problems.push(UserReviewRecordProblem::new(
                        locator,
                        UserReviewRecordProblemKind::MalformedRecord,
                    ));
                    continue;
                }
            };
            let review = match decode_user_review_document(&contents) {
                Ok(review) => review,
                Err(problem) => {
                    scan.problems.push(UserReviewRecordProblem::new(
                        locator,
                        document_problem_kind(problem),
                    ));
                    continue;
                }
            };
            let expected_name = format!("{}.json", review.id());
            if display_file_name != expected_name
                || !collection_matches_status(collection, review.status())
                || review.target().spec_id() != spec_id
                || !self.source_paths_match(&review)
            {
                scan.problems.push(UserReviewRecordProblem::new(
                    locator,
                    UserReviewRecordProblemKind::MalformedRecord,
                ));
                continue;
            }

            if let Some(existing) = scan.records.insert(
                review.id().clone(),
                LocatedReview {
                    review,
                    locator: locator.clone(),
                },
            ) {
                scan.records.remove(existing.review.id());
                scan.problems.push(UserReviewRecordProblem::new(
                    locator,
                    UserReviewRecordProblemKind::ConflictingCopies,
                ));
            }
        }

        Ok(scan)
    }

    fn load_mutation_record(
        &self,
        directory: &Dir,
        file_name: &OsStr,
        collection: UserReviewCollection,
        id: &UserReviewId,
        require_canonical_name: bool,
    ) -> Result<Option<UserReview>, UserReviewRepositoryError> {
        let mut file = match open_file_no_follow(directory, file_name) {
            Ok(file) => file,
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
            Err(_) => return Err(UserReviewRepositoryError::Unavailable),
        };
        let metadata = file
            .metadata()
            .map_err(|_| UserReviewRepositoryError::Unavailable)?;
        if !metadata.is_file() {
            return Err(UserReviewRepositoryError::Unavailable);
        }

        let mut contents = String::new();
        file.read_to_string(&mut contents)
            .map_err(|_| UserReviewRepositoryError::Unavailable)?;
        let review = decode_user_review_document(&contents)
            .map_err(|_| UserReviewRepositoryError::Unavailable)?;
        if review.id() != id
            || !collection_matches_status(collection, review.status())
            || (require_canonical_name && file_name != record_file_name(id))
            || !self.source_paths_match(&review)
        {
            return Err(UserReviewRepositoryError::Unavailable);
        }

        Ok(Some(review))
    }

    fn targeted_legacy_exists(
        &self,
        active: &Dir,
        archive: &Dir,
        id: &UserReviewId,
    ) -> Result<bool, UserReviewRepositoryError> {
        Ok(entry_is_directory(active, OsStr::new(id.as_str()))?
            || entry_is_directory(archive, OsStr::new(id.as_str()))?)
    }

    fn capture_active_after_archive(
        &self,
        active_directory: &Dir,
        id: &UserReviewId,
        expected_active: &UserReview,
    ) -> Result<(), UserReviewRepositoryError> {
        let record_name = record_file_name(id);
        let Some(capture_name) = capture_entry_no_replace(active_directory, &record_name, id)?
        else {
            return Ok(());
        };
        self.archive_observer.after_active_capture();

        let captured_matches = match self.load_mutation_record(
            active_directory,
            &capture_name,
            UserReviewCollection::Active,
            id,
            false,
        ) {
            Ok(Some(captured)) => captured == *expected_active,
            Ok(None) | Err(_) => false,
        };

        if captured_matches {
            active_directory
                .remove_file(&capture_name)
                .map_err(|_| UserReviewRepositoryError::Unavailable)?;
            sync_directory(active_directory).map_err(|_| UserReviewRepositoryError::Unavailable)?;
            return Ok(());
        }

        match rename_no_replace(active_directory, &capture_name, &record_name) {
            Ok(()) => {
                sync_directory(active_directory)
                    .map_err(|_| UserReviewRepositoryError::Unavailable)?;
                Err(UserReviewRepositoryError::ConflictingCopies { id: id.clone() })
            }
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {
                Err(UserReviewRepositoryError::ConflictingCopies { id: id.clone() })
            }
            Err(_) => Err(UserReviewRepositoryError::Unavailable),
        }
    }
}

impl UserReviewRepository for JsonUserReviewRepository {
    fn create(
        &self,
        review: UserReview,
    ) -> Result<UserReviewCreateOutcome, UserReviewRepositoryError> {
        ensure_supported_platform()?;
        let _guard = lock_user_review_store()?;
        if review.status() != UserReviewStatus::Active || !self.source_paths_match(&review) {
            return Err(UserReviewRepositoryError::InvalidState {
                id: review.id().clone(),
            });
        }

        let directories = self.prepare_directories(review.target())?;
        self.cleanup_stale_temps(
            &directories.spec_id,
            Some(&directories.active),
            Some(&directories.archive),
        );

        if self.targeted_legacy_exists(&directories.active, &directories.archive, review.id())? {
            return Err(UserReviewRepositoryError::LegacyRecord {
                id: review.id().clone(),
            });
        }

        let record_name = record_file_name(review.id());
        if entry_exists(&directories.active, &record_name)?
            || entry_exists(&directories.archive, &record_name)?
        {
            return Err(UserReviewRepositoryError::AlreadyExists {
                id: review.id().clone(),
            });
        }

        let contents = encode_user_review_document(&review)
            .map_err(|_| UserReviewRepositoryError::Unavailable)?;
        match publish_no_replace(&directories.active, &record_name, review.id(), &contents)? {
            PublishOutcome::Published => Ok(UserReviewCreateOutcome::new(review)),
            PublishOutcome::AlreadyExists => Err(UserReviewRepositoryError::AlreadyExists {
                id: review.id().clone(),
            }),
        }
    }

    fn list(
        &self,
        target: &UserReviewTarget,
    ) -> Result<UserReviewListOutcome, UserReviewRepositoryError> {
        ensure_supported_platform()?;
        let _guard = lock_user_review_store()?;
        let directories = self.existing_directories(target)?;
        self.cleanup_stale_temps(
            &directories.spec_id,
            directories.active.as_ref(),
            directories.archive.as_ref(),
        );

        let mut active_scan = self.scan_collection(
            &directories.spec_id,
            directories.active.as_ref(),
            UserReviewCollection::Active,
        )?;
        let mut archive_scan = self.scan_collection(
            &directories.spec_id,
            directories.archive.as_ref(),
            UserReviewCollection::Archive,
        )?;
        let mut problems = Vec::new();
        problems.append(&mut active_scan.problems);
        problems.append(&mut archive_scan.problems);

        let ids = active_scan
            .records
            .keys()
            .chain(archive_scan.records.keys())
            .cloned()
            .collect::<BTreeSet<_>>();
        let mut active = Vec::new();
        let mut archived = Vec::new();

        for id in ids {
            match (
                active_scan.records.remove(&id),
                archive_scan.records.remove(&id),
            ) {
                (Some(active_record), Some(archive_record)) => {
                    if is_recoverable_duplicate(&active_record.review, &archive_record.review) {
                        if archive_record.review.target() == target {
                            archived.push(archive_record.review);
                        }
                        problems.push(UserReviewRecordProblem::new(
                            archive_record.locator,
                            UserReviewRecordProblemKind::RecoverableDuplicate,
                        ));
                    } else {
                        problems.push(UserReviewRecordProblem::new(
                            archive_record.locator,
                            UserReviewRecordProblemKind::ConflictingCopies,
                        ));
                    }
                }
                (Some(record), None) => {
                    if record.review.target() == target {
                        active.push(record.review);
                    }
                }
                (None, Some(record)) => {
                    if record.review.target() == target {
                        archived.push(record.review);
                    }
                }
                (None, None) => {}
            }
        }

        Ok(UserReviewListOutcome::new(active, archived, problems))
    }

    fn archive(
        &self,
        id: &UserReviewId,
        target: &UserReviewTarget,
        archived_at: DateTime<Utc>,
    ) -> Result<UserReviewArchiveOutcome, UserReviewRepositoryError> {
        ensure_supported_platform()?;
        let _guard = lock_user_review_store()?;
        let directories = self.prepare_directories(target)?;
        self.cleanup_stale_temps(
            &directories.spec_id,
            Some(&directories.active),
            Some(&directories.archive),
        );

        if self.targeted_legacy_exists(&directories.active, &directories.archive, id)? {
            return Err(UserReviewRepositoryError::LegacyRecord { id: id.clone() });
        }

        let record_name = record_file_name(id);
        let active = self.load_mutation_record(
            &directories.active,
            &record_name,
            UserReviewCollection::Active,
            id,
            true,
        )?;
        let archived = self.load_mutation_record(
            &directories.archive,
            &record_name,
            UserReviewCollection::Archive,
            id,
            true,
        )?;

        match (active, archived) {
            (None, None) => Err(UserReviewRepositoryError::NotFound { id: id.clone() }),
            (None, Some(archived)) => {
                ensure_target_matches(&archived, target)?;
                Ok(UserReviewArchiveOutcome::new(archived, Vec::new()))
            }
            (Some(active), Some(archived)) => {
                if !is_recoverable_duplicate(&active, &archived) {
                    return Err(UserReviewRepositoryError::ConflictingCopies { id: id.clone() });
                }
                ensure_target_matches(&archived, target)?;
                self.capture_active_after_archive(&directories.active, id, &active)?;
                let problem = duplicate_problem(id)?;

                Ok(UserReviewArchiveOutcome::new(archived, vec![problem]))
            }
            (Some(original_active), None) => {
                ensure_target_matches(&original_active, target)?;
                let mut desired_archive = original_active.clone();
                desired_archive
                    .archive(id, target, archived_at)
                    .map_err(|_| UserReviewRepositoryError::InvalidState { id: id.clone() })?;
                let contents = encode_user_review_document(&desired_archive)
                    .map_err(|_| UserReviewRepositoryError::Unavailable)?;

                self.archive_observer.before_archive_publish();
                let (persisted_archive, problems) =
                    match publish_no_replace(&directories.archive, &record_name, id, &contents)? {
                        PublishOutcome::Published => (desired_archive, Vec::new()),
                        PublishOutcome::AlreadyExists => {
                            let persisted = self
                                .load_mutation_record(
                                    &directories.archive,
                                    &record_name,
                                    UserReviewCollection::Archive,
                                    id,
                                    true,
                                )?
                                .ok_or(UserReviewRepositoryError::Unavailable)?;
                            if !is_recoverable_duplicate(&original_active, &persisted) {
                                return Err(UserReviewRepositoryError::ConflictingCopies {
                                    id: id.clone(),
                                });
                            }
                            (persisted, vec![duplicate_problem(id)?])
                        }
                    };
                self.archive_observer.after_archive_publish();
                self.capture_active_after_archive(&directories.active, id, &original_active)?;

                Ok(UserReviewArchiveOutcome::new(persisted_archive, problems))
            }
        }
    }
}

#[derive(Debug)]
struct LocatedReview {
    review: UserReview,
    locator: UserReviewRecordLocator,
}

#[derive(Debug, Default)]
struct CollectionScan {
    records: BTreeMap<UserReviewId, LocatedReview>,
    problems: Vec<UserReviewRecordProblem>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PublishOutcome {
    Published,
    AlreadyExists,
}

fn publish_no_replace(
    directory: &Dir,
    destination: &OsStr,
    id: &UserReviewId,
    contents: &str,
) -> Result<PublishOutcome, UserReviewRepositoryError> {
    let (mut temp_file, temp_name) = create_temp_file(directory, id)?;
    if temp_file.write_all(contents.as_bytes()).is_err()
        || temp_file.flush().is_err()
        || temp_file.sync_all().is_err()
    {
        return Err(UserReviewRepositoryError::Unavailable);
    }
    drop(temp_file);

    match rename_no_replace(directory, &temp_name, destination) {
        Ok(()) => {}
        Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {
            return Ok(PublishOutcome::AlreadyExists);
        }
        Err(_) => return Err(UserReviewRepositoryError::Unavailable),
    }

    sync_directory(directory).map_err(|_| UserReviewRepositoryError::Unavailable)?;

    Ok(PublishOutcome::Published)
}

fn create_temp_file(
    directory: &Dir,
    id: &UserReviewId,
) -> Result<(File, OsString), UserReviewRepositoryError> {
    for _ in 0..TEMP_FILE_CREATE_ATTEMPTS {
        let name = OsString::from(temp_file_name(id, Uuid::new_v4()));
        let options = create_new_file_options();
        match directory.open_with(&name, &options) {
            Ok(file) => return Ok((file, name)),
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(_) => return Err(UserReviewRepositoryError::Unavailable),
        }
    }

    Err(UserReviewRepositoryError::Unavailable)
}

fn temp_file_name(id: &UserReviewId, nonce: Uuid) -> String {
    format!(
        "{TEMP_FILE_PREFIX}{id}-{}{TEMP_FILE_SUFFIX}",
        nonce.simple()
    )
}

fn parse_owned_temp_name(name: &OsStr) -> Option<(UserReviewId, Uuid)> {
    let name = name.to_str()?;
    let body = name
        .strip_prefix(TEMP_FILE_PREFIX)?
        .strip_suffix(TEMP_FILE_SUFFIX)?;
    let (id, nonce) = body.rsplit_once('-')?;
    let id = UserReviewId::new(id).ok()?;
    if nonce.len() != 32
        || !nonce
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    {
        return None;
    }
    let nonce = Uuid::parse_str(nonce).ok()?;
    if nonce.get_version() != Some(Version::Random) || nonce.get_variant() != Variant::RFC4122 {
        return None;
    }

    Some((id, nonce))
}

fn file_age(metadata: &Metadata) -> Option<Duration> {
    SystemTime::now()
        .duration_since(metadata.modified().ok()?.into_std())
        .ok()
}

fn collection_matches_status(collection: UserReviewCollection, status: UserReviewStatus) -> bool {
    matches!(
        (collection, status),
        (UserReviewCollection::Active, UserReviewStatus::Active)
            | (UserReviewCollection::Archive, UserReviewStatus::Archived)
    )
}

fn is_recoverable_duplicate(active: &UserReview, archived: &UserReview) -> bool {
    let Some(archived_at) = archived.archived_at() else {
        return false;
    };
    let mut expected = active.clone();
    let id = expected.id().clone();
    let target = expected.target().clone();

    expected.archive(&id, &target, archived_at).is_ok() && &expected == archived
}

fn ensure_target_matches(
    review: &UserReview,
    target: &UserReviewTarget,
) -> Result<(), UserReviewRepositoryError> {
    if review.target() != target {
        return Err(UserReviewRepositoryError::TargetMismatch {
            id: review.id().clone(),
        });
    }

    Ok(())
}

fn duplicate_problem(
    id: &UserReviewId,
) -> Result<UserReviewRecordProblem, UserReviewRepositoryError> {
    let locator = UserReviewRecordLocator::new(format!("{id}.json"))
        .map_err(|_| UserReviewRepositoryError::Unavailable)?;
    Ok(UserReviewRecordProblem::new(
        locator,
        UserReviewRecordProblemKind::RecoverableDuplicate,
    ))
}

fn document_problem_kind(problem: DocumentRecordProblem) -> UserReviewRecordProblemKind {
    match problem {
        DocumentRecordProblem::LegacyRecord => UserReviewRecordProblemKind::LegacyRecord,
        DocumentRecordProblem::UnsupportedRecordVersion { .. } => {
            UserReviewRecordProblemKind::UnsupportedRecordVersion
        }
        DocumentRecordProblem::MalformedRecord { .. } => {
            UserReviewRecordProblemKind::MalformedRecord
        }
    }
}

fn locator_from_name(name: &OsStr) -> Result<UserReviewRecordLocator, UserReviewRepositoryError> {
    let display_name = name.to_string_lossy();
    let sanitized = display_name
        .chars()
        .map(|character| {
            if character.is_control() || matches!(character, '/' | '\\') {
                '\u{fffd}'
            } else {
                character
            }
        })
        .collect::<String>();
    let sanitized = if sanitized.trim().is_empty() {
        "unreadable-record".to_string()
    } else {
        sanitized
    };

    UserReviewRecordLocator::new(sanitized).map_err(|_| UserReviewRepositoryError::Unavailable)
}

fn slash_separated_relative_path(path: &Path) -> Option<String> {
    let mut segments = Vec::new();
    for component in path.components() {
        match component {
            Component::Normal(segment) => segments.push(segment.to_str()?.to_string()),
            _ => return None,
        }
    }

    if segments.is_empty() {
        return None;
    }

    Some(segments.join("/"))
}

fn record_file_name(id: &UserReviewId) -> OsString {
    OsString::from(format!("{id}.json"))
}

fn capture_file_name(id: &UserReviewId, nonce: Uuid) -> OsString {
    OsString::from(format!(
        "{CAPTURE_FILE_PREFIX}{id}-{}{TEMP_FILE_SUFFIX}",
        nonce.simple()
    ))
}

fn capture_entry_no_replace(
    directory: &Dir,
    source: &OsStr,
    id: &UserReviewId,
) -> Result<Option<OsString>, UserReviewRepositoryError> {
    for _ in 0..TEMP_FILE_CREATE_ATTEMPTS {
        let capture = capture_file_name(id, Uuid::new_v4());
        match rename_no_replace(directory, source, &capture) {
            Ok(()) => {
                sync_directory(directory).map_err(|_| UserReviewRepositoryError::Unavailable)?;
                return Ok(Some(capture));
            }
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(_) => return Err(UserReviewRepositoryError::Unavailable),
        }
    }

    Err(UserReviewRepositoryError::Unavailable)
}

fn cleanup_capture_file_name(id: &UserReviewId, nonce: Uuid) -> OsString {
    OsString::from(format!(
        "{CLEANUP_FILE_PREFIX}{id}-{}{TEMP_FILE_SUFFIX}",
        nonce.simple()
    ))
}

fn capture_cleanup_entry_no_replace(
    directory: &Dir,
    source: &OsStr,
    id: &UserReviewId,
) -> io::Result<Option<OsString>> {
    for _ in 0..TEMP_FILE_CREATE_ATTEMPTS {
        let capture_name = cleanup_capture_file_name(id, Uuid::new_v4());
        match rename_no_replace(directory, source, &capture_name) {
            Ok(()) => {
                sync_directory(directory)?;
                return Ok(Some(capture_name));
            }
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error),
        }
    }

    Err(io::Error::new(
        io::ErrorKind::AlreadyExists,
        "could not reserve a cleanup capture name",
    ))
}

fn entry_exists(directory: &Dir, name: &OsStr) -> Result<bool, UserReviewRepositoryError> {
    match directory.symlink_metadata(name) {
        Ok(_) => Ok(true),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(_) => Err(UserReviewRepositoryError::Unavailable),
    }
}

fn entry_is_directory(directory: &Dir, name: &OsStr) -> Result<bool, UserReviewRepositoryError> {
    match directory.symlink_metadata(name) {
        Ok(metadata) => Ok(metadata.is_dir()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(_) => Err(UserReviewRepositoryError::Unavailable),
    }
}

fn open_optional_directory(
    parent: &Dir,
    name: &str,
) -> Result<Option<Dir>, UserReviewRepositoryError> {
    match parent.open_dir(name) {
        Ok(directory) => Ok(Some(directory)),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(_) => Err(UserReviewRepositoryError::Unavailable),
    }
}

fn open_entry_no_follow(entry: &DirEntry) -> io::Result<(File, Metadata)> {
    let options = read_only_file_options();
    let file = entry.open_with(&options)?;
    let metadata = file.metadata()?;
    Ok((file, metadata))
}

fn read_entry_to_string_no_follow(entry: &DirEntry) -> io::Result<String> {
    let (mut file, metadata) = open_entry_no_follow(entry)?;
    if !metadata.is_file() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "user review record is not a regular file",
        ));
    }
    let mut contents = String::new();
    file.read_to_string(&mut contents)?;
    Ok(contents)
}

fn open_file_no_follow(directory: &Dir, name: &OsStr) -> io::Result<File> {
    directory.open_with(name, &read_only_file_options())
}

fn read_only_file_options() -> OpenOptions {
    let mut options = OpenOptions::new();
    options.read(true);
    configure_no_follow(&mut options);
    options
}

fn create_new_file_options() -> OpenOptions {
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    configure_no_follow(&mut options);
    options
}

// Keep unsupported fallbacks type-checked on supported development platforms.
#[allow(dead_code)]
mod unsupported_platform {
    use super::{io, Dir, OpenOptions, OsStr};

    pub(super) fn configure_no_follow(_options: &mut OpenOptions) {
        // Repository entry points reject platforms without no-follow filesystem APIs.
    }

    pub(super) fn rename_no_replace(
        _directory: &Dir,
        _from: &OsStr,
        _to: &OsStr,
    ) -> io::Result<()> {
        Err(io::Error::new(
            io::ErrorKind::Unsupported,
            "atomic no-replace rename is unavailable on this platform",
        ))
    }

    pub(super) fn sync_directory(_directory: &Dir) -> io::Result<()> {
        Err(io::Error::from(io::ErrorKind::Unsupported))
    }
}

#[cfg(not(any(unix, windows)))]
use unsupported_platform::{configure_no_follow, rename_no_replace, sync_directory};

#[cfg(unix)]
fn configure_no_follow(options: &mut OpenOptions) {
    options.custom_flags(rustix::fs::OFlags::NOFOLLOW.bits() as i32);
}

#[cfg(windows)]
fn configure_no_follow(options: &mut OpenOptions) {
    use windows_sys::Win32::Storage::FileSystem::FILE_FLAG_OPEN_REPARSE_POINT;

    options.custom_flags(FILE_FLAG_OPEN_REPARSE_POINT);
}

#[cfg(any(
    target_os = "linux",
    target_os = "android",
    target_vendor = "apple",
    target_os = "redox"
))]
fn rename_no_replace(directory: &Dir, from: &OsStr, to: &OsStr) -> io::Result<()> {
    Ok(rustix::fs::renameat_with(
        directory,
        from,
        directory,
        to,
        rustix::fs::RenameFlags::NOREPLACE,
    )?)
}

#[cfg(all(
    unix,
    not(any(
        target_os = "linux",
        target_os = "android",
        target_vendor = "apple",
        target_os = "redox"
    ))
))]
fn rename_no_replace(_directory: &Dir, _from: &OsStr, _to: &OsStr) -> io::Result<()> {
    Err(io::Error::new(
        io::ErrorKind::Unsupported,
        "atomic no-replace rename is unavailable on this platform",
    ))
}

#[cfg(windows)]
fn rename_no_replace(directory: &Dir, from: &OsStr, to: &OsStr) -> io::Result<()> {
    use std::{
        mem::size_of,
        os::windows::{ffi::OsStrExt, io::AsRawHandle},
    };
    use windows_sys::{
        Wdk::Storage::FileSystem::{
            FileRenameInformation, NtSetInformationFile, FILE_INFORMATION_CLASS,
        },
        Win32::{
            Foundation::{RtlNtStatusToDosError, HANDLE},
            Storage::FileSystem::{
                DELETE, FILE_FLAG_OPEN_REPARSE_POINT, FILE_SHARE_DELETE, FILE_SHARE_READ,
                FILE_SHARE_WRITE,
            },
            System::IO::IO_STATUS_BLOCK,
        },
    };

    const MAX_RENAME_UNITS: usize = 255;

    #[repr(C)]
    struct RenameInformation {
        replace_if_exists: u32,
        root_directory: HANDLE,
        file_name_length: u32,
        file_name: [u16; MAX_RENAME_UNITS],
    }

    let wide_name = to.encode_wide().collect::<Vec<_>>();
    if wide_name.len() > MAX_RENAME_UNITS {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "user review record name is too long",
        ));
    }

    let mut options = OpenOptions::new();
    options
        .access_mode(DELETE)
        .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE)
        .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT);
    let file = directory.open_with(from, &options)?;
    let mut information = RenameInformation {
        replace_if_exists: 0,
        root_directory: directory.as_raw_handle() as HANDLE,
        file_name_length: u32::try_from(wide_name.len() * size_of::<u16>())
            .map_err(|_| io::Error::from(io::ErrorKind::InvalidInput))?,
        file_name: [0; MAX_RENAME_UNITS],
    };
    information.file_name[..wide_name.len()].copy_from_slice(&wide_name);

    let mut status_block = IO_STATUS_BLOCK::default();
    // NtSetInformationFile is synchronous for this handle and supports a held
    // RootDirectory, so neither side is resolved through a replaceable parent path.
    let status = unsafe {
        NtSetInformationFile(
            file.as_raw_handle() as HANDLE,
            &raw mut status_block,
            (&raw const information).cast(),
            u32::try_from(size_of::<RenameInformation>())
                .map_err(|_| io::Error::from(io::ErrorKind::InvalidInput))?,
            FileRenameInformation as FILE_INFORMATION_CLASS,
        )
    };
    if status < 0 {
        let error_code = unsafe { RtlNtStatusToDosError(status) };
        return Err(io::Error::from_raw_os_error(error_code as i32));
    }

    Ok(())
}

fn platform_support_result(supported: bool) -> Result<(), UserReviewRepositoryError> {
    if !supported {
        return Err(UserReviewRepositoryError::Unavailable);
    }

    Ok(())
}

fn ensure_supported_platform() -> Result<(), UserReviewRepositoryError> {
    platform_support_result(cfg!(any(unix, windows)))
}

fn lock_user_review_store() -> Result<MutexGuard<'static, ()>, UserReviewRepositoryError> {
    USER_REVIEW_STORE_LOCK
        .lock()
        .map_err(|_| UserReviewRepositoryError::Unavailable)
}

#[cfg(unix)]
fn sync_directory(directory: &Dir) -> io::Result<()> {
    directory.open(".")?.sync_all()
}

#[cfg(windows)]
fn sync_directory(_directory: &Dir) -> io::Result<()> {
    // Windows has no directory fsync equivalent. Record contents are flushed
    // before the atomic rename, and NTFS journals the namespace transition.
    Ok(())
}

#[cfg(test)]
mod platform_contract_tests {
    use super::*;

    #[test]
    fn unsupported_platform_contract_is_complete_and_fails_closed() {
        assert_eq!(
            Err(UserReviewRepositoryError::Unavailable),
            platform_support_result(false)
        );
        assert_eq!(Ok(()), platform_support_result(true));

        let mut options = OpenOptions::new();
        unsupported_platform::configure_no_follow(&mut options);
        let _rename: fn(&Dir, &OsStr, &OsStr) -> io::Result<()> =
            unsupported_platform::rename_no_replace;
        let _sync: fn(&Dir) -> io::Result<()> = unsupported_platform::sync_directory;
    }
}
