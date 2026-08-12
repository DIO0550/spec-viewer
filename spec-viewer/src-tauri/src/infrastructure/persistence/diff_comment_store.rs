//! Cross-process locked, CAS, crash-safe Diff comment store.

use std::{
    fs::{self, File, OpenOptions},
    io::{self, Read, Write},
    path::Path,
    thread,
    time::{Duration, Instant, SystemTime},
};

use uuid::Uuid;

use crate::domain::comment::{
    diff::{DiffCommentRevision, DiffReviewIdentity, StoredDiffCommentDocument},
    diff_repository::{DiffCommentRepository, DiffCommentRepositoryError, StoredMutationOutcome},
};

use super::{
    atomic_replace::{self, ReplaceDurability},
    diff_comment_json,
    diff_comment_paths::DiffCommentPaths,
};

const LOCK_TIMEOUT: Duration = Duration::from_millis(2_000);
const LOCK_BACKOFF: Duration = Duration::from_millis(25);
const ORPHAN_MIN_AGE: Duration = Duration::from_secs(24 * 60 * 60);
const MAX_ORPHAN_SCAN: usize = 128;
const MAX_ORPHAN_DELETE: usize = 32;

#[derive(Debug, Clone)]
pub struct FilesystemDiffCommentStore {
    common_dir: std::path::PathBuf,
}

impl FilesystemDiffCommentStore {
    pub fn new(common_dir: std::path::PathBuf) -> Self {
        Self { common_dir }
    }

    fn paths(
        &self,
        identity: &DiffReviewIdentity,
    ) -> Result<DiffCommentPaths, DiffCommentRepositoryError> {
        DiffCommentPaths::create(&self.common_dir, identity.worktree_id()).map_err(map_io)
    }

    fn read_document(
        paths: &DiffCommentPaths,
        identity: &DiffReviewIdentity,
    ) -> Result<StoredDiffCommentDocument, DiffCommentRepositoryError> {
        let file = match File::open(paths.document()) {
            Ok(file) => file,
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                return Ok(StoredDiffCommentDocument::empty(identity.scope()))
            }
            Err(error) => return Err(map_io(error)),
        };
        let mut bytes = Vec::new();
        file.take((diff_comment_json::MAX_DIFF_COMMENT_JSON_BYTES + 1) as u64)
            .read_to_end(&mut bytes)
            .map_err(map_io)?;
        diff_comment_json::decode(&bytes, identity)
            .map_err(|_| DiffCommentRepositoryError::InvalidStore)
    }

    fn acquire_lock(paths: &DiffCommentPaths) -> Result<File, DiffCommentRepositoryError> {
        let file = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .truncate(false)
            .open(paths.lock())
            .map_err(map_io)?;
        set_private_file_permissions(paths.lock()).map_err(map_io)?;
        let deadline = Instant::now() + LOCK_TIMEOUT;
        loop {
            match file.try_lock() {
                Ok(()) => return Ok(file),
                Err(fs::TryLockError::WouldBlock) if Instant::now() < deadline => {
                    thread::sleep(LOCK_BACKOFF);
                }
                Err(fs::TryLockError::WouldBlock) => {
                    return Err(DiffCommentRepositoryError::StoreBusy)
                }
                Err(fs::TryLockError::Error(error)) => return Err(map_io(error)),
            }
        }
    }

    fn cleanup_orphans(paths: &DiffCommentPaths) {
        let now = SystemTime::now();
        let Ok(entries) = fs::read_dir(paths.root()) else {
            return;
        };
        let mut deleted = 0;
        for entry in entries.take(MAX_ORPHAN_SCAN).flatten() {
            if deleted >= MAX_ORPHAN_DELETE {
                break;
            }
            let name = entry.file_name();
            let Some(name) = name.to_str() else { continue };
            let Some(nonce) = name.strip_prefix(paths.temp_prefix()) else {
                continue;
            };
            if nonce.len() != 32 || !nonce.bytes().all(|byte| byte.is_ascii_hexdigit()) {
                continue;
            }
            let Ok(metadata) = fs::symlink_metadata(entry.path()) else {
                continue;
            };
            if !metadata.is_file() || metadata.file_type().is_symlink() {
                continue;
            }
            let old_enough = metadata
                .modified()
                .ok()
                .and_then(|modified| now.duration_since(modified).ok())
                .is_some_and(|age| age >= ORPHAN_MIN_AGE);
            if old_enough && fs::remove_file(entry.path()).is_ok() {
                deleted += 1;
            }
        }
    }
}

