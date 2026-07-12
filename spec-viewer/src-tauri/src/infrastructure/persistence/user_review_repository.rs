//! Filesystem-backed repository for single-document user reviews.

use std::{
    collections::{BTreeMap, BTreeSet},
    ffi::OsStr,
    fs::{self, File, OpenOptions},
    io::{self, Write},
    path::{Component, Path, PathBuf},
    sync::{Mutex, MutexGuard},
    time::{Duration, SystemTime},
};

use chrono::{DateTime, Utc};
use uuid::{Uuid, Variant, Version};

use crate::{
    domain::{
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
                UserReviewCollection, UserReviewPathResolver, UserReviewStoragePaths,
            },
        },
    },
};

const DEFAULT_TEMP_CLEANUP_AGE: Duration = Duration::from_secs(24 * 60 * 60);
const TEMP_FILE_CREATE_ATTEMPTS: usize = 3;
const TEMP_FILE_PREFIX: &str = ".user-review-";
const TEMP_FILE_SUFFIX: &str = ".tmp";

static USER_REVIEW_STORE_LOCK: Mutex<()> = Mutex::new(());

#[derive(Debug, Clone)]
pub struct JsonUserReviewRepository {
    layout: WorkspaceLayout,
    config: WorkspaceConfig,
    path_resolver: UserReviewPathResolver,
    temp_cleanup_age: Duration,
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
        Self {
            layout,
            config,
            path_resolver: UserReviewPathResolver::new(),
            temp_cleanup_age,
        }
    }

    fn resolve_paths(&self, target: &UserReviewTarget) -> UserReviewStoragePaths {
        self.path_resolver.resolve(&self.layout, target.spec_id())
    }

    fn prepare_directories(
        &self,
        paths: &UserReviewStoragePaths,
    ) -> Result<(), UserReviewRepositoryError> {
        self.validate_spec_directory(paths)?;
        if !paths.has_lexical_containment() {
            return Err(UserReviewRepositoryError::Unavailable);
        }

        ensure_not_symlink(paths.user_review_directory())?;
        ensure_not_symlink(paths.active_directory())?;
        ensure_not_symlink(paths.archive_directory())?;

        fs::create_dir_all(paths.active_directory())
            .map_err(|_| UserReviewRepositoryError::Unavailable)?;
        fs::create_dir_all(paths.archive_directory())
            .map_err(|_| UserReviewRepositoryError::Unavailable)?;

        ensure_directory(paths.user_review_directory())?;
        ensure_directory(paths.active_directory())?;
        ensure_directory(paths.archive_directory())?;

        sync_directory(paths.spec_directory())
            .map_err(|_| UserReviewRepositoryError::Unavailable)?;
        sync_directory(paths.user_review_directory())
            .map_err(|_| UserReviewRepositoryError::Unavailable)?;
        sync_directory(paths.active_directory())
            .map_err(|_| UserReviewRepositoryError::Unavailable)?;
        sync_directory(paths.archive_directory())
            .map_err(|_| UserReviewRepositoryError::Unavailable)
    }

    fn validate_existing_paths(
        &self,
        paths: &UserReviewStoragePaths,
    ) -> Result<(), UserReviewRepositoryError> {
        self.validate_spec_directory(paths)?;
        if !paths.has_lexical_containment() {
            return Err(UserReviewRepositoryError::Unavailable);
        }

        ensure_not_symlink(paths.user_review_directory())?;
        ensure_not_symlink(paths.active_directory())?;
        ensure_not_symlink(paths.archive_directory())
    }

    fn validate_spec_directory(
        &self,
        paths: &UserReviewStoragePaths,
    ) -> Result<(), UserReviewRepositoryError> {
        let canonical_root = fs::canonicalize(self.layout.root().as_str())
            .map_err(|_| UserReviewRepositoryError::Unavailable)?;
        let canonical_spec = fs::canonicalize(paths.spec_directory())
            .map_err(|_| UserReviewRepositoryError::Unavailable)?;

        if !canonical_spec.starts_with(canonical_root) || !canonical_spec.is_dir() {
            return Err(UserReviewRepositoryError::Unavailable);
        }

        Ok(())
    }

    fn cleanup_stale_temps(&self, paths: &UserReviewStoragePaths) {
        self.cleanup_collection_temps(paths, UserReviewCollection::Active);
        self.cleanup_collection_temps(paths, UserReviewCollection::Archive);
    }

    fn cleanup_collection_temps(
        &self,
        paths: &UserReviewStoragePaths,
        collection: UserReviewCollection,
    ) {
        let directory = paths.collection_directory(collection);
        let Ok(entries) = fs::read_dir(directory) else {
            return;
        };

        for entry in entries.flatten() {
            let Some((id, _nonce)) = parse_owned_temp_name(&entry.file_name()) else {
                continue;
            };
            let Ok(metadata) = fs::symlink_metadata(entry.path()) else {
                continue;
            };
            if !metadata.file_type().is_file() || metadata.file_type().is_symlink() {
                continue;
            }
            let Some(age) = file_age(&metadata) else {
                continue;
            };
            if age < self.temp_cleanup_age {
                continue;
            }
            let Ok(contents) = fs::read_to_string(entry.path()) else {
                continue;
            };
            let Ok(review) = decode_user_review_document(&contents) else {
                continue;
            };
            if review.id() != &id
                || !collection_matches_status(collection, review.status())
                || review.target().spec_id() != paths.spec_id()
                || !self.source_paths_match(&review)
            {
                continue;
            }

            if fs::remove_file(entry.path()).is_ok() {
                let _ = sync_directory(directory);
            }
        }
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
        paths: &UserReviewStoragePaths,
        collection: UserReviewCollection,
    ) -> Result<CollectionScan, UserReviewRepositoryError> {
        let directory = paths.collection_directory(collection);
        if !directory.exists() {
            return Ok(CollectionScan::default());
        }
        ensure_directory(directory)?;

        let entries =
            fs::read_dir(directory).map_err(|_| UserReviewRepositoryError::Unavailable)?;
        let mut entries = entries
            .collect::<Result<Vec<_>, _>>()
            .map_err(|_| UserReviewRepositoryError::Unavailable)?;
        entries.sort_by_key(|entry| entry.file_name());

        let mut scan = CollectionScan::default();
        for entry in entries {
            let locator = locator_from_name(&entry.file_name())?;
            let metadata = match fs::symlink_metadata(entry.path()) {
                Ok(metadata) => metadata,
                Err(_) => {
                    scan.problems.push(UserReviewRecordProblem::new(
                        locator,
                        UserReviewRecordProblemKind::MalformedRecord,
                    ));
                    continue;
                }
            };

            if metadata.file_type().is_dir() {
                scan.problems.push(UserReviewRecordProblem::new(
                    locator,
                    UserReviewRecordProblemKind::LegacyRecord,
                ));
                continue;
            }

            let file_name = entry.file_name().to_string_lossy().into_owned();
            if file_name.ends_with(TEMP_FILE_SUFFIX) {
                continue;
            }
            if !metadata.file_type().is_file()
                || metadata.file_type().is_symlink()
                || !file_name.ends_with(".json")
            {
                scan.problems.push(UserReviewRecordProblem::new(
                    locator,
                    UserReviewRecordProblemKind::MalformedRecord,
                ));
                continue;
            }

            let contents = match fs::read_to_string(entry.path()) {
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
            if file_name != expected_name
                || !collection_matches_status(collection, review.status())
                || review.target().spec_id() != paths.spec_id()
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
        path: &Path,
        collection: UserReviewCollection,
        id: &UserReviewId,
    ) -> Result<Option<UserReview>, UserReviewRepositoryError> {
        let metadata = match fs::symlink_metadata(path) {
            Ok(metadata) => metadata,
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
            Err(_) => return Err(UserReviewRepositoryError::Unavailable),
        };
        if !metadata.file_type().is_file() || metadata.file_type().is_symlink() {
            return Err(UserReviewRepositoryError::Unavailable);
        }

        let contents =
            fs::read_to_string(path).map_err(|_| UserReviewRepositoryError::Unavailable)?;
        let review = decode_user_review_document(&contents)
            .map_err(|_| UserReviewRepositoryError::Unavailable)?;
        if review.id() != id
            || !collection_matches_status(collection, review.status())
            || self
                .resolve_paths(review.target())
                .record_path(collection, id)
                != path
            || !self.source_paths_match(&review)
        {
            return Err(UserReviewRepositoryError::Unavailable);
        }

        Ok(Some(review))
    }

    fn targeted_legacy_exists(&self, paths: &UserReviewStoragePaths, id: &UserReviewId) -> bool {
        [UserReviewCollection::Active, UserReviewCollection::Archive]
            .into_iter()
            .any(|collection| {
                fs::symlink_metadata(paths.legacy_record_path(collection, id))
                    .is_ok_and(|metadata| metadata.file_type().is_dir())
            })
    }
}

impl UserReviewRepository for JsonUserReviewRepository {
    fn create(
        &self,
        review: UserReview,
    ) -> Result<UserReviewCreateOutcome, UserReviewRepositoryError> {
        let _guard = lock_user_review_store()?;
        if review.status() != UserReviewStatus::Active || !self.source_paths_match(&review) {
            return Err(UserReviewRepositoryError::InvalidState {
                id: review.id().clone(),
            });
        }

        let paths = self.resolve_paths(review.target());
        self.prepare_directories(&paths)?;
        self.cleanup_stale_temps(&paths);

        if self.targeted_legacy_exists(&paths, review.id()) {
            return Err(UserReviewRepositoryError::LegacyRecord {
                id: review.id().clone(),
            });
        }

        let active_path = paths.record_path(UserReviewCollection::Active, review.id());
        let archive_path = paths.record_path(UserReviewCollection::Archive, review.id());
        if path_lexically_exists(&active_path) || path_lexically_exists(&archive_path) {
            return Err(UserReviewRepositoryError::AlreadyExists {
                id: review.id().clone(),
            });
        }

        let contents = encode_user_review_document(&review)
            .map_err(|_| UserReviewRepositoryError::Unavailable)?;
        match publish_no_replace(
            paths.active_directory(),
            &active_path,
            review.id(),
            &contents,
        )? {
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
        let _guard = lock_user_review_store()?;
        let paths = self.resolve_paths(target);
        self.validate_existing_paths(&paths)?;
        self.cleanup_stale_temps(&paths);

        let mut active_scan = self.scan_collection(&paths, UserReviewCollection::Active)?;
        let mut archive_scan = self.scan_collection(&paths, UserReviewCollection::Archive)?;
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
        let _guard = lock_user_review_store()?;
        let paths = self.resolve_paths(target);
        self.prepare_directories(&paths)?;
        self.cleanup_stale_temps(&paths);

        if self.targeted_legacy_exists(&paths, id) {
            return Err(UserReviewRepositoryError::LegacyRecord { id: id.clone() });
        }

        let active_path = paths.record_path(UserReviewCollection::Active, id);
        let archive_path = paths.record_path(UserReviewCollection::Archive, id);
        let active = self.load_mutation_record(&active_path, UserReviewCollection::Active, id)?;
        let archived =
            self.load_mutation_record(&archive_path, UserReviewCollection::Archive, id)?;

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
                let problem = duplicate_problem(id)?;
                let _ = remove_active_after_archive(&active_path, paths.active_directory());

                Ok(UserReviewArchiveOutcome::new(archived, vec![problem]))
            }
            (Some(mut active), None) => {
                ensure_target_matches(&active, target)?;
                active
                    .archive(id, target, archived_at)
                    .map_err(|_| UserReviewRepositoryError::InvalidState { id: id.clone() })?;
                let contents = encode_user_review_document(&active)
                    .map_err(|_| UserReviewRepositoryError::Unavailable)?;

                match publish_no_replace(paths.archive_directory(), &archive_path, id, &contents)? {
                    PublishOutcome::Published => {}
                    PublishOutcome::AlreadyExists => {
                        let persisted = self
                            .load_mutation_record(&archive_path, UserReviewCollection::Archive, id)?
                            .ok_or(UserReviewRepositoryError::Unavailable)?;
                        if persisted != active {
                            return Err(UserReviewRepositoryError::ConflictingCopies {
                                id: id.clone(),
                            });
                        }
                    }
                }

                let removed = remove_active_after_archive(&active_path, paths.active_directory());
                let problems = if removed {
                    Vec::new()
                } else {
                    vec![duplicate_problem(id)?]
                };

                Ok(UserReviewArchiveOutcome::new(active, problems))
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
    directory: &Path,
    destination: &Path,
    id: &UserReviewId,
    contents: &str,
) -> Result<PublishOutcome, UserReviewRepositoryError> {
    let (mut temp_file, temp_path) = create_temp_file(directory, id)?;
    if temp_file.write_all(contents.as_bytes()).is_err()
        || temp_file.flush().is_err()
        || temp_file.sync_all().is_err()
    {
        drop(temp_file);
        let _ = fs::remove_file(temp_path);
        return Err(UserReviewRepositoryError::Unavailable);
    }
    drop(temp_file);

    match fs::hard_link(&temp_path, destination) {
        Ok(()) => {}
        Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {
            let _ = fs::remove_file(temp_path);
            return Ok(PublishOutcome::AlreadyExists);
        }
        Err(_) => {
            let _ = fs::remove_file(temp_path);
            return Err(UserReviewRepositoryError::Unavailable);
        }
    }

    if sync_directory(directory).is_err() {
        return Err(UserReviewRepositoryError::Unavailable);
    }

    if fs::remove_file(&temp_path).is_ok() {
        let _ = sync_directory(directory);
    }

    Ok(PublishOutcome::Published)
}

fn create_temp_file(
    directory: &Path,
    id: &UserReviewId,
) -> Result<(File, PathBuf), UserReviewRepositoryError> {
    for _ in 0..TEMP_FILE_CREATE_ATTEMPTS {
        let path = directory.join(temp_file_name(id, Uuid::new_v4()));
        match OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(file) => return Ok((file, path)),
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

fn file_age(metadata: &fs::Metadata) -> Option<Duration> {
    SystemTime::now()
        .duration_since(metadata.modified().ok()?)
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

fn remove_active_after_archive(path: &Path, directory: &Path) -> bool {
    match fs::remove_file(path) {
        Ok(()) => sync_directory(directory).is_ok(),
        Err(error) if error.kind() == io::ErrorKind::NotFound => true,
        Err(_) => false,
    }
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

fn path_lexically_exists(path: &Path) -> bool {
    fs::symlink_metadata(path).is_ok()
}

fn ensure_not_symlink(path: &Path) -> Result<(), UserReviewRepositoryError> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() => {
            Err(UserReviewRepositoryError::Unavailable)
        }
        Ok(_) => Ok(()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(_) => Err(UserReviewRepositoryError::Unavailable),
    }
}

fn ensure_directory(path: &Path) -> Result<(), UserReviewRepositoryError> {
    let metadata =
        fs::symlink_metadata(path).map_err(|_| UserReviewRepositoryError::Unavailable)?;
    if !metadata.file_type().is_dir() || metadata.file_type().is_symlink() {
        return Err(UserReviewRepositoryError::Unavailable);
    }

    Ok(())
}

fn lock_user_review_store() -> Result<MutexGuard<'static, ()>, UserReviewRepositoryError> {
    USER_REVIEW_STORE_LOCK
        .lock()
        .map_err(|_| UserReviewRepositoryError::Unavailable)
}

#[cfg(unix)]
fn sync_directory(path: &Path) -> io::Result<()> {
    File::open(path)?.sync_all()
}

#[cfg(windows)]
fn sync_directory(path: &Path) -> io::Result<()> {
    use std::os::windows::fs::OpenOptionsExt;

    const FILE_FLAG_BACKUP_SEMANTICS: u32 = 0x0200_0000;
    OpenOptions::new()
        .read(true)
        .custom_flags(FILE_FLAG_BACKUP_SEMANTICS)
        .open(path)?
        .sync_all()
}

#[cfg(not(any(unix, windows)))]
fn sync_directory(_path: &Path) -> io::Result<()> {
    Ok(())
}