impl DiffCommentRepository for FilesystemDiffCommentStore {
    fn load(
        &self,
        identity: &DiffReviewIdentity,
    ) -> Result<StoredDiffCommentDocument, DiffCommentRepositoryError> {
        let paths = self.paths(identity)?;
        let lock = Self::acquire_lock(&paths)?;
        let result = Self::read_document(&paths, identity);
        let _ = lock.unlock();
        result
    }

    fn mutate(
        &self,
        identity: &DiffReviewIdentity,
        expected_revision: DiffCommentRevision,
        mutation: &(dyn Fn(
            &StoredDiffCommentDocument,
            DiffCommentRevision,
        ) -> Result<StoredDiffCommentDocument, DiffCommentRepositoryError>
              + Send
              + Sync),
    ) -> Result<StoredMutationOutcome, DiffCommentRepositoryError> {
        let paths = self.paths(identity)?;
        let lock = Self::acquire_lock(&paths)?;
        Self::cleanup_orphans(&paths);
        let current = Self::read_document(&paths, identity)?;
        if current.revision() != expected_revision {
            let _ = lock.unlock();
            return Ok(StoredMutationOutcome::Conflict {
                latest_document: current,
            });
        }
        let next_revision = match current.revision().checked_next() {
            Ok(revision) => revision,
            Err(_) => {
                let _ = lock.unlock();
                return Ok(StoredMutationOutcome::RevisionOverflow {
                    current_document: current,
                });
            }
        };
        let next = mutation(&current, next_revision)?;
        if next.revision() != next_revision || next.scope() != &identity.scope() {
            let _ = lock.unlock();
            return Err(DiffCommentRepositoryError::InvalidStore);
        }

        let bytes = diff_comment_json::encode(&next)
            .map_err(|_| DiffCommentRepositoryError::InvalidStore)?;
        let temp = paths.temp(&Uuid::new_v4().simple().to_string());
        let result = write_temp_and_replace(&temp, paths.document(), &bytes);
        if result.is_err() {
            let _ = fs::remove_file(&temp);
        }
        let _ = lock.unlock();
        let durability = result?;
        Ok(StoredMutationOutcome::Committed {
            document: next,
            durability_uncertain: durability == ReplaceDurability::Uncertain,
        })
    }
}

fn write_temp_and_replace(
    temp: &Path,
    destination: &Path,
    bytes: &[u8],
) -> Result<ReplaceDurability, DiffCommentRepositoryError> {
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(temp).map_err(map_io)?;
    set_private_file_permissions(temp).map_err(map_io)?;
    file.write_all(bytes).map_err(map_io)?;
    file.sync_all().map_err(map_io)?;
    drop(file);
    #[cfg(feature = "native-test-control")]
    super::native_test_control::wait_if_armed(
        super::native_test_control::CrashPhase::PreReplace,
        bytes,
    )
    .map_err(map_io)?;
    #[cfg(test)]
    if std::env::var_os("SPEC_VIEWER_DIFF_STORE_KILL_AFTER_TEMP_SYNC").is_some() {
        // Test-only crash point: replacement has not happened, so the old document must survive.
        std::process::exit(91);
    }
    #[cfg(feature = "native-test-control")]
    let replace = || {
        atomic_replace::replace_with_post_replace(temp, destination, || {
            super::native_test_control::wait_if_armed(
                super::native_test_control::CrashPhase::PostReplace,
                bytes,
            )
        })
    };
    #[cfg(not(feature = "native-test-control"))]
    let replace = || atomic_replace::replace(temp, destination);
    replace().map_err(map_io)
}

#[cfg(unix)]
fn set_private_file_permissions(path: &Path) -> io::Result<()> {
    super::private_permissions::enforce(path, false)
}

#[cfg(not(unix))]
fn set_private_file_permissions(_path: &Path) -> io::Result<()> {
    super::private_permissions::enforce(_path, false)
}

fn map_io(error: io::Error) -> DiffCommentRepositoryError {
    match error.kind() {
        io::ErrorKind::PermissionDenied => DiffCommentRepositoryError::Permission,
        _ => DiffCommentRepositoryError::Io,
    }
}

#[cfg(test)]
mod tests {
    use chrono::Utc;

    use super::*;
    use crate::domain::{
        comment::diff::{
            line_hash, DiffAnchorTarget, DiffLineAnchor, DiffReviewIdentity, DiffSide,
            StoredDiffComment, WorktreeStorageId,
        },
        repository::{CommitSha, RepositoryId, RepositoryRelativePath, SnapshotId},
    };
    use std::num::NonZeroU32;

    fn identity() -> DiffReviewIdentity {
        DiffReviewIdentity::new(
            RepositoryId::parse(format!("rr1_{}", "1".repeat(64))).unwrap(),
            WorktreeStorageId::parse(format!("rw1_{}", "2".repeat(64))).unwrap(),
            CommitSha::parse("3".repeat(40)).unwrap(),
            SnapshotId::parse(format!("rs1_{}", "4".repeat(64))).unwrap(),
        )
    }

    fn refreshed_identity() -> DiffReviewIdentity {
        DiffReviewIdentity::new(
            identity().repository_id().clone(),
            identity().worktree_id().clone(),
            CommitSha::parse("5".repeat(40)).unwrap(),
            SnapshotId::parse(format!("rs1_{}", "6".repeat(64))).unwrap(),
        )
    }

    fn comment(identity: DiffReviewIdentity) -> StoredDiffComment {
        let target = DiffAnchorTarget::new(
            DiffSide::Current,
            None,
            Some(RepositoryRelativePath::parse("src/lib.rs").unwrap()),
            NonZeroU32::new(1).unwrap(),
        )
        .unwrap();
        let anchor = DiffLineAnchor::new(
            identity,
            target,
            line_hash("line"),
            "line".into(),
            vec![],
            vec![],
        )
        .unwrap();
        StoredDiffComment::new("c1".into(), "body".into(), false, Utc::now(), anchor).unwrap()
    }

    fn store_root(label: &str) -> std::path::PathBuf {
        let root =
            std::env::temp_dir().join(format!("spec-viewer-r199-{label}-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        root
    }

    fn commit_one(
        store: &FilesystemDiffCommentStore,
        id: &DiffReviewIdentity,
    ) -> StoredMutationOutcome {
        store
            .mutate(id, DiffCommentRevision::ZERO, &|document, revision| {
                document
                    .with_comments(revision, vec![comment(id.clone())])
                    .map_err(|_| DiffCommentRepositoryError::InvalidStore)
            })
            .unwrap()
    }

    #[test]
    fn r199_store_001_revision_zero() {
        let root = store_root("revision-zero");
        assert_eq!(
            FilesystemDiffCommentStore::new(root.clone())
                .load(&identity())
                .unwrap()
                .revision(),
            DiffCommentRevision::ZERO
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn r199_store_002_increment() {
        let root = store_root("increment");
        let store = FilesystemDiffCommentStore::new(root.clone());
        let StoredMutationOutcome::Committed { document, .. } = commit_one(&store, &identity())
        else {
            panic!("first mutation must commit");
        };
        assert_eq!(document.revision().get(), 1);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn r199_store_003_conflict() {
        let root = store_root("conflict");
        let store = FilesystemDiffCommentStore::new(root.clone());
        commit_one(&store, &identity());
        assert!(matches!(
            store.mutate(&identity(), DiffCommentRevision::ZERO, &|_, _| unreachable!()).unwrap(),
            StoredMutationOutcome::Conflict { latest_document } if latest_document.revision().get() == 1
        ));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn r199_store_004_overflow() {
        let root = store_root("overflow");
        let store = FilesystemDiffCommentStore::new(root.clone());
        let id = identity();
        let paths = store.paths(&id).unwrap();
        let max = u64::MAX.to_string().parse::<DiffCommentRevision>().unwrap();
        let document = StoredDiffCommentDocument::new(id.scope(), max, vec![]).unwrap();
        fs::write(
            paths.document(),
            diff_comment_json::encode(&document).unwrap(),
        )
        .unwrap();
        assert!(matches!(
            store.mutate(&id, max, &|_, _| unreachable!()).unwrap(),
            StoredMutationOutcome::RevisionOverflow { current_document } if current_document.revision() == max
        ));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn r199_store_010_worktree_isolation() {
        let root = store_root("isolation");
        let first = identity();
        let second = DiffReviewIdentity::new(
            first.repository_id().clone(),
            WorktreeStorageId::parse(format!("rw1_{}", "9".repeat(64))).unwrap(),
            first.base_sha().clone(),
            first.current_snapshot_id().clone(),
        );
        let store = FilesystemDiffCommentStore::new(root.clone());
        commit_one(&store, &first);
        assert_eq!(store.load(&first).unwrap().comments().len(), 1);
        assert!(store.load(&second).unwrap().comments().is_empty());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn r199_store_012_envelope_mismatch() {
        let root = store_root("envelope-mismatch");
        let store = FilesystemDiffCommentStore::new(root.clone());
        let stored = identity();
        let expected = DiffReviewIdentity::new(
            RepositoryId::parse(format!("rr1_{}", "8".repeat(64))).unwrap(),
            stored.worktree_id().clone(),
            stored.base_sha().clone(),
            stored.current_snapshot_id().clone(),
        );
        let paths = store.paths(&expected).unwrap();
        let document = StoredDiffCommentDocument::empty(stored.scope());
        fs::write(
            paths.document(),
            diff_comment_json::encode(&document).unwrap(),
        )
        .unwrap();
        assert!(matches!(
            store.load(&expected),
            Err(DiffCommentRepositoryError::InvalidStore)
        ));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn r199_store_013_runtime_not_stored() {
        let document = StoredDiffCommentDocument::new(
            identity().scope(),
            DiffCommentRevision::ZERO,
            vec![comment(identity())],
        )
        .unwrap();
        let value: serde_json::Value =
            serde_json::from_slice(&diff_comment_json::encode(&document).unwrap()).unwrap();
        assert!(value["comments"][0].get("anchorResolution").is_none());
        assert!(value.get("resolutionWarnings").is_none());
    }

    #[test]
    fn save_reopen_and_conflict_preserve_latest_revision() {
        let root = std::env::temp_dir().join(format!("spec-viewer-diff-store-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let store = FilesystemDiffCommentStore::new(root.clone());
        let id = identity();
        let outcome = store
            .mutate(&id, DiffCommentRevision::ZERO, &|document, revision| {
                document
                    .with_comments(revision, vec![comment(id.clone())])
                    .map_err(|_| DiffCommentRepositoryError::InvalidStore)
            })
            .unwrap();
        assert!(matches!(outcome, StoredMutationOutcome::Committed { .. }));
        let reopened = FilesystemDiffCommentStore::new(root.clone())
            .load(&id)
            .unwrap();
        assert_eq!(reopened.revision().get(), 1);
        assert_eq!(reopened.comments().len(), 1);
        assert!(matches!(
            store.mutate(&id, DiffCommentRevision::ZERO, &|_, _| unreachable!()).unwrap(),
            StoredMutationOutcome::Conflict { latest_document } if latest_document.revision().get() == 1
        ));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn restart_after_base_and_snapshot_refresh_preserves_historical_anchor() {
        let root =
            std::env::temp_dir().join(format!("spec-viewer-diff-refresh-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let original = identity();
        FilesystemDiffCommentStore::new(root.clone())
            .mutate(
                &original,
                DiffCommentRevision::ZERO,
                &|document, revision| {
                    document
                        .with_comments(revision, vec![comment(original.clone())])
                        .map_err(|_| DiffCommentRepositoryError::InvalidStore)
                },
            )
            .unwrap();
        let refreshed = refreshed_identity();
        let reopened = FilesystemDiffCommentStore::new(root.clone())
            .load(&refreshed)
            .unwrap();
        assert_eq!(reopened.scope(), &refreshed.scope());
        assert_eq!(reopened.comments()[0].anchor().identity(), &original);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn concurrent_same_revision_has_one_commit_and_one_conflict() {
        use std::sync::{Arc, Barrier};

        let root = std::env::temp_dir().join(format!("spec-viewer-diff-race-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let store = Arc::new(FilesystemDiffCommentStore::new(root.clone()));
        let barrier = Arc::new(Barrier::new(2));
        let handles = (0..2)
            .map(|_| {
                let store = Arc::clone(&store);
                let barrier = Arc::clone(&barrier);
                std::thread::spawn(move || {
                    let id = identity();
                    barrier.wait();
                    store
                        .mutate(&id, DiffCommentRevision::ZERO, &|document, revision| {
                            document
                                .with_comments(revision, vec![comment(id.clone())])
                                .map_err(|_| DiffCommentRepositoryError::InvalidStore)
                        })
                        .unwrap()
                })
            })
            .collect::<Vec<_>>();
        let outcomes = handles
            .into_iter()
            .map(|handle| handle.join().unwrap())
            .collect::<Vec<_>>();
        assert_eq!(
            outcomes
                .iter()
                .filter(|outcome| matches!(outcome, StoredMutationOutcome::Committed { .. }))
                .count(),
            1
        );
        assert_eq!(
            outcomes
                .iter()
                .filter(|outcome| matches!(outcome, StoredMutationOutcome::Conflict { .. }))
                .count(),
            1
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn precommit_failure_keeps_previous_document_intact() {
        let root = std::env::temp_dir().join(format!("spec-viewer-diff-intact-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let store = FilesystemDiffCommentStore::new(root.clone());
        let id = identity();
        store
            .mutate(&id, DiffCommentRevision::ZERO, &|document, revision| {
                document
                    .with_comments(revision, vec![comment(id.clone())])
                    .map_err(|_| DiffCommentRepositoryError::InvalidStore)
            })
            .unwrap();
        assert!(matches!(
            store.mutate(&id, "1".parse().unwrap(), &|_, _| {
                Err(DiffCommentRepositoryError::Io)
            }),
            Err(DiffCommentRepositoryError::Io)
        ));
        let current = store.load(&id).unwrap();
        assert_eq!(current.revision().get(), 1);
        assert_eq!(current.comments().len(), 1);
        let _ = fs::remove_dir_all(root);
    }

    const CHILD_HELPER: &str =
        "infrastructure::persistence::diff_comment_store::tests::child_process_store_helper";

    fn child(root: &Path, expected: u64, kill_after_sync: bool) -> std::process::ExitStatus {
        let mut command = std::process::Command::new(std::env::current_exe().unwrap());
        command
            .arg("--exact")
            .arg(CHILD_HELPER)
            .arg("--ignored")
            .arg("--nocapture")
            .env("SPEC_VIEWER_DIFF_STORE_CHILD_ROOT", root)
            .env("SPEC_VIEWER_DIFF_STORE_EXPECTED", expected.to_string());
        if kill_after_sync {
            command.env("SPEC_VIEWER_DIFF_STORE_KILL_AFTER_TEMP_SYNC", "1");
        }
        command.status().unwrap()
    }

    #[test]
    #[ignore = "invoked as an isolated child process by store integration tests"]
    fn child_process_store_helper() {
        let Some(root) = std::env::var_os("SPEC_VIEWER_DIFF_STORE_CHILD_ROOT") else {
            return;
        };
        let expected = std::env::var("SPEC_VIEWER_DIFF_STORE_EXPECTED")
            .unwrap()
            .parse::<u64>()
            .unwrap()
            .to_string()
            .parse::<DiffCommentRevision>()
            .unwrap();
        let id = identity();
        let outcome = FilesystemDiffCommentStore::new(root.into())
            .mutate(&id, expected, &|document, revision| {
                document
                    .with_comments(revision, vec![comment(id.clone())])
                    .map_err(|_| DiffCommentRepositoryError::InvalidStore)
            })
            .unwrap();
        std::process::exit(match outcome {
            StoredMutationOutcome::Committed { .. } => 10,
            StoredMutationOutcome::Conflict { .. } => 11,
            StoredMutationOutcome::RevisionOverflow { .. } => 12,
        });
    }

    #[test]
    fn separate_processes_serialize_same_revision_cas() {
        let root =
            std::env::temp_dir().join(format!("spec-viewer-diff-process-race-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let first = std::thread::spawn({
            let root = root.clone();
            move || child(&root, 0, false).code().unwrap()
        });
        let second = std::thread::spawn({
            let root = root.clone();
            move || child(&root, 0, false).code().unwrap()
        });
        let mut codes = vec![first.join().unwrap(), second.join().unwrap()];
        codes.sort_unstable();
        assert_eq!(codes, vec![10, 11]);
        let reopened = FilesystemDiffCommentStore::new(root.clone())
            .load(&identity())
            .unwrap();
        assert_eq!(reopened.revision().get(), 1);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn child_killed_before_replace_keeps_old_document_intact() {
        let root =
            std::env::temp_dir().join(format!("spec-viewer-diff-kill-point-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let id = identity();
        let store = FilesystemDiffCommentStore::new(root.clone());
        store
            .mutate(&id, DiffCommentRevision::ZERO, &|document, revision| {
                document
                    .with_comments(revision, vec![comment(id.clone())])
                    .map_err(|_| DiffCommentRepositoryError::InvalidStore)
            })
            .unwrap();
        assert_eq!(child(&root, 1, true).code(), Some(91));
        let reopened = FilesystemDiffCommentStore::new(root.clone())
            .load(&id)
            .unwrap();
        assert_eq!(reopened.revision().get(), 1);
        assert_eq!(reopened.comments()[0].body(), "body");
        let _ = fs::remove_dir_all(root);
    }

    fn assert_diff_and_spec_bytes_are_isolated() {
        let root = store_root("spec-diff-isolation");
        let spec_path = root.join("comments.v2.json");
        let spec_bytes = br#"{"version":2,"comments":[]}"#;
        fs::write(&spec_path, spec_bytes).unwrap();
        let store = FilesystemDiffCommentStore::new(root.clone());
        let id = identity();
        commit_one(&store, &id);
        assert_eq!(fs::read(&spec_path).unwrap(), spec_bytes);

        let paths = store.paths(&id).unwrap();
        let diff_before = fs::read(paths.document()).unwrap();
        fs::write(
            &spec_path,
            br#"{"version":2,"comments":[],"extension":true}"#,
        )
        .unwrap();
        assert_eq!(fs::read(paths.document()).unwrap(), diff_before);
        assert_eq!(
            FilesystemDiffCommentStore::new(root.clone())
                .load(&id)
                .unwrap()
                .comments()
                .len(),
            1
        );
        let _ = fs::remove_dir_all(root);
    }

    #[cfg(unix)]
    #[test]
    fn r199_store_008_linux_diff_preserves_spec() {
        assert_diff_and_spec_bytes_are_isolated();
    }

    #[cfg(unix)]
    #[test]
    fn r199_store_009_linux_spec_preserves_diff() {
        assert_diff_and_spec_bytes_are_isolated();
    }

    #[cfg(windows)]
    #[test]
    fn r199_store_018_windows_diff_preserves_spec() {
        assert_diff_and_spec_bytes_are_isolated();
    }

    #[cfg(windows)]
    #[test]
    fn r199_store_019_windows_spec_preserves_diff() {
        assert_diff_and_spec_bytes_are_isolated();
    }
}
