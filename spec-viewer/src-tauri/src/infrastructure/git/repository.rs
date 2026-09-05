use super::{
    path_state::frame_submodule_state, selected_path_fingerprint, GitCommandKind, GitObjectBatch,
    GitObjectRead, GitOperation, GitRunner, RepositoryWatchRegistry,
};
use crate::domain::{
    comment::diff::{DiffReviewIdentity, WorktreeStorageId},
    repository::*,
    workspace::{ValidatedRefName, WorktreeId},
};
use chrono::DateTime;
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    io::Read,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};

const CONTENT_LIMIT: usize = 1_048_576;
const PATCH_LIMIT: usize = 2 * 1024 * 1024;

type AllPathSets = (
    Vec<RepositoryRelativePath>,
    Vec<RepositoryRelativePath>,
    Vec<RepositoryRelativePath>,
);

#[derive(Debug, Clone)]
struct RepositoryReviewContext {
    base: BaseBranchResolution,
    changed: Vec<DiffFile>,
    all_paths: Vec<RepositoryRelativePath>,
    ignored_nodes: BTreeMap<String, RepositoryRelativePath>,
}

type ContextKey = (Vec<u8>, String);
type ContextStore = Arc<Mutex<BTreeMap<ContextKey, RepositoryReviewContext>>>;

#[derive(Debug, Clone)]
struct WorkingTreeReviewContext {
    resolved_base: CommitSha,
    changed: Vec<DiffFile>,
}

type WorkingTreeContextKey = (Vec<u8>, String, String);
type WorkingTreeContextStore =
    Arc<Mutex<BTreeMap<WorkingTreeContextKey, WorkingTreeReviewContext>>>;
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DiffCommentResolutionContext {
    root: PathBuf,
    common_dir: PathBuf,
    identity: DiffReviewIdentity,
    changed: Vec<DiffFile>,
    all_paths: Vec<RepositoryRelativePath>,
}

impl DiffCommentResolutionContext {
    pub(crate) fn identity(&self) -> &DiffReviewIdentity {
        &self.identity
    }

    pub(crate) fn common_dir(&self) -> &Path {
        &self.common_dir
    }
}

#[cfg(test)]
impl DiffCommentResolutionContext {
    pub(crate) fn empty(identity: DiffReviewIdentity) -> Self {
        Self {
            root: PathBuf::new(),
            common_dir: PathBuf::new(),
            identity,
            changed: vec![],
            all_paths: vec![],
        }
    }
}

type DiffWorktreeKey = (String, String, String, String);
type DiffWorktreeStore = Arc<Mutex<BTreeMap<DiffWorktreeKey, DiffCommentResolutionContext>>>;

#[derive(Debug, Clone, Default)]
pub struct GitRepositoryAdapter {
    runner: GitRunner,
    object_batch: GitObjectBatch,
    contexts: ContextStore,
    diff_worktrees: DiffWorktreeStore,
    repository_watches: RepositoryWatchRegistry,
    working_tree_contexts: WorkingTreeContextStore,
}
impl GitRepositoryAdapter {
    fn context_key(root: &Path, snapshot: &SnapshotId) -> ContextKey {
        (
            root.as_os_str().as_encoded_bytes().to_vec(),
            snapshot.as_str().to_string(),
        )
    }

    fn remember_working_tree_context(
        &self,
        root: &Path,
        snapshot: &SnapshotId,
        resolved_base: CommitSha,
        changed: Vec<DiffFile>,
    ) -> Result<(), RepositoryPortError> {
        let key = Self::working_tree_context_key(root, snapshot, &resolved_base);
        let mut contexts = self
            .working_tree_contexts
            .lock()
            .map_err(|_| RepositoryPortError::Io)?;
        if contexts.len() >= 64 && !contexts.contains_key(&key) {
            contexts.pop_first();
        }
        contexts.insert(
            key,
            WorkingTreeReviewContext {
                resolved_base,
                changed,
            },
        );
        Ok(())
    }

    fn working_tree_context_key(
        root: &Path,
        snapshot: &SnapshotId,
        resolved_base: &CommitSha,
    ) -> WorkingTreeContextKey {
        (
            root.as_os_str().as_encoded_bytes().to_vec(),
            snapshot.as_str().to_string(),
            resolved_base.as_str().to_string(),
        )
    }

    fn working_tree_context(
        &self,
        root: &Path,
        snapshot: &SnapshotId,
        resolved_base: &CommitSha,
    ) -> Result<WorkingTreeReviewContext, RepositoryPortError> {
        self.working_tree_contexts
            .lock()
            .map_err(|_| RepositoryPortError::Io)?
            .get(&Self::working_tree_context_key(
                root,
                snapshot,
                resolved_base,
            ))
            .cloned()
            .ok_or(RepositoryPortError::StaleSnapshot)
    }

    fn working_tree_head(&self, root: &Path) -> Result<CommitSha, RepositoryPortError> {
        let bytes = match self.runner.run(
            root,
            GitOperation::WorkingTreeHead,
            &["rev-parse", "--verify", "HEAD"],
            GitCommandKind::Metadata,
        ) {
            Ok(bytes) => bytes,
            Err(error @ RepositoryPortError::GitFailed { .. }) => {
                if self.is_unborn_head(root)? {
                    return Err(RepositoryPortError::UnbornHead);
                }
                return Err(error);
            }
            Err(error) => return Err(error),
        };
        let value = std::str::from_utf8(&bytes)
            .map_err(|_| RepositoryPortError::UnsupportedPathEncoding)?;
        CommitSha::parse(value.trim()).map_err(|_| RepositoryPortError::GitFailed {
            operation: GitOperation::WorkingTreeHead.as_str().to_owned(),
            code: None,
            stderr: "Git returned an invalid object id".into(),
        })
    }

    fn resolve_comparison_revision(
        &self,
        root: &Path,
        comparison: &ComparisonRevision,
    ) -> Result<CommitSha, RepositoryPortError> {
        if matches!(comparison, ComparisonRevision::Head) {
            return self.working_tree_head(root);
        }
        let reference = match comparison {
            ComparisonRevision::Head => unreachable!(),
            ComparisonRevision::Commit(commit) => commit.as_str(),
            ComparisonRevision::LocalBranch(reference) | ComparisonRevision::Tag(reference) => {
                reference.as_str()
            }
        };
        self.runner
            .run(
                root,
                GitOperation::ComparisonRevisionExists,
                &["rev-parse", "--verify", reference],
                GitCommandKind::Metadata,
            )
            .map_err(|error| match error {
                RepositoryPortError::GitFailed { .. } => RepositoryPortError::RevisionNotFound,
                other => other,
            })?;
        let commit_reference = format!("{reference}^{{commit}}");
        let bytes = self
            .runner
            .run(
                root,
                GitOperation::ComparisonRevisionCommit,
                &["rev-parse", "--verify", &commit_reference],
                GitCommandKind::Metadata,
            )
            .map_err(|error| match error {
                RepositoryPortError::GitFailed { .. } => RepositoryPortError::RevisionNotCommit,
                other => other,
            })?;
        let value = std::str::from_utf8(&bytes)
            .map_err(|_| RepositoryPortError::UnsupportedPathEncoding)?;
        CommitSha::parse(value.trim()).map_err(|_| RepositoryPortError::RevisionNotCommit)
    }

    fn is_unborn_head(&self, root: &Path) -> Result<bool, RepositoryPortError> {
        let symbolic_head = match self.runner.run(
            root,
            GitOperation::WorkingTreeSymbolicHead,
            &["symbolic-ref", "-q", "HEAD"],
            GitCommandKind::Metadata,
        ) {
            Ok(bytes) => bytes,
            Err(RepositoryPortError::GitFailed { .. }) => return Ok(false),
            Err(error) => return Err(error),
        };
        let reference = std::str::from_utf8(&symbolic_head)
            .map_err(|_| RepositoryPortError::UnsupportedPathEncoding)?;
        match self.runner.run(
            root,
            GitOperation::WorkingTreeHeadReference,
            &["show-ref", "--verify", "--quiet", reference.trim()],
            GitCommandKind::Metadata,
        ) {
            Ok(_) => Ok(false),
            Err(RepositoryPortError::GitFailed { code: Some(1), .. }) => Ok(true),
            Err(error) => Err(error),
        }
    }
    fn build_working_tree_review(
        &self,
        root: &Path,
        repository_id: &RepositoryId,
        snapshot: &SnapshotId,
        baseline: &CommitSha,
        path: &RepositoryRelativePath,
        mut file: DiffFile,
    ) -> Result<FileReview, RepositoryPortError> {
        if file.entry_kind == EntryKind::Submodule {
            let omitted = ContentAvailability::Omitted {
                reason: OmissionReason::UnsupportedEntryKind,
                byte_length: None,
            };
            let review = FileReview {
                file,
                old_content: omitted.clone(),
                new_content: omitted.clone(),
                patch: omitted,
                structured_diff: StructuredDiff::Omitted {
                    reason: OmissionReason::UnsupportedEntryKind,
                },
                submodule: Some(self.submodule_state(root, baseline, path)),
            };
            if self.snapshot(root, repository_id)? != *snapshot {
                return Err(RepositoryPortError::EntryChangedDuringRead);
            }
            return Ok(review);
        }

        let old_content =
            self.base_side(root, baseline, file.old_path.as_ref(), file.entry_kind)?;
        let new_content = self.current_side(root, file.new_path.as_ref(), file.entry_kind)?;
        if file.entry_kind == EntryKind::Regular {
            file.content_classification = if [&old_content, &new_content].iter().any(|content| {
                matches!(
                    content,
                    ContentAvailability::Omitted {
                        reason: OmissionReason::Binary,
                        ..
                    }
                )
            }) {
                ContentClassification::Binary
            } else if [&old_content, &new_content]
                .iter()
                .any(|content| matches!(content, ContentAvailability::Available(_)))
            {
                ContentClassification::Text
            } else {
                file.content_classification
            };
        }

        let diff_omission = [&old_content, &new_content]
            .into_iter()
            .find_map(|content| match content {
                ContentAvailability::Omitted {
                    reason: reason @ (OmissionReason::Binary | OmissionReason::LargeFile),
                    ..
                } => Some(*reason),
                _ => None,
            });
        let (patch, structured_diff) = if let Some(reason) = diff_omission {
            (
                ContentAvailability::Omitted {
                    reason,
                    byte_length: None,
                },
                StructuredDiff::Omitted { reason },
            )
        } else if file.change == FileChangeKind::Untracked {
            match &new_content {
                ContentAvailability::Available(text) => match untracked_patch(text) {
                    Some(patch) => {
                        let structured = parse_structured_diff(patch.as_bytes());
                        (ContentAvailability::Available(patch), structured)
                    }
                    None => (
                        ContentAvailability::Omitted {
                            reason: OmissionReason::DiffLimit,
                            byte_length: None,
                        },
                        StructuredDiff::Omitted {
                            reason: OmissionReason::DiffLimit,
                        },
                    ),
                },
                ContentAvailability::Omitted { reason, .. } => (
                    ContentAvailability::Omitted {
                        reason: *reason,
                        byte_length: None,
                    },
                    StructuredDiff::Omitted { reason: *reason },
                ),
            }
        } else {
            let mut patch_paths = Vec::with_capacity(2);
            if let Some(old_path) = file.old_path.as_ref() {
                patch_paths.push(old_path.as_str());
            }
            if let Some(new_path) = file.new_path.as_ref() {
                if !patch_paths.contains(&new_path.as_str()) {
                    patch_paths.push(new_path.as_str());
                }
            }
            let mut arguments = vec![
                "diff",
                "--no-ext-diff",
                "--no-textconv",
                "--no-color",
                "--unified=3",
                "-M",
                "-C",
                baseline.as_str(),
                "--",
            ];
            arguments.extend(patch_paths);
            match self.runner.run_with_stdout_limit(
                root,
                GitOperation::WorkingTreeFilePatch,
                &arguments,
                GitCommandKind::Content,
                PATCH_LIMIT,
            ) {
                Ok(bytes) => match String::from_utf8(bytes) {
                    Ok(text) => {
                        let structured = parse_structured_diff(text.as_bytes());
                        (ContentAvailability::Available(text), structured)
                    }
                    Err(_) => (
                        ContentAvailability::Omitted {
                            reason: OmissionReason::Binary,
                            byte_length: None,
                        },
                        StructuredDiff::Omitted {
                            reason: OmissionReason::Binary,
                        },
                    ),
                },
                Err(RepositoryPortError::GitOutputLimitExceeded { .. }) => (
                    ContentAvailability::Omitted {
                        reason: OmissionReason::DiffLimit,
                        byte_length: None,
                    },
                    StructuredDiff::Omitted {
                        reason: OmissionReason::DiffLimit,
                    },
                ),
                Err(error) => return Err(error),
            }
        };
        let review = FileReview {
            file,
            old_content,
            new_content,
            patch,
            structured_diff,
            submodule: None,
        };
        if self.snapshot(root, repository_id)? != *snapshot {
            return Err(RepositoryPortError::EntryChangedDuringRead);
        }
        Ok(review)
    }

    fn remember_context(
        &self,
        root: &Path,
        snapshot: &SnapshotId,
        base: BaseBranchResolution,
        changed: Vec<DiffFile>,
        all_paths: Vec<RepositoryRelativePath>,
        ignored_directories: &[RepositoryRelativePath],
    ) -> Result<(), RepositoryPortError> {
        let key = Self::context_key(root, snapshot);
        let mut contexts = self.contexts.lock().map_err(|_| RepositoryPortError::Io)?;
        if contexts.len() >= 64 && !contexts.contains_key(&key) {
            contexts.pop_first();
        }
        let ignored_nodes = ignored_directories
            .iter()
            .cloned()
            .map(|path| (tree_node_id(path.as_str()), path))
            .collect();
        contexts.insert(
            key,
            RepositoryReviewContext {
                base,
                changed,
                all_paths,
                ignored_nodes,
            },
        );
        Ok(())
    }

    fn remember_ignored_nodes(
        &self,
        root: &Path,
        snapshot: &SnapshotId,
        nodes: impl IntoIterator<Item = (String, RepositoryRelativePath)>,
    ) -> Result<(), RepositoryPortError> {
        let key = Self::context_key(root, snapshot);
        let mut contexts = self.contexts.lock().map_err(|_| RepositoryPortError::Io)?;
        let context = contexts
            .get_mut(&key)
            .ok_or(RepositoryPortError::StaleBase)?;
        context.ignored_nodes.extend(nodes);
        Ok(())
    }

    fn review_context(
        &self,
        root: &Path,
        snapshot: &SnapshotId,
    ) -> Result<RepositoryReviewContext, RepositoryPortError> {
        self.contexts
            .lock()
            .map_err(|_| RepositoryPortError::Io)?
            .get(&Self::context_key(root, snapshot))
            .cloned()
            .ok_or(RepositoryPortError::StaleBase)
    }

    fn root(&self, worktree: &WorktreeId) -> Result<PathBuf, RepositoryPortError> {
        let selected = Path::new(worktree.as_str());
        if !selected.exists() {
            return Err(RepositoryPortError::WorktreeUnavailable);
        }
        let bare = self
            .text(
                selected,
                GitOperation::IsBare,
                &["rev-parse", "--is-bare-repository"],
                GitCommandKind::Metadata,
            )
            .map_err(|e| match e {
                RepositoryPortError::GitFailed { .. } => RepositoryPortError::NotRepository,
                other => other,
            })?;
        if bare.trim() == "true" {
            return Err(RepositoryPortError::BareRepository);
        }
        let root = self.text(
            selected,
            GitOperation::RepositoryRoot,
            &["rev-parse", "--show-toplevel"],
            GitCommandKind::Metadata,
        )?;
        fs::canonicalize(root.trim()).map_err(|_| RepositoryPortError::WorktreeUnavailable)
    }
    fn text(
        &self,
        root: &Path,
        operation: GitOperation,
        args: &[&str],
        kind: GitCommandKind,
    ) -> Result<String, RepositoryPortError> {
        String::from_utf8(self.runner.run(root, operation, args, kind)?)
            .map_err(|_| RepositoryPortError::UnsupportedPathEncoding)
    }
    fn git_directories(&self, root: &Path) -> Result<(PathBuf, PathBuf), RepositoryPortError> {
        let git_dir = self.text(
            root,
            GitOperation::GitDir,
            &["rev-parse", "--git-dir"],
            GitCommandKind::Metadata,
        )?;
        let canonical_git_dir = fs::canonicalize(root.join(git_dir.trim()))
            .map_err(|_| RepositoryPortError::WorktreeUnavailable)?;
        let common = self.text(
            root,
            GitOperation::CommonDir,
            &["rev-parse", "--git-common-dir"],
            GitCommandKind::Metadata,
        )?;
        let canonical_common = fs::canonicalize(root.join(common.trim()))
            .map_err(|_| RepositoryPortError::WorktreeUnavailable)?;
        if canonical_git_dir != canonical_common
            && !canonical_git_dir.starts_with(&canonical_common)
        {
            return Err(RepositoryPortError::CommonDirBoundaryEscape);
        }
        Ok((canonical_git_dir, canonical_common))
    }

    fn worktree_storage_id(&self, root: &Path) -> Result<WorktreeStorageId, RepositoryPortError> {
        let (git_dir, common_dir) = self.git_directories(root)?;
        Ok(WorktreeStorageId::from_canonical_bytes(
            &canonical_path_bytes(&common_dir),
            &canonical_path_bytes(&git_dir),
        ))
    }

    fn diff_worktree_key(identity: &DiffReviewIdentity) -> DiffWorktreeKey {
        (
            identity.repository_id().as_str().to_owned(),
            identity.worktree_id().as_str().to_owned(),
            identity.base_sha().as_str().to_owned(),
            identity.current_snapshot_id().as_str().to_owned(),
        )
    }

    fn remember_diff_worktree(
        &self,
        identity: DiffReviewIdentity,
        root: &Path,
        changed: Vec<DiffFile>,
        all_paths: Vec<RepositoryRelativePath>,
    ) -> Result<(), RepositoryPortError> {
        let (_, common_dir) = self.git_directories(root)?;
        let mut worktrees = self
            .diff_worktrees
            .lock()
            .map_err(|_| RepositoryPortError::Io)?;
        let key = Self::diff_worktree_key(&identity);
        if worktrees.len() >= 64 && !worktrees.contains_key(&key) {
            worktrees.pop_first();
        }
        worktrees.insert(
            key,
            DiffCommentResolutionContext {
                root: root.to_path_buf(),
                common_dir,
                identity,
                changed,
                all_paths,
            },
        );
        Ok(())
    }

    pub fn diff_comment_resolution_context(
        &self,
        identity: &DiffReviewIdentity,
    ) -> Result<DiffCommentResolutionContext, RepositoryPortError> {
        let worktrees = self
            .diff_worktrees
            .lock()
            .map_err(|_| RepositoryPortError::Io)?;
        let context = worktrees
            .get(&Self::diff_worktree_key(identity))
            .cloned()
            .or_else(|| {
                worktrees
                    .values()
                    .find(|candidate| {
                        candidate.identity.repository_id() == identity.repository_id()
                            && candidate.identity.worktree_id() == identity.worktree_id()
                            && candidate.identity.base_sha() == identity.base_sha()
                    })
                    .cloned()
            })
            .or_else(|| {
                worktrees
                    .values()
                    .find(|candidate| candidate.identity.worktree_id() == identity.worktree_id())
                    .cloned()
            })
            .ok_or(RepositoryPortError::WorktreeUnavailable)?;
        if &context.identity != identity {
            return Err(
                if context.identity.repository_id() != identity.repository_id() {
                    RepositoryPortError::IdentityMismatch
                } else if context.identity.base_sha() != identity.base_sha() {
                    RepositoryPortError::StaleBase
                } else {
                    RepositoryPortError::StaleSnapshot
                },
            );
        }
        let root = &context.root;
        if self.repository_id(root)? != *identity.repository_id()
            || self.worktree_storage_id(root)? != *identity.worktree_id()
        {
            return Err(RepositoryPortError::IdentityMismatch);
        }
        if self.snapshot(root, identity.repository_id())? != *identity.current_snapshot_id() {
            return Err(RepositoryPortError::StaleSnapshot);
        }
        Ok(context)
    }

    pub fn validate_diff_comment_target(
        &self,
        context: &DiffCommentResolutionContext,
        target: &crate::domain::comment::diff::DiffAnchorTarget,
    ) -> Result<(), RepositoryPortError> {
        let exact = context.changed.iter().any(|file| {
            file.old_path == target.old_path().cloned()
                && file.new_path == target.new_path().cloned()
                && matches!(
                    (file.change, target.side()),
                    (
                        FileChangeKind::Added | FileChangeKind::Untracked,
                        crate::domain::comment::diff::DiffSide::Current,
                    ) | (
                        FileChangeKind::Deleted,
                        crate::domain::comment::diff::DiffSide::Base
                    ) | (
                        FileChangeKind::Modified | FileChangeKind::Renamed | FileChangeKind::Copied,
                        _,
                    )
                )
                && file.entry_kind == EntryKind::Regular
                && file.content_classification == ContentClassification::Text
        });
        let unchanged_current = target.side() == crate::domain::comment::diff::DiffSide::Current
            && target.old_path().is_none()
            && context
                .all_paths
                .iter()
                .any(|path| path == target.side_path())
            && !context.changed.iter().any(|file| {
                file.old_path.as_ref() == Some(target.side_path())
                    || file.new_path.as_ref() == Some(target.side_path())
            });
        if exact || unchanged_current {
            Ok(())
        } else {
            Err(RepositoryPortError::InvalidRepositoryPath)
        }
    }

    pub fn resolve_diff_comment_target(
        &self,
        context: &DiffCommentResolutionContext,
        historical: &crate::domain::comment::diff::DiffAnchorTarget,
    ) -> Result<
        crate::domain::comment::diff::DiffAnchorTarget,
        crate::domain::comment::diff_repository::DiffCommentResolutionError,
    > {
        use crate::domain::comment::diff::{
            DiffAnchorPaths, DiffAnchorTarget, DiffSide, StaleAnchorReason,
        };
        use crate::domain::comment::diff_repository::DiffCommentResolutionError;
        let stale = |reason, candidate_count| DiffCommentResolutionError::Stale {
            reason,
            candidate_count,
        };
        let side_path = historical.side_path();
        let direct_file = context.changed.iter().find(|file| match historical.side() {
            DiffSide::Base => {
                file.old_path.as_ref() == Some(side_path)
                    && (file.new_path.as_ref() == Some(side_path)
                        || file.change == FileChangeKind::Deleted)
            }
            DiffSide::Current => file.new_path.as_ref() == Some(side_path),
        });
        let removed_from_current = context.changed.iter().any(|file| {
            file.old_path.as_ref() == Some(side_path)
                && matches!(
                    file.change,
                    FileChangeKind::Deleted | FileChangeKind::Renamed
                )
        });
        let direct_exists = match historical.side() {
            DiffSide::Base => direct_file.is_some(),
            DiffSide::Current => {
                direct_file.is_some()
                    || (context.all_paths.iter().any(|path| path == side_path)
                        && !removed_from_current)
            }
        };
        if direct_exists {
            if let Some(file) = direct_file {
                if file.entry_kind != EntryKind::Regular
                    || file.change == FileChangeKind::TypeChanged
                {
                    return Err(stale(StaleAnchorReason::Unsupported, 0));
                }
                if file.content_classification == ContentClassification::Binary {
                    return Err(stale(StaleAnchorReason::Binary, 0));
                }
            }
            let new_path = if historical.side() == DiffSide::Current
                || context.all_paths.iter().any(|path| path == side_path)
            {
                Some(side_path.clone())
            } else {
                None
            };
            return DiffAnchorPaths::new(
                historical.side(),
                (historical.side() == DiffSide::Base).then(|| side_path.clone()),
                new_path,
            )
            .map(|paths| DiffAnchorTarget::new(paths, historical.line()))
            .map_err(|_| stale(StaleAnchorReason::PathMissing, 0));
        }
        let candidates = context
            .changed
            .iter()
            .filter(|file| {
                file.old_path.as_ref() == Some(side_path)
                    || file.new_path.as_ref() == Some(side_path)
                    || (historical.new_path().is_some()
                        && file.new_path.as_ref() == historical.new_path())
            })
            .collect::<Vec<_>>();
        if candidates.len() > 1 {
            return Err(stale(
                StaleAnchorReason::AmbiguousRename,
                candidates.len().min(u32::MAX as usize) as u32,
            ));
        }
        if let Some(file) = candidates.first() {
            if file.entry_kind != EntryKind::Regular {
                return Err(stale(StaleAnchorReason::Unsupported, 0));
            }
            if file.content_classification == ContentClassification::Binary {
                return Err(stale(StaleAnchorReason::Binary, 0));
            }
            if file.change == FileChangeKind::TypeChanged {
                return Err(stale(StaleAnchorReason::Unsupported, 0));
            }
            if historical.side() == DiffSide::Current && file.change == FileChangeKind::Deleted {
                return Err(stale(StaleAnchorReason::Deleted, 0));
            }
            let paths = DiffAnchorPaths::new(
                historical.side(),
                file.old_path.clone(),
                file.new_path.clone(),
            )
            .map_err(|_| stale(StaleAnchorReason::PathMissing, 0))?;
            return Ok(DiffAnchorTarget::new(paths, historical.line()));
        }
        if historical.side() == DiffSide::Current
            && context.all_paths.iter().any(|path| path == side_path)
        {
            return Ok(DiffAnchorTarget::new(
                DiffAnchorPaths::Current {
                    new_path: side_path.clone(),
                    old_path: None,
                },
                historical.line(),
            ));
        }
        Err(stale(StaleAnchorReason::PathMissing, 0))
    }

    pub fn load_diff_comment_source(
        &self,
        context: &DiffCommentResolutionContext,
        side: crate::domain::comment::diff::DiffSide,
        path: &RepositoryRelativePath,
    ) -> Result<String, RepositoryPortError> {
        self.load_diff_comment_source_with_after_read(context, side, path, || {})
    }

    fn load_diff_comment_source_with_after_read(
        &self,
        context: &DiffCommentResolutionContext,
        side: crate::domain::comment::diff::DiffSide,
        path: &RepositoryRelativePath,
        after_read: impl FnOnce(),
    ) -> Result<String, RepositoryPortError> {
        let root = context.root.clone();
        let identity = &context.identity;
        let result = match side {
            crate::domain::comment::diff::DiffSide::Base => {
                let text = self.text(
                    &root,
                    GitOperation::DiffCommentBaseSource,
                    &[
                        "show",
                        &format!("{}:{}", identity.base_sha().as_str(), path.as_str()),
                    ],
                    GitCommandKind::Content,
                )?;
                after_read();
                if self.snapshot(&root, identity.repository_id())?
                    != *identity.current_snapshot_id()
                {
                    return Err(RepositoryPortError::EntryChangedDuringRead);
                }
                Ok(text)
            }
            crate::domain::comment::diff::DiffSide::Current => {
                let target = root.join(path.as_str());
                ensure_parent_boundary(&root, &target)?;
                let metadata =
                    fs::symlink_metadata(&target).map_err(|error| match error.kind() {
                        std::io::ErrorKind::PermissionDenied => {
                            RepositoryPortError::PermissionDenied
                        }
                        std::io::ErrorKind::NotFound => RepositoryPortError::InvalidRepositoryPath,
                        _ => RepositoryPortError::Io,
                    })?;
                if !metadata.is_file() || metadata.file_type().is_symlink() {
                    return Err(RepositoryPortError::InvalidRepositoryPath);
                }
                if metadata.len() > CONTENT_LIMIT as u64 {
                    return Err(RepositoryPortError::ContentTooLarge);
                }
                let canonical = fs::canonicalize(&target).map_err(map_filesystem_error)?;
                if !canonical.starts_with(&root) {
                    return Err(RepositoryPortError::InvalidRepositoryPath);
                }
                let mut bytes = Vec::with_capacity(metadata.len() as usize);
                let mut file = fs::File::open(canonical).map_err(map_filesystem_error)?;
                (&mut file)
                    .take((CONTENT_LIMIT + 1) as u64)
                    .read_to_end(&mut bytes)
                    .map_err(|error| {
                        if error.kind() == std::io::ErrorKind::PermissionDenied {
                            RepositoryPortError::PermissionDenied
                        } else {
                            RepositoryPortError::Io
                        }
                    })?;
                if bytes.len() > CONTENT_LIMIT {
                    return Err(RepositoryPortError::ContentTooLarge);
                }
                if bytes.iter().take(8192).any(|byte| *byte == 0) {
                    return Err(RepositoryPortError::InvalidRepositoryPath);
                }
                after_read();
                let after = file.metadata().map_err(map_filesystem_error)?;
                if metadata.len() != after.len()
                    || metadata.modified().ok() != after.modified().ok()
                {
                    return Err(RepositoryPortError::EntryChangedDuringRead);
                }
                if self.snapshot(&root, identity.repository_id())?
                    != *identity.current_snapshot_id()
                {
                    return Err(RepositoryPortError::EntryChangedDuringRead);
                }
                String::from_utf8(bytes).map_err(|_| RepositoryPortError::InvalidRepositoryPath)
            }
        }?;
        Ok(result)
    }

    fn repository_id(&self, root: &Path) -> Result<RepositoryId, RepositoryPortError> {
        let (_, canonical_common) = self.git_directories(root)?;
        let mut id_hash = Sha256::new();
        id_hash.update(b"spec-viewer.repository-id\0");
        frame(
            &mut id_hash,
            canonical_common.as_os_str().as_encoded_bytes(),
        );
        let digest = id_hash
            .finalize()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>();
        RepositoryId::parse(format!("rr1_{digest}")).map_err(|_| RepositoryPortError::Io)
    }
    fn head(&self, root: &Path) -> Result<CommitSha, RepositoryPortError> {
        CommitSha::parse(
            self.text(
                root,
                GitOperation::Head,
                &["rev-parse", "HEAD"],
                GitCommandKind::Metadata,
            )?
            .trim(),
        )
        .map_err(|_| RepositoryPortError::GitFailed {
            operation: GitOperation::Head.as_str().to_owned(),
            code: None,
            stderr: String::new(),
        })
    }
    fn ref_exists(&self, root: &Path, reference: &str) -> bool {
        self.runner
            .run(
                root,
                GitOperation::VerifyRef,
                &[
                    "rev-parse",
                    "--verify",
                    "--quiet",
                    "--end-of-options",
                    reference,
                ],
                GitCommandKind::Metadata,
            )
            .is_ok()
    }
    fn resolve_base(
        &self,
        root: &Path,
        override_ref: Option<&ValidatedRefName>,
    ) -> Result<(BaseBranchResolution, Option<BaseResolutionSource>), RepositoryPortError> {
        let head = match self.head(root) {
            Ok(head) => head,
            Err(_) => {
                return Ok((
                    BaseBranchResolution::NeedsSelection {
                        reason: BaseResolutionFailure::UnbornHead,
                        candidates: vec![],
                    },
                    None,
                ))
            }
        };
        let current = self
            .text(
                root,
                GitOperation::CurrentBranch,
                &["symbolic-ref", "--quiet", "--short", "HEAD"],
                GitCommandKind::Metadata,
            )
            .ok()
            .map(|s| s.trim().to_string());
        if override_ref.is_none() && current.is_none() {
            return Ok((
                BaseBranchResolution::NeedsSelection {
                    reason: BaseResolutionFailure::DetachedHead,
                    candidates: vec![],
                },
                None,
            ));
        }
        let mut candidates: Vec<(String, BaseResolutionSource)> = Vec::new();
        if let Some(value) = override_ref {
            if !self.ref_exists(root, value.as_str()) {
                return Ok((
                    BaseBranchResolution::InvalidOverride {
                        override_ref: value.as_str().to_string(),
                        missing: true,
                    },
                    None,
                ));
            }
            candidates.push((value.as_str().to_string(), BaseResolutionSource::Explicit));
        } else {
            if let Some(branch) = current.as_deref() {
                let key = format!("branch.{branch}.gh-merge-base");
                if let Ok(value) = self.text(
                    root,
                    GitOperation::GhMergeBase,
                    &["config", "--get", &key],
                    GitCommandKind::Metadata,
                ) {
                    let value = value.trim();
                    if let Ok(reference) = ValidatedRefName::parse(value) {
                        candidates.push((
                            reference.as_str().to_string(),
                            BaseResolutionSource::GhMergeBase,
                        ));
                    }
                }
                let remote_key = format!("branch.{branch}.remote");
                if let Ok(remote) = self.text(
                    root,
                    GitOperation::BranchRemote,
                    &["config", "--get", &remote_key],
                    GitCommandKind::Metadata,
                ) {
                    let reference = format!("refs/remotes/{}/HEAD", remote.trim());
                    candidates.push((reference, BaseResolutionSource::CurrentRemoteHead));
                }
            }
            candidates.push((
                "refs/remotes/origin/HEAD".into(),
                BaseResolutionSource::OriginHead,
            ));
            let remotes = self
                .text(
                    root,
                    GitOperation::RemoteHeads,
                    &["for-each-ref", "--format=%(refname)", "refs/remotes/*/HEAD"],
                    GitCommandKind::Metadata,
                )
                .unwrap_or_default();
            let mut others: Vec<_> = remotes
                .lines()
                .filter(|v| *v != "refs/remotes/origin/HEAD")
                .map(str::to_string)
                .collect();
            others.sort();
            others.dedup();
            if others.len() == 1 {
                candidates.push((others.remove(0), BaseResolutionSource::OtherRemoteHead));
            } else if others.len() > 1 && candidates.iter().all(|(r, _)| !self.ref_exists(root, r))
            {
                return Ok((
                    BaseBranchResolution::NeedsSelection {
                        reason: BaseResolutionFailure::AmbiguousRemoteHead,
                        candidates: others,
                    },
                    None,
                ));
            }
            candidates.push(("refs/heads/main".into(), BaseResolutionSource::Main));
            candidates.push(("refs/heads/master".into(), BaseResolutionSource::Master));
        }
        let candidate_names = candidates.iter().map(|(v, _)| v.clone()).collect();
        for (reference, source) in candidates {
            if !self.ref_exists(root, &reference) {
                continue;
            }
            let merge = self.text(
                root,
                GitOperation::MergeBase,
                &["merge-base", "--", &reference, "HEAD"],
                GitCommandKind::Metadata,
            );
            if let Ok(merge) = merge {
                let merge_base_sha =
                    CommitSha::parse(merge.trim()).map_err(|_| RepositoryPortError::GitFailed {
                        operation: GitOperation::MergeBaseOutput.as_str().to_owned(),
                        code: None,
                        stderr: "Git returned an invalid object id".into(),
                    })?;
                return Ok((
                    BaseBranchResolution::Resolved {
                        branch_ref: reference,
                        merge_base_sha,
                        head_sha: head,
                    },
                    Some(source),
                ));
            }
            let shallow = self
                .text(
                    root,
                    GitOperation::Shallow,
                    &["rev-parse", "--is-shallow-repository"],
                    GitCommandKind::Metadata,
                )
                .unwrap_or_default();
            let reason = if shallow.trim() == "true" {
                BaseResolutionFailure::ShallowHistory
            } else {
                BaseResolutionFailure::NoCommonAncestor
            };
            return Ok((
                BaseBranchResolution::NeedsSelection {
                    reason,
                    candidates: candidate_names,
                },
                None,
            ));
        }
        Ok((
            BaseBranchResolution::NeedsSelection {
                reason: BaseResolutionFailure::NotFound,
                candidates: candidate_names,
            },
            None,
        ))
    }
    fn snapshot(
        &self,
        root: &Path,
        repository_id: &RepositoryId,
    ) -> Result<SnapshotId, RepositoryPortError> {
        match self.snapshot_once(root, repository_id) {
            Err(RepositoryPortError::EntryChangedDuringRead) => {
                self.snapshot_once(root, repository_id)
            }
            result => result,
        }
    }

    fn snapshot_once(
        &self,
        root: &Path,
        repository_id: &RepositoryId,
    ) -> Result<SnapshotId, RepositoryPortError> {
        let mut hasher = Sha256::new();
        hasher.update(b"spec-viewer.repository-snapshot\0");
        hasher.update([1]);
        frame(&mut hasher, repository_id.as_str().as_bytes());
        let (canonical_git_dir, _) = self.git_directories(root)?;
        frame(
            &mut hasher,
            canonical_git_dir.as_os_str().as_encoded_bytes(),
        );
        let head_bytes = self.runner.run(
            root,
            GitOperation::SnapshotHead,
            &["rev-parse", "--verify", "HEAD"],
            GitCommandKind::Metadata,
        )?;
        let index_bytes = self.runner.run(
            root,
            GitOperation::SnapshotIndex,
            &["ls-files", "--stage", "-z"],
            GitCommandKind::Metadata,
        )?;
        frame(&mut hasher, &head_bytes);
        frame(&mut hasher, &index_bytes);
        // HEAD and the index already identify every clean/staged blob. Reading only
        // worktree-divergent paths keeps snapshot validation proportional to the
        // review changes instead of the complete repository size.
        let modified = self.runner.run(
            root,
            GitOperation::SnapshotModified,
            &["diff-files", "--name-only", "-z", "--"],
            GitCommandKind::Metadata,
        )?;
        let mut modified_paths = modified
            .split(|byte| *byte == 0)
            .filter(|path| !path.is_empty())
            .collect::<Vec<_>>();
        modified_paths.sort_unstable();
        for raw_path in modified_paths {
            let path = Self::path(raw_path)?;
            frame(&mut hasher, raw_path);
            let target = root.join(path.as_str());
            ensure_parent_boundary(root, &target)?;
            match fs::symlink_metadata(&target) {
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                    hasher.update([0]);
                }
                Err(_) => return Err(RepositoryPortError::EntryChangedDuringRead),
                Ok(metadata) if metadata.file_type().is_symlink() => {
                    hasher.update([1]);
                    let link = fs::read_link(target)
                        .map_err(|_| RepositoryPortError::EntryChangedDuringRead)?;
                    frame(&mut hasher, link.as_os_str().as_encoded_bytes());
                }
                Ok(metadata) if metadata.is_file() => {
                    hasher.update([2]);
                    frame_file(&mut hasher, &target)?;
                }
                Ok(metadata) if metadata.is_dir() => {
                    hasher.update([3]);
                    let head = self
                        .runner
                        .run(
                            &target,
                            GitOperation::SnapshotSubmoduleHead,
                            &["rev-parse", "HEAD"],
                            GitCommandKind::Metadata,
                        )
                        .unwrap_or_default();
                    let status = self
                        .runner
                        .run(
                            &target,
                            GitOperation::SnapshotSubmoduleStatus,
                            &["status", "--porcelain=v1", "-z", "--untracked-files=all"],
                            GitCommandKind::Metadata,
                        )
                        .unwrap_or_default();
                    frame_submodule_state(&mut hasher, &head, &status);
                }
                Ok(_) => hasher.update([4]),
            }
        }
        let untracked = self.runner.run(
            root,
            GitOperation::SnapshotUntracked,
            &["ls-files", "--others", "--exclude-standard", "-z"],
            GitCommandKind::Metadata,
        )?;
        let mut paths: Vec<_> = untracked
            .split(|byte| *byte == 0)
            .filter(|path| !path.is_empty())
            .collect();
        paths.sort_unstable();
        for raw_path in paths {
            let path = Self::path(raw_path)?;
            frame(&mut hasher, raw_path);
            let target = root.join(path.as_str());
            ensure_parent_boundary(root, &target)?;
            let metadata = fs::symlink_metadata(&target)
                .map_err(|_| RepositoryPortError::EntryChangedDuringRead)?;
            if metadata.file_type().is_symlink() {
                hasher.update([1]);
                let link = fs::read_link(target)
                    .map_err(|_| RepositoryPortError::EntryChangedDuringRead)?;
                frame(&mut hasher, link.as_os_str().as_encoded_bytes());
            } else if metadata.is_file() {
                hasher.update([2]);
                frame_file(&mut hasher, &target)?;
            } else {
                hasher.update([3]);
            }
        }
        let final_modified = self.runner.run(
            root,
            GitOperation::SnapshotModifiedRecheck,
            &["diff-files", "--name-only", "-z", "--"],
            GitCommandKind::Metadata,
        )?;
        let final_untracked = self.runner.run(
            root,
            GitOperation::SnapshotUntrackedRecheck,
            &["ls-files", "--others", "--exclude-standard", "-z"],
            GitCommandKind::Metadata,
        )?;
        let final_head = self.runner.run(
            root,
            GitOperation::SnapshotHeadRecheck,
            &["rev-parse", "--verify", "HEAD"],
            GitCommandKind::Metadata,
        )?;
        let final_index = self.runner.run(
            root,
            GitOperation::SnapshotIndexRecheck,
            &["ls-files", "--stage", "-z"],
            GitCommandKind::Metadata,
        )?;
        if final_head != head_bytes
            || final_index != index_bytes
            || final_modified != modified
            || final_untracked != untracked
        {
            return Err(RepositoryPortError::EntryChangedDuringRead);
        }
        let digest = hasher
            .finalize()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>();
        SnapshotId::parse(format!("rs1_{digest}")).map_err(|_| RepositoryPortError::Io)
    }
    fn path(raw: &[u8]) -> Result<RepositoryRelativePath, RepositoryPortError> {
        let value =
            std::str::from_utf8(raw).map_err(|_| RepositoryPortError::UnsupportedPathEncoding)?;
        RepositoryRelativePath::parse(value).map_err(|_| RepositoryPortError::InvalidRepositoryPath)
    }
    fn changes(
        &self,
        root: &Path,
        merge: &CommitSha,
    ) -> Result<Vec<DiffFile>, RepositoryPortError> {
        let base_modes = parse_mode_map(&self.runner.run(
            root,
            GitOperation::BaseModes,
            &["ls-tree", "-r", "-z", merge.as_str()],
            GitCommandKind::Metadata,
        )?)?;
        let index_modes = parse_mode_map(&self.runner.run(
            root,
            GitOperation::IndexModes,
            &["ls-files", "--stage", "-z"],
            GitCommandKind::Metadata,
        )?)?;
        let raw = self.runner.run(
            root,
            GitOperation::ChangedFiles,
            &[
                "diff",
                "--name-status",
                "-z",
                "-M50%",
                "-C50%",
                "-l1000",
                merge.as_str(),
            ],
            GitCommandKind::Metadata,
        )?;
        let mut sides = parse_diff_statuses(&raw)?;
        let untracked = self.runner.run(
            root,
            GitOperation::Untracked,
            &["ls-files", "--others", "--exclude-standard", "-z"],
            GitCommandKind::Metadata,
        )?;
        for raw_path in untracked.split(|b| *b == 0).filter(|v| !v.is_empty()) {
            let path = Self::path(raw_path)?;
            if !sides.iter().any(|change| change.new_path() == Some(&path)) {
                sides.push(DiffFileSides::Untracked {
                    new_path: path,
                    new_mode: None,
                });
            }
        }
        sides.sort_by(|a, b| {
            a.new_path()
                .or_else(|| a.old_path())
                .map(|path| path.as_str())
                .cmp(
                    &b.new_path()
                        .or_else(|| b.old_path())
                        .map(|path| path.as_str()),
                )
        });
        let mut files = Vec::with_capacity(sides.len());
        for change in sides {
            let old_mode = change
                .old_path()
                .and_then(|path| base_modes.get(path.as_str()))
                .copied();
            let mut new_mode = change
                .new_path()
                .and_then(|path| index_modes.get(path.as_str()))
                .copied();
            if new_mode.is_none() {
                if let Some(path) = change.new_path() {
                    if fs::symlink_metadata(root.join(path.as_str()))
                        .is_ok_and(|metadata| metadata.file_type().is_symlink())
                    {
                        new_mode = Some(GitFileMode::Symlink);
                    }
                }
            }
            let entry_kind = entry_kind_for_modes(old_mode, new_mode)?;
            let wire_modes = if old_mode == new_mode {
                DiffFileModes {
                    old: None,
                    new: None,
                }
            } else {
                DiffFileModes {
                    old: old_mode,
                    new: new_mode,
                }
            };
            let mut file = DiffFile::new(
                change.with_modes(wire_modes),
                DiffFileMetadata::new(entry_kind, ContentClassification::Unknown),
            )
            .map_err(|_| RepositoryPortError::InvalidRepositoryPath)?;
            file.content_classification = self.classify_current(root, &file)?;
            files.push(file);
        }
        Ok(files)
    }
    fn all_paths(
        &self,
        root: &Path,
        changed: &[DiffFile],
    ) -> Result<AllPathSets, RepositoryPortError> {
        let mut paths = BTreeSet::new();
        let visible = self.runner.run(
            root,
            GitOperation::AllFiles,
            &["ls-files", "-c", "-o", "--exclude-standard", "-z"],
            GitCommandKind::Metadata,
        )?;
        for raw in visible
            .split(|byte| *byte == 0)
            .filter(|value| !value.is_empty())
        {
            paths.insert(Self::path(raw)?);
        }
        let ignored = self.runner.run(
            root,
            GitOperation::IgnoredRoots,
            &[
                "ls-files",
                "-o",
                "-i",
                "--exclude-standard",
                "--directory",
                "-z",
            ],
            GitCommandKind::Metadata,
        )?;
        let mut ignored_directories = BTreeSet::new();
        let mut ignored_entries = BTreeSet::new();
        for raw in ignored
            .split(|byte| *byte == 0)
            .filter(|value| !value.is_empty())
        {
            if let Some(directory) = raw.strip_suffix(b"/") {
                let path = Self::path(directory)?;
                ignored_directories.insert(path.clone());
                ignored_entries.insert(path);
            } else {
                let path = Self::path(raw)?;
                paths.insert(path.clone());
                ignored_entries.insert(path);
            }
        }
        for file in changed {
            if let Some(path) = file.new_path.as_ref().or(file.old_path.as_ref()) {
                paths.insert(path.clone());
            }
        }
        paths.extend(ignored_directories.iter().cloned());
        Ok((
            paths.into_iter().collect(),
            ignored_directories.into_iter().collect(),
            ignored_entries.into_iter().collect(),
        ))
    }
    fn classify_current(
        &self,
        root: &Path,
        file: &DiffFile,
    ) -> Result<ContentClassification, RepositoryPortError> {
        if file.entry_kind != EntryKind::Regular {
            return Ok(ContentClassification::NotApplicable);
        }
        let Some(path) = file.new_path.as_ref() else {
            return Ok(ContentClassification::Unknown);
        };
        let target = root.join(path.as_str());
        ensure_parent_boundary(root, &target)?;
        let canonical = fs::canonicalize(&target).map_err(map_filesystem_error)?;
        if !canonical.starts_with(root) {
            return Err(RepositoryPortError::InvalidRepositoryPath);
        }
        let mut handle = fs::File::open(canonical).map_err(map_filesystem_error)?;
        let mut probe = Vec::with_capacity(8192);
        (&mut handle)
            .take(8192)
            .read_to_end(&mut probe)
            .map_err(map_filesystem_error)?;
        Ok(if probe.contains(&0) {
            ContentClassification::Binary
        } else {
            ContentClassification::Text
        })
    }

    fn base_side(
        &self,
        root: &Path,
        merge: &CommitSha,
        path: Option<&RepositoryRelativePath>,
        kind: EntryKind,
    ) -> Result<ContentAvailability, RepositoryPortError> {
        let Some(path) = path else {
            return Ok(ContentAvailability::Omitted {
                reason: OmissionReason::MissingSide,
                byte_length: None,
            });
        };
        let object = format!("{}:{}", merge.as_str(), path.as_str());
        match self.object_batch.read(root, &object, CONTENT_LIMIT)? {
            GitObjectRead::TooLarge(size) => Ok(ContentAvailability::Omitted {
                reason: OmissionReason::LargeFile,
                byte_length: Some(size),
            }),
            GitObjectRead::Available(bytes) => Ok(Self::side_for_entry(Some(bytes), kind)),
        }
    }

    fn current_side(
        &self,
        root: &Path,
        path: Option<&RepositoryRelativePath>,
        kind: EntryKind,
    ) -> Result<ContentAvailability, RepositoryPortError> {
        let Some(path) = path else {
            return Ok(ContentAvailability::Omitted {
                reason: OmissionReason::MissingSide,
                byte_length: None,
            });
        };
        let target = root.join(path.as_str());
        ensure_parent_boundary(root, &target)?;
        if kind == EntryKind::Symlink {
            let value = fs::read_link(target).map_err(map_filesystem_error)?;
            return Ok(Self::side_for_entry(
                Some(value.as_os_str().as_encoded_bytes().to_vec()),
                kind,
            ));
        }
        let before = fs::symlink_metadata(&target).map_err(map_filesystem_error)?;
        if !before.is_file() || before.file_type().is_symlink() {
            return Err(RepositoryPortError::EntryChangedDuringRead);
        }
        if before.len() > CONTENT_LIMIT as u64 {
            return Ok(ContentAvailability::Omitted {
                reason: OmissionReason::LargeFile,
                byte_length: Some(before.len()),
            });
        }
        let canonical = fs::canonicalize(&target).map_err(map_filesystem_error)?;
        if !canonical.starts_with(root) {
            return Err(RepositoryPortError::InvalidRepositoryPath);
        }
        let mut file = fs::File::open(&canonical).map_err(map_filesystem_error)?;
        let mut bytes = Vec::with_capacity(before.len() as usize);
        (&mut file)
            .take(CONTENT_LIMIT as u64 + 1)
            .read_to_end(&mut bytes)
            .map_err(map_filesystem_error)?;
        if bytes.len() > CONTENT_LIMIT {
            return Ok(ContentAvailability::Omitted {
                reason: OmissionReason::LargeFile,
                byte_length: Some(bytes.len() as u64),
            });
        }
        let after = file.metadata().map_err(map_filesystem_error)?;
        if before.len() != after.len() || before.modified().ok() != after.modified().ok() {
            return Err(RepositoryPortError::EntryChangedDuringRead);
        }
        Ok(Self::side(Some(bytes)))
    }

    fn parse_oid_field(bytes: &[u8], field: usize) -> Option<CommitSha> {
        let text = std::str::from_utf8(bytes).ok()?;
        let oid = text.split_ascii_whitespace().nth(field)?;
        CommitSha::parse(oid).ok()
    }

    fn submodule_state(
        &self,
        root: &Path,
        merge: &CommitSha,
        path: &RepositoryRelativePath,
    ) -> SubmoduleState {
        let base = self
            .runner
            .run(
                root,
                GitOperation::BaseGitlink,
                &["ls-tree", merge.as_str(), "--", path.as_str()],
                GitCommandKind::Metadata,
            )
            .ok()
            .and_then(|bytes| Self::parse_oid_field(&bytes, 2));
        let index = self
            .runner
            .run(
                root,
                GitOperation::IndexGitlink,
                &["ls-files", "--stage", "--", path.as_str()],
                GitCommandKind::Metadata,
            )
            .ok()
            .and_then(|bytes| Self::parse_oid_field(&bytes, 1));
        let submodule_root = root.join(path.as_str());
        let worktree = self
            .runner
            .run(
                &submodule_root,
                GitOperation::SubmoduleHead,
                &["rev-parse", "HEAD"],
                GitCommandKind::Metadata,
            )
            .ok()
            .and_then(|bytes| Self::parse_oid_field(&bytes, 0));
        let status = self
            .runner
            .run(
                &submodule_root,
                GitOperation::SubmoduleStatus,
                &["status", "--porcelain=v1", "-z", "--untracked-files=all"],
                GitCommandKind::Metadata,
            )
            .unwrap_or_default();
        let mut tracked_changes = false;
        let mut untracked_changes = false;
        for record in status
            .split(|byte| *byte == 0)
            .filter(|record| !record.is_empty())
        {
            if record.starts_with(b"??") {
                untracked_changes = true;
            } else {
                tracked_changes = true;
            }
        }
        SubmoduleState {
            commit_changed: index.is_some() && worktree.is_some() && index != worktree,
            uninitialized: worktree.is_none(),
            base_gitlink_oid: base,
            index_gitlink_oid: index,
            worktree_head_oid: worktree,
            tracked_changes,
            untracked_changes,
        }
    }

    fn side_for_entry(bytes: Option<Vec<u8>>, kind: EntryKind) -> ContentAvailability {
        if kind != EntryKind::Symlink {
            return Self::side(bytes);
        }
        let Some(bytes) = bytes else {
            return ContentAvailability::Omitted {
                reason: OmissionReason::MissingSide,
                byte_length: None,
            };
        };
        if bytes.len() > CONTENT_LIMIT {
            return ContentAvailability::Omitted {
                reason: OmissionReason::LargeFile,
                byte_length: Some(bytes.len() as u64),
            };
        }
        String::from_utf8(bytes)
            .map(ContentAvailability::Available)
            .unwrap_or(ContentAvailability::Omitted {
                reason: OmissionReason::UnsupportedEntryKind,
                byte_length: None,
            })
    }

    fn side(bytes: Option<Vec<u8>>) -> ContentAvailability {
        let Some(bytes) = bytes else {
            return ContentAvailability::Omitted {
                reason: OmissionReason::MissingSide,
                byte_length: None,
            };
        };
        if bytes.len() > CONTENT_LIMIT {
            return ContentAvailability::Omitted {
                reason: OmissionReason::LargeFile,
                byte_length: Some(bytes.len() as u64),
            };
        }
        if bytes.iter().take(8192).any(|b| *b == 0) {
            return ContentAvailability::Omitted {
                reason: OmissionReason::Binary,
                byte_length: Some(bytes.len() as u64),
            };
        }
        String::from_utf8(bytes)
            .map(ContentAvailability::Available)
            .unwrap_or(ContentAvailability::Omitted {
                reason: OmissionReason::Binary,
                byte_length: None,
            })
    }
}

#[cfg(unix)]
fn canonical_path_bytes(path: &Path) -> Vec<u8> {
    use std::os::unix::ffi::OsStrExt;
    path.as_os_str().as_bytes().to_vec()
}

#[cfg(windows)]
fn canonical_path_bytes(path: &Path) -> Vec<u8> {
    use std::os::windows::ffi::OsStrExt;
    path.as_os_str()
        .encode_wide()
        .flat_map(u16::to_le_bytes)
        .collect()
}
impl WorkingTreeDiffPort for GitRepositoryAdapter {
    fn list_comparison_revisions(
        &self,
        worktree: &WorktreeId,
    ) -> Result<Vec<RevisionOption>, RepositoryPortError> {
        let root = self.root(worktree)?;
        let head = self.working_tree_head(&root)?;
        let mut revisions = vec![RevisionOption {
            revision: ComparisonRevision::Head,
            label: "HEAD".into(),
            resolved_commit: head,
        }];
        let output = self.text(
            &root,
            GitOperation::ComparisonRevisions,
            &[
                "for-each-ref",
                "--format=%(refname)%00%(objectname)%00%(objecttype)",
                "refs/heads",
                "refs/tags",
            ],
            GitCommandKind::Metadata,
        )?;
        for line in output.lines().filter(|line| !line.is_empty()) {
            let fields = line.splitn(3, "\0").collect::<Vec<_>>();
            if fields.len() != 3 {
                return Err(RepositoryPortError::InvalidHistoryOutput);
            }
            let reference = fields[0];
            let validated = ValidatedRefName::parse(reference.to_string())
                .map_err(|_| RepositoryPortError::InvalidHistoryOutput)?;
            let revision = if reference.starts_with("refs/heads/") {
                ComparisonRevision::local_branch(validated)
            } else {
                ComparisonRevision::tag(validated)
            }
            .map_err(|_| RepositoryPortError::InvalidHistoryOutput)?;
            let resolved_commit = if fields[2] == "commit" {
                CommitSha::parse(fields[1])
                    .map_err(|_| RepositoryPortError::InvalidHistoryOutput)?
            } else {
                self.resolve_comparison_revision(&root, &revision)?
            };
            let label = reference
                .strip_prefix("refs/heads/")
                .or_else(|| reference.strip_prefix("refs/tags/"))
                .unwrap_or(reference)
                .to_string();
            revisions.push(RevisionOption {
                revision,
                label,
                resolved_commit,
            });
        }
        Ok(revisions)
    }

    fn list_file_history(
        &self,
        worktree: &WorktreeId,
        path: &RepositoryRelativePath,
        limit: usize,
    ) -> Result<SpecFileHistory, RepositoryPortError> {
        let root = self.root(worktree)?;
        let max_count = format!("--max-count={}", limit.saturating_add(1));
        let output = self.runner.run(
            &root,
            GitOperation::SpecFileHistory,
            &[
                "log",
                &max_count,
                "--format=%H%x00%cI%x00%s",
                "--",
                path.as_str(),
            ],
            GitCommandKind::Metadata,
        )?;
        parse_file_history(&output, limit)
    }

    fn load_working_tree_overview(
        &self,
        worktree: &WorktreeId,
        comparison: &ComparisonRevision,
    ) -> Result<WorkingTreeDiffOverview, RepositoryPortError> {
        let root = self.root(worktree)?;
        let repository_id = self.repository_id(&root)?;
        let resolved_base = self.resolve_comparison_revision(&root, comparison)?;
        let snapshot = self.snapshot(&root, &repository_id)?;
        let changed = self.changes(&root, &resolved_base)?;
        if matches!(comparison, ComparisonRevision::Head)
            && self.working_tree_head(&root)? != resolved_base
        {
            return Err(RepositoryPortError::HeadChangedDuringRead);
        }
        if self.snapshot(&root, &repository_id)? != snapshot {
            return Err(RepositoryPortError::EntryChangedDuringRead);
        }
        let worktree_storage_id = self.worktree_storage_id(&root)?;
        let diff_review_identity = DiffReviewIdentity::new(
            repository_id,
            worktree_storage_id,
            resolved_base.clone(),
            snapshot.clone(),
        );
        let all_paths = changed
            .iter()
            .flat_map(|file| [file.old_path.clone(), file.new_path.clone()])
            .flatten()
            .collect::<BTreeSet<_>>()
            .into_iter()
            .collect();
        self.remember_diff_worktree(
            diff_review_identity.clone(),
            &root,
            changed.clone(),
            all_paths,
        )?;
        self.remember_working_tree_context(
            &root,
            &snapshot,
            resolved_base.clone(),
            changed.clone(),
        )?;
        Ok(WorkingTreeDiffOverview {
            diff_review_identity,
            resolved_base_sha: resolved_base,
            current_snapshot_id: snapshot,
            changed,
        })
    }

    fn load_working_tree_file(
        &self,
        worktree: &WorktreeId,
        snapshot: &SnapshotId,
        resolved_base: &CommitSha,
        path: &RepositoryRelativePath,
    ) -> Result<FileReview, RepositoryPortError> {
        let root = self.root(worktree)?;
        let repository_id = self.repository_id(&root)?;
        if self.snapshot(&root, &repository_id)? != *snapshot {
            return Err(RepositoryPortError::StaleSnapshot);
        }
        let context = self.working_tree_context(&root, snapshot, resolved_base)?;
        let file = context
            .changed
            .into_iter()
            .find(|file| {
                file.new_path.as_ref() == Some(path) || file.old_path.as_ref() == Some(path)
            })
            .ok_or(RepositoryPortError::InvalidRepositoryPath)?;
        self.build_working_tree_review(
            &root,
            &repository_id,
            snapshot,
            &context.resolved_base,
            path,
            file,
        )
    }
}

impl RepositoryPort for GitRepositoryAdapter {
    fn load_overview(
        &self,
        worktree: &WorktreeId,
        override_ref: Option<&ValidatedRefName>,
    ) -> Result<RepositoryOverview, RepositoryPortError> {
        let root = self.root(worktree)?;
        let repository_id = self.repository_id(&root)?;
        let (base, base_source) = self.resolve_base(&root, override_ref)?;
        let BaseBranchResolution::Resolved {
            branch_ref,
            merge_base_sha,
            head_sha,
        } = &base
        else {
            return Ok(RepositoryOverview {
                repository_id,
                diff_review_identity: None,
                display_worktree_label: root.to_string_lossy().into_owned(),
                base,
                base_source,
                current_snapshot_id: None,
                changed: vec![],
                changed_tree: vec![],
                all_root: vec![],
                all_paths: vec![],
                warnings: vec![],
                ignored_directories: vec![],
            });
        };
        let (git_dir, common_dir) = self.git_directories(&root)?;
        let watch_paths = [git_dir, common_dir];
        let initial_watch_generation = self.repository_watches.generation(&root, &watch_paths);
        let snapshot = self.snapshot(&root, &repository_id)?;
        let changed = self.changes(&root, merge_base_sha)?;
        let (all_paths, ignored_directories, ignored_entries) = self.all_paths(&root, &changed)?;
        let warnings = similarity_warnings(&changed);
        let changed_tree = changed_tree(&changed)?;
        let all_root = all_tree(&all_paths, &ignored_entries, &ignored_directories, &changed)?;
        let current_head = self.head(&root)?;
        let current_merge = self.text(
            &root,
            GitOperation::VerifyMergeBase,
            &["merge-base", "--", branch_ref, "HEAD"],
            GitCommandKind::Metadata,
        )?;
        if current_head != *head_sha || current_merge.trim() != merge_base_sha.as_str() {
            return Err(RepositoryPortError::StaleBase);
        }
        let watch_requires_confirmation = match initial_watch_generation {
            Some(initial) => self
                .repository_watches
                .generation(&root, &watch_paths)
                .map(|current| current != initial)
                .unwrap_or(true),
            None => true,
        };
        // Filesystem watchers are an optimization, not a source of truth. In
        // particular, Windows can report metadata activity from read-only Git
        // commands as a change. Confirm such notifications against the content
        // snapshot so stable repositories do not fail an overview load.
        if watch_requires_confirmation && self.snapshot(&root, &repository_id)? != snapshot {
            return Err(RepositoryPortError::EntryChangedDuringRead);
        }
        let worktree_storage_id = self.worktree_storage_id(&root)?;
        let diff_review_identity = DiffReviewIdentity::new(
            repository_id.clone(),
            worktree_storage_id,
            merge_base_sha.clone(),
            snapshot.clone(),
        );
        self.remember_diff_worktree(
            diff_review_identity.clone(),
            &root,
            changed.clone(),
            all_paths.clone(),
        )?;
        self.remember_context(
            &root,
            &snapshot,
            base.clone(),
            changed.clone(),
            all_paths.clone(),
            &ignored_directories,
        )?;
        Ok(RepositoryOverview {
            repository_id,
            diff_review_identity: Some(diff_review_identity),
            display_worktree_label: root.to_string_lossy().into_owned(),
            base,
            base_source,
            current_snapshot_id: Some(snapshot),
            changed,
            changed_tree,
            all_root,
            all_paths,
            ignored_directories,
            warnings,
        })
    }
    fn traverse_ignored(
        &self,
        worktree: &WorktreeId,
        snapshot: &SnapshotId,
        node_id: &str,
        cursor: Option<&str>,
    ) -> Result<IgnoredPage, RepositoryPortError> {
        let root = self.root(worktree)?;
        let repository_id = self.repository_id(&root)?;
        if self.snapshot(&root, &repository_id)? != *snapshot {
            return Err(RepositoryPortError::StaleSnapshot);
        }
        let context = self.review_context(&root, snapshot)?;
        let directory = context
            .ignored_nodes
            .get(node_id)
            .cloned()
            .ok_or(RepositoryPortError::InvalidCursor)?;
        self.runner
            .run(
                &root,
                GitOperation::CheckIgnoredDirectory,
                &["check-ignore", "--quiet", "--", directory.as_str()],
                GitCommandKind::Metadata,
            )
            .map_err(|error| match error {
                RepositoryPortError::GitFailed { .. } => RepositoryPortError::InvalidCursor,
                other => other,
            })?;
        let directory_path = root.join(directory.as_str());
        ensure_parent_boundary(&root, &directory_path)?;
        let directory_metadata =
            fs::symlink_metadata(&directory_path).map_err(map_filesystem_error)?;
        if directory_metadata.file_type().is_symlink() || !directory_metadata.is_dir() {
            return Err(RepositoryPortError::InvalidRepositoryPath);
        }
        let canonical_directory =
            fs::canonicalize(&directory_path).map_err(map_filesystem_error)?;
        if !canonical_directory.starts_with(&root) {
            return Err(RepositoryPortError::InvalidRepositoryPath);
        }

        let mut entries = Vec::new();
        let mut listing_records = Vec::new();
        let mut child_directories = Vec::new();
        for entry in fs::read_dir(canonical_directory).map_err(map_filesystem_error)? {
            let entry = entry.map_err(map_filesystem_error)?;
            let name = entry
                .file_name()
                .into_string()
                .map_err(|_| RepositoryPortError::UnsupportedPathEncoding)?;
            let path = RepositoryRelativePath::parse(format!("{}/{name}", directory.as_str()))
                .map_err(|_| RepositoryPortError::InvalidRepositoryPath)?;
            let metadata = fs::symlink_metadata(entry.path()).map_err(map_filesystem_error)?;
            let kind = if metadata.file_type().is_symlink() {
                2_u8
            } else if metadata.is_dir() {
                1
            } else {
                0
            };
            let modified = metadata.modified().ok().and_then(|value| {
                value
                    .duration_since(std::time::UNIX_EPOCH)
                    .ok()
                    .map(|duration| duration.as_nanos())
            });
            listing_records.push((path.clone(), kind, metadata.len(), modified));
            let (node_kind, entry_kind, children) =
                if metadata.is_dir() && !metadata.file_type().is_symlink() {
                    let child_node_id = tree_node_id(path.as_str());
                    child_directories.push((child_node_id.clone(), path.clone()));
                    (
                        TreeNodeKind::Directory,
                        None,
                        TreeChildren::Deferred {
                            node_id: child_node_id,
                        },
                    )
                } else {
                    (
                        TreeNodeKind::File,
                        Some(if metadata.file_type().is_symlink() {
                            EntryKind::Symlink
                        } else {
                            EntryKind::Regular
                        }),
                        TreeChildren::Loaded(vec![]),
                    )
                };
            entries.push(TreeNode {
                path,
                name,
                kind: node_kind,
                entry_kind,
                change: None,
                ignored: true,
                children,
            });
        }
        entries.sort_by(|left, right| left.path.cmp(&right.path));
        self.remember_ignored_nodes(&root, snapshot, child_directories)?;
        listing_records.sort_by(|left, right| left.0.cmp(&right.0));
        let mut hasher = Sha256::new();
        hasher.update(b"spec-viewer.ignored-listing\0");
        for (path, kind, length, modified) in listing_records {
            frame(&mut hasher, path.as_str().as_bytes());
            hasher.update([kind]);
            hasher.update(length.to_be_bytes());
            match modified {
                Some(value) => {
                    hasher.update([1]);
                    hasher.update(value.to_be_bytes());
                }
                None => hasher.update([0]),
            }
        }
        let fingerprint = hasher
            .finalize()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>();
        let offset = match cursor {
            None => 0,
            Some(cursor) => parse_ignored_cursor(cursor, snapshot.as_str(), node_id, &fingerprint)?,
        };
        if offset > entries.len() {
            return Err(RepositoryPortError::InvalidCursor);
        }
        let end = (offset + 200).min(entries.len());
        Ok(IgnoredPage {
            node_id: node_id.to_string(),
            directory: directory.clone(),
            entries: entries[offset..end].to_vec(),
            next_cursor: (end < entries.len())
                .then(|| format!("ic1_{}-{}-{fingerprint}-{end}", snapshot.as_str(), node_id)),
        })
    }
    fn load_file(
        &self,
        worktree: &WorktreeId,
        snapshot: &SnapshotId,
        path: &RepositoryRelativePath,
    ) -> Result<RepositoryFileReview, RepositoryPortError> {
        let root = self.root(worktree)?;
        let context = self.review_context(&root, snapshot)?;
        let initial_path_fingerprint = selected_path_fingerprint(&self.runner, &root, path)?;
        let file = context
            .changed
            .iter()
            .find(|file| {
                file.new_path.as_ref() == Some(path) || file.old_path.as_ref() == Some(path)
            })
            .cloned();
        let (branch_ref, merge, expected_head) = match context.base.clone() {
            BaseBranchResolution::Resolved {
                branch_ref,
                merge_base_sha,
                head_sha,
            } => (branch_ref, merge_base_sha, head_sha),
            _ => return Err(RepositoryPortError::StaleBase),
        };
        let current_head = self.head(&root)?;
        let current_merge = self.text(
            &root,
            GitOperation::FileReviewMergeBase,
            &["merge-base", "--", &branch_ref, "HEAD"],
            GitCommandKind::Metadata,
        )?;
        if current_head != expected_head || current_merge.trim() != merge.as_str() {
            return Err(RepositoryPortError::StaleBase);
        }
        let Some(mut file) = file else {
            if !context.all_paths.iter().any(|candidate| candidate == path) {
                return Err(RepositoryPortError::InvalidRepositoryPath);
            }
            let target = root.join(path.as_str());
            ensure_parent_boundary(&root, &target)?;
            let metadata = fs::symlink_metadata(&target).map_err(map_filesystem_error)?;
            if !metadata.is_file() || metadata.file_type().is_symlink() {
                return Err(RepositoryPortError::InvalidRepositoryPath);
            }
            let new_content = self.current_side(&root, Some(path), EntryKind::Regular)?;
            let content_classification = match &new_content {
                ContentAvailability::Available(_) => ContentClassification::Text,
                ContentAvailability::Omitted {
                    reason: OmissionReason::Binary,
                    ..
                } => ContentClassification::Binary,
                ContentAvailability::Omitted { .. } => ContentClassification::Unknown,
            };
            let review = RepositoryFileReview {
                file: RepositoryFileMetadata {
                    old_path: None,
                    new_path: Some(path.clone()),
                    change: None,
                    entry_kind: EntryKind::Regular,
                    content_classification,
                    similarity: None,
                    old_mode: None,
                    new_mode: None,
                },
                old_content: ContentAvailability::Omitted {
                    reason: OmissionReason::MissingSide,
                    byte_length: None,
                },
                new_content,
                patch: ContentAvailability::Available(String::new()),
                structured_diff: StructuredDiff::Available(vec![]),
                submodule: None,
            };
            if selected_path_fingerprint(&self.runner, &root, path)? != initial_path_fingerprint {
                return Err(RepositoryPortError::EntryChangedDuringRead);
            }
            return Ok(review);
        };
        if file.entry_kind == EntryKind::Submodule {
            let omitted = ContentAvailability::Omitted {
                reason: OmissionReason::UnsupportedEntryKind,
                byte_length: None,
            };
            let review = FileReview {
                file,
                old_content: omitted.clone(),
                new_content: omitted.clone(),
                patch: omitted,
                structured_diff: StructuredDiff::Omitted {
                    reason: OmissionReason::UnsupportedEntryKind,
                },
                submodule: Some(self.submodule_state(&root, &merge, path)),
            };
            if selected_path_fingerprint(&self.runner, &root, path)? != initial_path_fingerprint {
                return Err(RepositoryPortError::EntryChangedDuringRead);
            }
            return Ok(review.into());
        }
        let old_content = self.base_side(&root, &merge, file.old_path.as_ref(), file.entry_kind)?;
        let new_content = self.current_side(&root, file.new_path.as_ref(), file.entry_kind)?;
        if file.entry_kind == EntryKind::Regular {
            file.content_classification = if [&old_content, &new_content].iter().any(|content| {
                matches!(
                    content,
                    ContentAvailability::Omitted {
                        reason: OmissionReason::Binary,
                        ..
                    }
                )
            }) {
                ContentClassification::Binary
            } else if [&old_content, &new_content]
                .iter()
                .any(|content| matches!(content, ContentAvailability::Available(_)))
            {
                ContentClassification::Text
            } else {
                file.content_classification
            };
        }
        let diff_omission = [&old_content, &new_content]
            .into_iter()
            .find_map(|content| match content {
                ContentAvailability::Omitted {
                    reason: reason @ (OmissionReason::Binary | OmissionReason::LargeFile),
                    ..
                } => Some(*reason),
                _ => None,
            });
        let (patch, structured_diff) = if let Some(reason) = diff_omission {
            (
                ContentAvailability::Omitted {
                    reason,
                    byte_length: None,
                },
                StructuredDiff::Omitted { reason },
            )
        } else if file.change == FileChangeKind::Untracked {
            match &new_content {
                ContentAvailability::Available(text) => match untracked_patch(text) {
                    Some(patch) => {
                        let structured = parse_structured_diff(patch.as_bytes());
                        (ContentAvailability::Available(patch), structured)
                    }
                    None => (
                        ContentAvailability::Omitted {
                            reason: OmissionReason::DiffLimit,
                            byte_length: None,
                        },
                        StructuredDiff::Omitted {
                            reason: OmissionReason::DiffLimit,
                        },
                    ),
                },
                ContentAvailability::Omitted { reason, .. } => (
                    ContentAvailability::Omitted {
                        reason: *reason,
                        byte_length: None,
                    },
                    StructuredDiff::Omitted { reason: *reason },
                ),
            }
        } else {
            match self.runner.run_with_stdout_limit(
                &root,
                GitOperation::FilePatch,
                &[
                    "diff",
                    "--no-ext-diff",
                    "--no-textconv",
                    "--no-color",
                    "--unified=3",
                    merge.as_str(),
                    "--",
                    path.as_str(),
                ],
                GitCommandKind::Content,
                PATCH_LIMIT,
            ) {
                Ok(bytes) => match String::from_utf8(bytes) {
                    Ok(text) => {
                        let structured = parse_structured_diff(text.as_bytes());
                        (ContentAvailability::Available(text), structured)
                    }
                    Err(_) => (
                        ContentAvailability::Omitted {
                            reason: OmissionReason::Binary,
                            byte_length: None,
                        },
                        StructuredDiff::Omitted {
                            reason: OmissionReason::Binary,
                        },
                    ),
                },
                Err(RepositoryPortError::GitOutputLimitExceeded { .. }) => (
                    ContentAvailability::Omitted {
                        reason: OmissionReason::DiffLimit,
                        byte_length: None,
                    },
                    StructuredDiff::Omitted {
                        reason: OmissionReason::DiffLimit,
                    },
                ),
                Err(_) => (
                    ContentAvailability::Omitted {
                        reason: OmissionReason::MissingSide,
                        byte_length: None,
                    },
                    StructuredDiff::Omitted {
                        reason: OmissionReason::MissingSide,
                    },
                ),
            }
        };
        let review = FileReview {
            file,
            old_content,
            new_content,
            patch,
            structured_diff,
            submodule: None,
        };
        if selected_path_fingerprint(&self.runner, &root, path)? != initial_path_fingerprint {
            return Err(RepositoryPortError::EntryChangedDuringRead);
        }
        Ok(review.into())
    }
}

#[derive(Debug, Default)]
struct MutableTreeNode {
    path: String,
    name: String,
    kind: Option<TreeNodeKind>,
    entry_kind: Option<EntryKind>,
    change: Option<FileChangeKind>,
    ignored: bool,
    deferred: bool,
    children: BTreeMap<String, MutableTreeNode>,
}

fn tree_node_id(path: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(b"spec-viewer.repository-tree-node\0");
    frame(&mut hasher, path.as_bytes());
    let digest = hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    format!("in1_{digest}")
}

fn build_tree(
    entries: impl IntoIterator<
        Item = (
            RepositoryRelativePath,
            Option<EntryKind>,
            Option<FileChangeKind>,
            bool,
            bool,
        ),
    >,
) -> Result<Vec<TreeNode>, RepositoryPortError> {
    let mut roots = BTreeMap::<String, MutableTreeNode>::new();
    for (path, entry_kind, change, ignored, deferred) in entries {
        let segments = path.as_str().split('/').collect::<Vec<_>>();
        let mut level = &mut roots;
        let mut current_path = String::new();
        for (index, segment) in segments.iter().enumerate() {
            if !current_path.is_empty() {
                current_path.push('/');
            }
            current_path.push_str(segment);
            let leaf = index + 1 == segments.len();
            let node = level
                .entry((*segment).to_string())
                .or_insert_with(|| MutableTreeNode {
                    path: current_path.clone(),
                    name: (*segment).to_string(),
                    ..MutableTreeNode::default()
                });
            if leaf {
                node.kind = Some(if deferred {
                    TreeNodeKind::Directory
                } else {
                    TreeNodeKind::File
                });
                node.entry_kind = entry_kind;
                node.change = change;
                node.ignored = ignored;
                node.deferred = deferred;
            } else {
                node.kind = Some(TreeNodeKind::Directory);
            }
            level = &mut node.children;
        }
    }
    roots.into_values().map(finish_tree_node).collect()
}

fn finish_tree_node(node: MutableTreeNode) -> Result<TreeNode, RepositoryPortError> {
    let path = RepositoryRelativePath::parse(node.path.clone())
        .map_err(|_| RepositoryPortError::InvalidRepositoryPath)?;
    let kind = node.kind.unwrap_or(TreeNodeKind::Directory);
    let children = if node.deferred && kind == TreeNodeKind::Directory {
        TreeChildren::Deferred {
            node_id: tree_node_id(&node.path),
        }
    } else {
        TreeChildren::Loaded(
            node.children
                .into_values()
                .map(finish_tree_node)
                .collect::<Result<Vec<_>, _>>()?,
        )
    };
    Ok(TreeNode {
        path,
        name: node.name,
        kind,
        entry_kind: node.entry_kind,
        change: node.change,
        ignored: node.ignored,
        children,
    })
}

fn similarity_warnings(files: &[DiffFile]) -> Vec<RepositoryWarning> {
    let candidates = files
        .iter()
        .filter(|file| {
            matches!(
                file.change,
                FileChangeKind::Added | FileChangeKind::Deleted | FileChangeKind::Untracked
            )
        })
        .count();
    if candidates > 1000 {
        vec![RepositoryWarning::SimilarityDetectionLimit]
    } else {
        vec![]
    }
}

fn changed_tree(files: &[DiffFile]) -> Result<Vec<TreeNode>, RepositoryPortError> {
    build_tree(files.iter().filter_map(|file| {
        file.new_path
            .as_ref()
            .or(file.old_path.as_ref())
            .cloned()
            .map(|path| (path, Some(file.entry_kind), Some(file.change), false, false))
    }))
}

fn all_tree(
    paths: &[RepositoryRelativePath],
    ignored: &[RepositoryRelativePath],
    ignored_directories: &[RepositoryRelativePath],
    changed: &[DiffFile],
) -> Result<Vec<TreeNode>, RepositoryPortError> {
    let ignored = ignored.iter().cloned().collect::<BTreeSet<_>>();
    let ignored_directories = ignored_directories.iter().cloned().collect::<BTreeSet<_>>();
    let changed = changed
        .iter()
        .filter_map(|file| {
            file.new_path
                .as_ref()
                .or(file.old_path.as_ref())
                .map(|path| (path.clone(), (file.entry_kind, file.change)))
        })
        .collect::<BTreeMap<_, _>>();
    build_tree(paths.iter().cloned().map(|path| {
        let is_ignored = ignored.contains(&path);
        let metadata = changed.get(&path).copied();
        let deferred = ignored_directories.contains(&path);
        (
            path,
            metadata.map(|value| value.0),
            metadata.map(|value| value.1),
            is_ignored,
            deferred,
        )
    }))
}

fn frame_file(hasher: &mut Sha256, path: &Path) -> Result<(), RepositoryPortError> {
    let mut file = fs::File::open(path).map_err(map_filesystem_error)?;
    let before = file.metadata().map_err(map_filesystem_error)?;
    hasher.update(before.len().to_be_bytes());
    let mut total = 0_u64;
    let mut chunk = [0_u8; 64 * 1024];
    loop {
        let read = file.read(&mut chunk).map_err(map_filesystem_error)?;
        if read == 0 {
            break;
        }
        total += read as u64;
        hasher.update(&chunk[..read]);
    }
    let after = file.metadata().map_err(map_filesystem_error)?;
    if total != before.len()
        || before.len() != after.len()
        || before.modified().ok() != after.modified().ok()
    {
        return Err(RepositoryPortError::EntryChangedDuringRead);
    }
    Ok(())
}

fn frame(hasher: &mut Sha256, bytes: &[u8]) {
    hasher.update((bytes.len() as u64).to_be_bytes());
    hasher.update(bytes);
}

fn parse_ignored_cursor(
    cursor: &str,
    expected_snapshot: &str,
    expected_node: &str,
    current_fingerprint: &str,
) -> Result<usize, RepositoryPortError> {
    let value = cursor
        .strip_prefix("ic1_")
        .ok_or(RepositoryPortError::InvalidCursor)?;
    let mut fields = value.split('-');
    let snapshot = fields.next().ok_or(RepositoryPortError::InvalidCursor)?;
    let node = fields.next().ok_or(RepositoryPortError::InvalidCursor)?;
    let fingerprint = fields.next().ok_or(RepositoryPortError::InvalidCursor)?;
    let offset = fields.next().ok_or(RepositoryPortError::InvalidCursor)?;
    if fields.next().is_some() || snapshot != expected_snapshot || node != expected_node {
        return Err(RepositoryPortError::InvalidCursor);
    }
    if fingerprint.len() != 64 || !fingerprint.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(RepositoryPortError::InvalidCursor);
    }
    if fingerprint != current_fingerprint {
        return Err(RepositoryPortError::StaleCursor);
    }
    offset
        .parse()
        .map_err(|_| RepositoryPortError::InvalidCursor)
}

fn parse_file_history(bytes: &[u8], limit: usize) -> Result<SpecFileHistory, RepositoryPortError> {
    let mut items = bytes
        .split(|byte| *byte == 10)
        .filter(|line| !line.is_empty())
        .map(|line| {
            let fields = line.splitn(3, |byte| *byte == 0).collect::<Vec<_>>();
            if fields.len() != 3 || fields[1].is_empty() {
                return Err(RepositoryPortError::InvalidHistoryOutput);
            }
            let sha = std::str::from_utf8(fields[0])
                .map_err(|_| RepositoryPortError::InvalidHistoryOutput)?;
            let committed_at = std::str::from_utf8(fields[1])
                .map_err(|_| RepositoryPortError::InvalidHistoryOutput)?;
            let committed_at = DateTime::parse_from_rfc3339(committed_at)
                .map_err(|_| RepositoryPortError::InvalidHistoryOutput)?;
            Ok(SpecFileCommit {
                commit: CommitSha::parse(sha)
                    .map_err(|_| RepositoryPortError::InvalidHistoryOutput)?,
                committed_at,
                message: String::from_utf8_lossy(fields[2]).into_owned(),
            })
        })
        .collect::<Result<Vec<_>, RepositoryPortError>>()?;
    let truncated = items.len() > limit;
    items.truncate(limit);
    Ok(SpecFileHistory { items, truncated })
}

fn parse_diff_statuses(raw: &[u8]) -> Result<Vec<DiffFileSides>, RepositoryPortError> {
    let mut fields = raw
        .split(|byte| *byte == 0)
        .filter(|value| !value.is_empty());
    let mut changes = Vec::new();
    while let Some(status) = fields.next() {
        let code = *status
            .first()
            .ok_or(RepositoryPortError::InvalidRepositoryPath)? as char;
        let parse_path = |value: &[u8]| {
            let value = std::str::from_utf8(value)
                .map_err(|_| RepositoryPortError::UnsupportedPathEncoding)?;
            RepositoryRelativePath::parse(value)
                .map_err(|_| RepositoryPortError::InvalidRepositoryPath)
        };
        let change = match code {
            'R' | 'C' => {
                let old_path = parse_path(
                    fields
                        .next()
                        .ok_or(RepositoryPortError::InvalidRepositoryPath)?,
                )?;
                let new_path = parse_path(
                    fields
                        .next()
                        .ok_or(RepositoryPortError::InvalidRepositoryPath)?,
                )?;
                let similarity = std::str::from_utf8(&status[1..])
                    .ok()
                    .and_then(|value| value.parse().ok());
                if code == 'R' {
                    DiffFileSides::Renamed {
                        old_path,
                        new_path,
                        similarity,
                        old_mode: None,
                        new_mode: None,
                    }
                } else {
                    DiffFileSides::Copied {
                        old_path,
                        new_path,
                        similarity,
                        old_mode: None,
                        new_mode: None,
                    }
                }
            }
            'A' => DiffFileSides::Added {
                new_path: parse_path(
                    fields
                        .next()
                        .ok_or(RepositoryPortError::InvalidRepositoryPath)?,
                )?,
                new_mode: None,
            },
            'D' => DiffFileSides::Deleted {
                old_path: parse_path(
                    fields
                        .next()
                        .ok_or(RepositoryPortError::InvalidRepositoryPath)?,
                )?,
                old_mode: None,
            },
            'M' => DiffFileSides::Modified {
                path: parse_path(
                    fields
                        .next()
                        .ok_or(RepositoryPortError::InvalidRepositoryPath)?,
                )?,
                old_mode: None,
                new_mode: None,
            },
            'T' => DiffFileSides::TypeChanged {
                path: parse_path(
                    fields
                        .next()
                        .ok_or(RepositoryPortError::InvalidRepositoryPath)?,
                )?,
                old_mode: None,
                new_mode: None,
            },
            _ => return Err(RepositoryPortError::UnsupportedDiffStatus { code }),
        };
        changes.push(change);
    }
    Ok(changes)
}

fn parse_git_file_mode(value: &str) -> Result<GitFileMode, RepositoryPortError> {
    if value.len() != 6 || !value.bytes().all(|byte| byte.is_ascii_digit()) {
        return Err(RepositoryPortError::InvalidRepositoryPath);
    }
    match value
        .parse::<u32>()
        .map_err(|_| RepositoryPortError::InvalidRepositoryPath)?
    {
        100_644 => Ok(GitFileMode::Regular),
        100_755 => Ok(GitFileMode::Executable),
        120_000 => Ok(GitFileMode::Symlink),
        160_000 => Ok(GitFileMode::Submodule),
        40_000 => Ok(GitFileMode::Directory),
        _ => Err(RepositoryPortError::InvalidRepositoryPath),
    }
}

fn entry_kind_for_modes(
    old_mode: Option<GitFileMode>,
    new_mode: Option<GitFileMode>,
) -> Result<EntryKind, RepositoryPortError> {
    if old_mode == Some(GitFileMode::Directory) || new_mode == Some(GitFileMode::Directory) {
        return Err(RepositoryPortError::InvalidRepositoryPath);
    }
    match new_mode.or(old_mode) {
        Some(mode) => mode
            .entry_kind()
            .ok_or(RepositoryPortError::InvalidRepositoryPath),
        None => Ok(EntryKind::Regular),
    }
}

fn parse_mode_map(bytes: &[u8]) -> Result<BTreeMap<String, GitFileMode>, RepositoryPortError> {
    let mut modes = BTreeMap::new();
    for record in bytes
        .split(|byte| *byte == 0)
        .filter(|record| !record.is_empty())
    {
        let tab = record
            .iter()
            .position(|byte| *byte == b'\t')
            .ok_or(RepositoryPortError::InvalidRepositoryPath)?;
        let metadata = std::str::from_utf8(&record[..tab])
            .map_err(|_| RepositoryPortError::UnsupportedPathEncoding)?;
        let mode = metadata
            .split_ascii_whitespace()
            .next()
            .ok_or(RepositoryPortError::InvalidRepositoryPath)?;
        let raw_path = &record[tab + 1..];
        let value = std::str::from_utf8(raw_path)
            .map_err(|_| RepositoryPortError::UnsupportedPathEncoding)?;
        let path = RepositoryRelativePath::parse(value)
            .map_err(|_| RepositoryPortError::InvalidRepositoryPath)?;
        modes.insert(path.as_str().to_string(), parse_git_file_mode(mode)?);
    }
    Ok(modes)
}

fn untracked_patch(text: &str) -> Option<String> {
    let line_count = text.lines().count();
    let mut patch = format!("@@ -0,0 +1,{line_count} @@\n");
    for line in text.lines() {
        patch.push('+');
        patch.push_str(line);
        patch.push('\n');
        if patch.len() > PATCH_LIMIT {
            return None;
        }
    }
    Some(patch)
}

fn parse_structured_diff(bytes: &[u8]) -> StructuredDiff {
    if bytes.len() > PATCH_LIMIT {
        return StructuredDiff::Omitted {
            reason: OmissionReason::DiffLimit,
        };
    }
    let Ok(text) = std::str::from_utf8(bytes) else {
        return StructuredDiff::Omitted {
            reason: OmissionReason::Binary,
        };
    };
    let mut hunks = Vec::new();
    let mut current: Option<DiffHunk> = None;
    for line in text.lines() {
        if line.starts_with("@@") {
            if let Some(hunk) = current.take() {
                hunks.push(hunk);
            }
            current = Some(DiffHunk {
                header: line.to_string(),
                lines: Vec::new(),
            });
            continue;
        }
        let Some(hunk) = current.as_mut() else {
            continue;
        };
        let (kind, text) = if let Some(text) = line.strip_prefix('+') {
            (DiffLineKind::Added, text)
        } else if let Some(text) = line.strip_prefix('-') {
            (DiffLineKind::Removed, text)
        } else if let Some(text) = line.strip_prefix(' ') {
            (DiffLineKind::Context, text)
        } else if line.starts_with("\\ No newline") {
            (DiffLineKind::NoNewline, line)
        } else {
            continue;
        };
        hunk.lines.push(DiffLine {
            kind,
            text: text.to_string(),
        });
    }
    if let Some(hunk) = current {
        hunks.push(hunk);
    }
    if hunks.iter().map(|hunk| hunk.lines.len()).sum::<usize>() > 20_000 {
        StructuredDiff::Omitted {
            reason: OmissionReason::DiffLimit,
        }
    } else {
        StructuredDiff::Available(hunks)
    }
}

fn ensure_parent_boundary(root: &Path, target: &Path) -> Result<(), RepositoryPortError> {
    let parent = target
        .parent()
        .ok_or(RepositoryPortError::InvalidRepositoryPath)?;
    let canonical_parent = fs::canonicalize(parent).map_err(map_filesystem_error)?;
    if !canonical_parent.starts_with(root) {
        return Err(RepositoryPortError::InvalidRepositoryPath);
    }
    Ok(())
}

fn map_filesystem_error(error: std::io::Error) -> RepositoryPortError {
    if error.kind() == std::io::ErrorKind::PermissionDenied {
        RepositoryPortError::PermissionDenied
    } else {
        RepositoryPortError::EntryChangedDuringRead
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn git_mode_parser_accepts_only_canonical_modes() {
        let modes = parse_mode_map(
            b"100644 blob a\tregular\0\
100755 blob b\texecutable\0\
120000 blob c\tsymlink\0\
160000 commit d\tsubmodule\0\
040000 tree e\tdirectory\0",
        )
        .unwrap();

        assert_eq!(modes["regular"], GitFileMode::Regular);
        assert_eq!(modes["executable"], GitFileMode::Executable);
        assert_eq!(modes["symlink"], GitFileMode::Symlink);
        assert_eq!(modes["submodule"], GitFileMode::Submodule);
        assert_eq!(modes["directory"], GitFileMode::Directory);
        assert_eq!(
            parse_mode_map(b"100600 blob a\tunsupported\0"),
            Err(RepositoryPortError::InvalidRepositoryPath)
        );
        assert_eq!(
            entry_kind_for_modes(None, Some(GitFileMode::Directory)),
            Err(RepositoryPortError::InvalidRepositoryPath)
        );
        assert_eq!(
            entry_kind_for_modes(Some(GitFileMode::Regular), Some(GitFileMode::Submodule)),
            Ok(EntryKind::Submodule)
        );
    }

    #[test]
    fn diff_status_parser_handles_modified_explicitly_and_fails_closed() {
        let parsed = parse_diff_statuses(b"M\0changed.rs\0").unwrap();
        assert_eq!(
            parsed,
            vec![DiffFileSides::Modified {
                path: RepositoryRelativePath::parse("changed.rs").unwrap(),
                old_mode: None,
                new_mode: None,
            }]
        );

        for code in ['U', 'X', 'Q'] {
            let raw = [vec![code as u8, 0], b"changed.rs\0".to_vec()].concat();
            assert_eq!(
                parse_diff_statuses(&raw),
                Err(RepositoryPortError::UnsupportedDiffStatus { code })
            );
        }
    }

    #[test]
    fn file_history_parser_types_timestamps_and_rejects_invalid_values() {
        let sha = "a".repeat(40);
        let timestamp = "2026-08-23T12:34:56+09:30";
        let valid = format!("{sha}\0{timestamp}\0message\n");
        let history = parse_file_history(valid.as_bytes(), 50).unwrap();
        assert_eq!(
            history.items[0].committed_at.to_rfc3339(),
            "2026-08-23T12:34:56+09:30"
        );

        let invalid = format!("{sha}\0not-a-timestamp\0message\n");
        assert_eq!(
            parse_file_history(invalid.as_bytes(), 50),
            Err(RepositoryPortError::InvalidHistoryOutput)
        );
    }

    #[test]
    fn diff_comment_context_requires_full_identity_and_snapshot_file_matrix() {
        use crate::domain::comment::diff::{DiffAnchorPaths, DiffAnchorTarget, DiffSide};
        use std::num::NonZeroU32;

        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "spec-viewer-comment-context-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(&root).unwrap();
        git(&root, &["init", "-b", "main"]);
        git(&root, &["config", "user.name", "Spec Viewer"]);
        git(&root, &["config", "user.email", "fixture.invalid"]);
        write(&root, "changed.rs", "base\n");
        write(&root, "unchanged.rs", "same\n");
        write(&root, "old.rs", "renamed\n");
        write(&root, "deleted.rs", "gone\n");
        write(&root, "binary.dat", "text\n");
        write(&root, "large.txt", "small\n");
        write(&root, "copy-source.rs", &"copy source\n".repeat(20));
        write(&root, "unsupported", "file\n");
        git(&root, &["add", "."]);
        git(&root, &["commit", "-m", "base"]);
        git(&root, &["switch", "-c", "feature"]);
        write(&root, "changed.rs", "current\n");
        git(&root, &["mv", "old.rs", "new.rs"]);
        fs::remove_file(root.join("deleted.rs")).unwrap();
        fs::write(root.join("binary.dat"), b"binary\0value").unwrap();
        fs::write(root.join("large.txt"), vec![b'x'; CONTENT_LIMIT + 1]).unwrap();
        fs::copy(root.join("copy-source.rs"), root.join("copy-one.rs")).unwrap();
        fs::copy(root.join("copy-source.rs"), root.join("copy-two.rs")).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::symlink;
            fs::remove_file(root.join("unsupported")).unwrap();
            symlink("changed.rs", root.join("unsupported")).unwrap();
        }

        let adapter = GitRepositoryAdapter::default();
        let worktree = WorktreeId::new(root.to_string_lossy()).unwrap();
        let main = ValidatedRefName::parse("main").unwrap();
        let overview = adapter.load_overview(&worktree, Some(&main)).unwrap();
        let identity = overview.diff_review_identity.unwrap();
        {
            let mut contexts = adapter.diff_worktrees.lock().unwrap();
            let key = GitRepositoryAdapter::diff_worktree_key(&identity);
            let context = contexts.get_mut(&key).unwrap();
            context.changed.retain(|file| {
                !file
                    .new_path
                    .as_ref()
                    .is_some_and(|path| matches!(path.as_str(), "copy-one.rs" | "copy-two.rs"))
            });
            for target in ["copy-one.rs", "copy-two.rs"] {
                context.changed.push(
                    DiffFile::new(
                        DiffFileSides::Copied {
                            old_path: RepositoryRelativePath::parse("copy-source.rs").unwrap(),
                            new_path: RepositoryRelativePath::parse(target).unwrap(),
                            similarity: Some(100),
                            old_mode: Some(GitFileMode::Regular),
                            new_mode: Some(GitFileMode::Regular),
                        },
                        DiffFileMetadata::new(EntryKind::Regular, ContentClassification::Text),
                    )
                    .unwrap(),
                );
            }
        }
        let context = adapter.diff_comment_resolution_context(&identity).unwrap();
        let unchanged = DiffAnchorTarget::new(
            DiffAnchorPaths::Current {
                new_path: RepositoryRelativePath::parse("unchanged.rs").unwrap(),
                old_path: None,
            },
            NonZeroU32::new(1).unwrap(),
        );
        assert!(adapter
            .validate_diff_comment_target(&context, &unchanged)
            .is_ok());
        let arbitrary = DiffAnchorTarget::new(
            DiffAnchorPaths::Current {
                new_path: RepositoryRelativePath::parse("missing.rs").unwrap(),
                old_path: None,
            },
            NonZeroU32::new(1).unwrap(),
        );
        assert_eq!(
            adapter.validate_diff_comment_target(&context, &arbitrary),
            Err(RepositoryPortError::InvalidRepositoryPath)
        );
        let historical_rename = DiffAnchorTarget::new(
            DiffAnchorPaths::Current {
                new_path: RepositoryRelativePath::parse("old.rs").unwrap(),
                old_path: None,
            },
            NonZeroU32::new(1).unwrap(),
        );
        let relocated = adapter
            .resolve_diff_comment_target(&context, &historical_rename)
            .unwrap();
        assert_eq!(relocated.selection_path().as_str(), "new.rs");
        assert_eq!(relocated.side_path().as_str(), "new.rs");
        let deleted = DiffAnchorTarget::new(
            DiffAnchorPaths::Current {
                new_path: RepositoryRelativePath::parse("deleted.rs").unwrap(),
                old_path: None,
            },
            NonZeroU32::new(1).unwrap(),
        );
        assert_eq!(
            adapter.resolve_diff_comment_target(&context, &deleted),
            Err(
                crate::domain::comment::diff_repository::DiffCommentResolutionError::Stale {
                    reason: crate::domain::comment::diff::StaleAnchorReason::Deleted,
                    candidate_count: 0,
                }
            )
        );
        assert_eq!(
            adapter.resolve_diff_comment_target(&context, &arbitrary),
            Err(
                crate::domain::comment::diff_repository::DiffCommentResolutionError::Stale {
                    reason: crate::domain::comment::diff::StaleAnchorReason::PathMissing,
                    candidate_count: 0,
                }
            )
        );
        let current_target = |path: &str| {
            DiffAnchorTarget::new(
                DiffAnchorPaths::Current {
                    new_path: RepositoryRelativePath::parse(path).unwrap(),
                    old_path: None,
                },
                NonZeroU32::new(1).unwrap(),
            )
        };
        assert_eq!(
            adapter.resolve_diff_comment_target(&context, &current_target("binary.dat")),
            Err(
                crate::domain::comment::diff_repository::DiffCommentResolutionError::Stale {
                    reason: crate::domain::comment::diff::StaleAnchorReason::Binary,
                    candidate_count: 0,
                }
            )
        );
        #[cfg(unix)]
        assert_eq!(
            adapter.resolve_diff_comment_target(&context, &current_target("unsupported")),
            Err(
                crate::domain::comment::diff_repository::DiffCommentResolutionError::Stale {
                    reason: crate::domain::comment::diff::StaleAnchorReason::Unsupported,
                    candidate_count: 0,
                }
            )
        );
        assert_eq!(
            adapter.resolve_diff_comment_target(&context, &current_target("copy-source.rs")),
            Ok(current_target("copy-source.rs"))
        );
        let large = current_target("large.txt");
        assert!(adapter
            .resolve_diff_comment_target(&context, &large)
            .is_ok());
        assert_eq!(
            adapter.load_diff_comment_source(&context, DiffSide::Current, large.side_path()),
            Err(RepositoryPortError::ContentTooLarge)
        );
        let wrong_base = DiffReviewIdentity::new(
            identity.repository_id().clone(),
            identity.worktree_id().clone(),
            CommitSha::parse("f".repeat(40)).unwrap(),
            identity.current_snapshot_id().clone(),
        );
        assert_eq!(
            adapter.diff_comment_resolution_context(&wrong_base),
            Err(RepositoryPortError::StaleBase)
        );
        let wrong_repository = DiffReviewIdentity::new(
            RepositoryId::parse(format!("rr1_{}", "f".repeat(64))).unwrap(),
            identity.worktree_id().clone(),
            identity.base_sha().clone(),
            identity.current_snapshot_id().clone(),
        );
        assert_eq!(
            adapter.diff_comment_resolution_context(&wrong_repository),
            Err(RepositoryPortError::IdentityMismatch)
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn current_diff_comment_source_rejects_any_repository_snapshot_change_during_read() {
        use crate::domain::comment::diff::DiffSide;

        for change in ["other-file", "index", "head", "same-size-target"] {
            let nonce = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let root = std::env::temp_dir().join(format!(
                "spec-viewer-comment-source-snapshot-{change}-{}-{nonce}",
                std::process::id()
            ));
            fs::create_dir_all(&root).unwrap();
            git(&root, &["init", "-b", "main"]);
            git(&root, &["config", "user.name", "Spec Viewer"]);
            git(&root, &["config", "user.email", "fixture.invalid"]);
            write(&root, "target.rs", "aaaa\n");
            write(&root, "other.rs", "before\n");
            git(&root, &["add", "."]);
            git(&root, &["commit", "-m", "base"]);

            let adapter = GitRepositoryAdapter::default();
            let worktree = WorktreeId::new(root.to_string_lossy()).unwrap();
            let overview = adapter.load_overview(&worktree, None).unwrap();
            let identity = overview.diff_review_identity.unwrap();
            let context = adapter.diff_comment_resolution_context(&identity).unwrap();
            let target = RepositoryRelativePath::parse("target.rs").unwrap();

            let result = adapter.load_diff_comment_source_with_after_read(
                &context,
                DiffSide::Current,
                &target,
                || match change {
                    "other-file" => write(&root, "other.rs", "after\n"),
                    "index" => {
                        write(&root, "other.rs", "staged\n");
                        git(&root, &["add", "other.rs"]);
                    }
                    "head" => {
                        write(&root, "other.rs", "commit\n");
                        git(&root, &["add", "other.rs"]);
                        git(&root, &["commit", "-m", "changed head"]);
                    }
                    "same-size-target" => write(&root, "target.rs", "bbbb\n"),
                    _ => unreachable!(),
                },
            );

            assert_eq!(result, Err(RepositoryPortError::EntryChangedDuringRead));
            fs::remove_dir_all(root).unwrap();
        }
    }

    #[test]
    fn base_diff_comment_source_rejects_any_repository_snapshot_change_during_read() {
        use crate::domain::comment::diff::DiffSide;

        for change in ["other-file", "index", "head"] {
            let nonce = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let root = std::env::temp_dir().join(format!(
                "spec-viewer-base-comment-source-snapshot-{change}-{}-{nonce}",
                std::process::id()
            ));
            fs::create_dir_all(&root).unwrap();
            git(&root, &["init", "-b", "main"]);
            git(&root, &["config", "user.name", "Spec Viewer"]);
            git(&root, &["config", "user.email", "fixture.invalid"]);
            write(&root, "target.rs", "base\n");
            write(&root, "other.rs", "before\n");
            git(&root, &["add", "."]);
            git(&root, &["commit", "-m", "base"]);
            git(&root, &["switch", "-c", "feature"]);
            write(&root, "target.rs", "current\n");

            let adapter = GitRepositoryAdapter::default();
            let worktree = WorktreeId::new(root.to_string_lossy()).unwrap();
            let main = ValidatedRefName::parse("main").unwrap();
            let overview = adapter.load_overview(&worktree, Some(&main)).unwrap();
            let identity = overview.diff_review_identity.unwrap();
            let context = adapter.diff_comment_resolution_context(&identity).unwrap();
            let target = RepositoryRelativePath::parse("target.rs").unwrap();

            assert_eq!(
                adapter.load_diff_comment_source(&context, DiffSide::Base, &target),
                Ok("base\n".into())
            );

            let result = adapter.load_diff_comment_source_with_after_read(
                &context,
                DiffSide::Base,
                &target,
                || match change {
                    "other-file" => write(&root, "other.rs", "after\n"),
                    "index" => {
                        write(&root, "other.rs", "staged\n");
                        git(&root, &["add", "other.rs"]);
                    }
                    "head" => {
                        write(&root, "other.rs", "commit\n");
                        git(&root, &["add", "other.rs"]);
                        git(&root, &["commit", "-m", "changed head"]);
                    }
                    _ => unreachable!(),
                },
            );

            assert_eq!(result, Err(RepositoryPortError::EntryChangedDuringRead));
            fs::remove_dir_all(root).unwrap();
        }
    }

    #[test]
    fn working_tree_diff_covers_staged_deleted_renamed_empty_and_space_paths() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "spec-viewer-working-tree-edges-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(&root).unwrap();
        git(&root, &["init", "-b", "main"]);
        git(&root, &["config", "user.name", "Spec Viewer"]);
        git(&root, &["config", "user.email", "fixture.invalid"]);
        write(&root, "staged.md", "head staged\n");
        write(&root, "deleted.md", "head deleted\n");
        write(&root, "rename old.md", "rename content\n");
        write(&root, "space path.md", "head with newline\n");
        write(&root, "empty.md", "head nonempty\n");
        git(&root, &["add", "."]);
        git(&root, &["commit", "-m", "head"]);

        write(&root, "staged.md", "index version\n");
        git(&root, &["add", "staged.md"]);
        fs::remove_file(root.join("deleted.md")).unwrap();
        git(&root, &["mv", "rename old.md", "rename new.md"]);
        write(&root, "space path.md", "working without newline");
        write(&root, "empty.md", "");

        let adapter = GitRepositoryAdapter::default();
        let worktree = WorktreeId::new(root.to_string_lossy()).unwrap();
        let overview = adapter
            .load_working_tree_overview(&worktree, &ComparisonRevision::Head)
            .unwrap();
        assert_eq!(overview.changed.len(), 5);

        let detail = |path: &str| {
            adapter
                .load_working_tree_file(
                    &worktree,
                    &overview.current_snapshot_id,
                    &overview.resolved_base_sha,
                    &RepositoryRelativePath::parse(path).unwrap(),
                )
                .unwrap()
        };
        let staged = detail("staged.md");
        assert_eq!(
            staged.old_content,
            ContentAvailability::Available("head staged\n".into())
        );
        assert_eq!(
            staged.new_content,
            ContentAvailability::Available("index version\n".into())
        );

        let deleted = detail("deleted.md");
        assert_eq!(deleted.file.change, FileChangeKind::Deleted);
        assert_eq!(
            deleted.old_content,
            ContentAvailability::Available("head deleted\n".into())
        );
        assert!(matches!(
            deleted.new_content,
            ContentAvailability::Omitted {
                reason: OmissionReason::MissingSide,
                ..
            }
        ));
        let StructuredDiff::Available(deleted_hunks) = deleted.structured_diff else {
            panic!("deleted text must have a structured diff");
        };
        assert!(deleted_hunks
            .iter()
            .flat_map(|hunk| &hunk.lines)
            .any(|line| { line.kind == DiffLineKind::Removed && line.text == "head deleted" }));

        let renamed = detail("rename new.md");
        assert_eq!(renamed.file.change, FileChangeKind::Renamed);
        assert_eq!(
            renamed.file.old_path.as_ref().unwrap().as_str(),
            "rename old.md"
        );
        assert_eq!(
            renamed.file.new_path.as_ref().unwrap().as_str(),
            "rename new.md"
        );
        let ContentAvailability::Available(rename_patch) = &renamed.patch else {
            panic!("rename patch must be available");
        };
        assert!(rename_patch.contains("rename from rename old.md"));
        assert!(rename_patch.contains("rename to rename new.md"));

        let spaced = detail("space path.md");
        assert_eq!(
            spaced.new_content,
            ContentAvailability::Available("working without newline".into())
        );
        let StructuredDiff::Available(hunks) = spaced.structured_diff else {
            panic!("space path text must have a structured diff");
        };
        assert!(hunks
            .iter()
            .flat_map(|hunk| &hunk.lines)
            .any(|line| line.kind == DiffLineKind::NoNewline));

        let empty = detail("empty.md");
        assert_eq!(
            empty.new_content,
            ContentAvailability::Available(String::new())
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn poisoned_working_tree_context_returns_io() {
        let adapter = GitRepositoryAdapter::default();
        let poison = adapter.clone();
        let _ = std::thread::spawn(move || {
            let _guard = poison.working_tree_contexts.lock().unwrap();
            panic!("poison context store");
        })
        .join();
        let snapshot = SnapshotId::parse(format!("rs1_{}", "a".repeat(64))).unwrap();

        assert_eq!(
            adapter
                .working_tree_context(
                    Path::new("/repo"),
                    &snapshot,
                    &CommitSha::parse("a".repeat(40)).unwrap(),
                )
                .unwrap_err(),
            RepositoryPortError::Io
        );
    }
    #[test]
    fn working_tree_diff_uses_head_and_keeps_context_separate_from_merge_base() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "spec-viewer-working-tree-diff-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(&root).unwrap();
        git(&root, &["init", "-b", "main"]);
        git(&root, &["config", "user.name", "Spec Viewer"]);
        git(&root, &["config", "user.email", "fixture.invalid"]);
        write(&root, "specs/001/tasks.md", "head\n");
        git(&root, &["add", "."]);
        git(&root, &["commit", "-m", "head"]);
        write(&root, "specs/001/tasks.md", "working\n");
        write(&root, "specs/001/new.md", "new line\nsecond\n");

        let adapter = GitRepositoryAdapter::default();
        let worktree = WorktreeId::new(root.to_string_lossy()).unwrap();
        let overview = adapter
            .load_working_tree_overview(&worktree, &ComparisonRevision::Head)
            .unwrap();
        assert_eq!(overview.changed.len(), 2);

        let main = ValidatedRefName::parse("main").unwrap();
        adapter.load_overview(&worktree, Some(&main)).unwrap();

        let modified_path = RepositoryRelativePath::parse("specs/001/tasks.md").unwrap();
        let modified = adapter
            .load_working_tree_file(
                &worktree,
                &overview.current_snapshot_id,
                &overview.resolved_base_sha,
                &modified_path,
            )
            .unwrap();
        assert_eq!(
            modified.old_content,
            ContentAvailability::Available("head\n".into())
        );
        assert_eq!(
            modified.new_content,
            ContentAvailability::Available("working\n".into())
        );
        let StructuredDiff::Available(hunks) = modified.structured_diff else {
            panic!("text diff must be structured");
        };
        assert!(hunks
            .iter()
            .flat_map(|hunk| &hunk.lines)
            .any(|line| line.kind == DiffLineKind::Removed));
        assert!(hunks
            .iter()
            .flat_map(|hunk| &hunk.lines)
            .any(|line| line.kind == DiffLineKind::Added));

        let untracked_path = RepositoryRelativePath::parse("specs/001/new.md").unwrap();
        let untracked = adapter
            .load_working_tree_file(
                &worktree,
                &overview.current_snapshot_id,
                &overview.resolved_base_sha,
                &untracked_path,
            )
            .unwrap();
        let StructuredDiff::Available(hunks) = untracked.structured_diff else {
            panic!("untracked text must be structured");
        };
        assert!(hunks
            .iter()
            .flat_map(|hunk| &hunk.lines)
            .all(|line| line.kind == DiffLineKind::Added));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn working_tree_diff_reports_unborn_head() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "spec-viewer-unborn-head-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(&root).unwrap();
        git(&root, &["init", "-b", "main"]);

        let adapter = GitRepositoryAdapter::default();
        let worktree = WorktreeId::new(root.to_string_lossy()).unwrap();
        assert_eq!(
            adapter
                .load_working_tree_overview(&worktree, &ComparisonRevision::Head)
                .unwrap_err(),
            RepositoryPortError::UnbornHead
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn revision_catalog_history_and_arbitrary_baseline_use_resolved_commits() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "spec-viewer-revisions-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(&root).unwrap();
        git(&root, &["init", "-b", "main"]);
        git(&root, &["config", "user.name", "Spec Viewer"]);
        git(&root, &["config", "user.email", "fixture.invalid"]);
        write(&root, "specs/001/tasks.md", "first\n");
        git(&root, &["add", "."]);
        git(&root, &["commit", "-m", "first 日本語 🚀"]);

        let adapter = GitRepositoryAdapter::default();
        let worktree = WorktreeId::new(root.to_string_lossy()).unwrap();
        let first = adapter.working_tree_head(&root).unwrap();
        git(&root, &["branch", "same"]);
        git(&root, &["tag", "-a", "same", "-m", "annotated"]);
        write(&root, "specs/001/tasks.md", "second\n");
        git(&root, &["add", "."]);
        git(&root, &["commit", "-m", "second line"]);
        write(&root, "specs/001/tasks.md", "working\n");

        let revisions = adapter.list_comparison_revisions(&worktree).unwrap();
        assert!(matches!(revisions[0].revision, ComparisonRevision::Head));
        let branch = revisions
            .iter()
            .find(|option| {
                option.label == "same"
                    && matches!(option.revision, ComparisonRevision::LocalBranch(_))
            })
            .unwrap();
        let tag = revisions
            .iter()
            .find(|option| {
                option.label == "same" && matches!(option.revision, ComparisonRevision::Tag(_))
            })
            .unwrap();
        assert_eq!(branch.label, "same");
        assert_eq!(tag.label, "same");
        assert_eq!(branch.resolved_commit, first);
        assert_eq!(tag.resolved_commit, first);

        git(&root, &["branch", "-D", "same"]);
        let deleted_branch =
            ComparisonRevision::local_branch(ValidatedRefName::parse("refs/heads/same").unwrap())
                .unwrap();
        assert_eq!(
            adapter
                .resolve_comparison_revision(&root, &deleted_branch)
                .unwrap_err(),
            RepositoryPortError::RevisionNotFound
        );
        let blob = Command::new("git")
            .arg("-C")
            .arg(&root)
            .args(["hash-object", "-w", "specs/001/tasks.md"])
            .output()
            .unwrap();
        let blob = String::from_utf8(blob.stdout).unwrap();
        git(&root, &["update-ref", "refs/tags/blob", blob.trim()]);
        let blob_tag =
            ComparisonRevision::tag(ValidatedRefName::parse("refs/tags/blob").unwrap()).unwrap();
        assert_eq!(
            adapter
                .resolve_comparison_revision(&root, &blob_tag)
                .unwrap_err(),
            RepositoryPortError::RevisionNotCommit
        );

        let path = RepositoryRelativePath::parse("specs/001/tasks.md").unwrap();
        let history = adapter.list_file_history(&worktree, &path, 50).unwrap();
        assert_eq!(history.items.len(), 2);
        assert!(!history.truncated);
        assert_eq!(history.items[1].message, "first 日本語 🚀");

        let head_overview = adapter
            .load_working_tree_overview(&worktree, &ComparisonRevision::Head)
            .unwrap();
        let overview = adapter
            .load_working_tree_overview(&worktree, &ComparisonRevision::Commit(first.clone()))
            .unwrap();
        assert_eq!(
            overview.current_snapshot_id,
            head_overview.current_snapshot_id
        );
        assert_ne!(overview.resolved_base_sha, head_overview.resolved_base_sha);
        assert_eq!(overview.resolved_base_sha, first);
        let detail = adapter
            .load_working_tree_file(
                &worktree,
                &overview.current_snapshot_id,
                &overview.resolved_base_sha,
                &path,
            )
            .unwrap();
        assert_eq!(
            detail.old_content,
            ContentAvailability::Available("first\n".into())
        );
        assert_eq!(
            detail.new_content,
            ContentAvailability::Available("working\n".into())
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn file_history_limits_results_and_reports_truncation() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "spec-viewer-history-limit-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(&root).unwrap();
        git(&root, &["init", "-b", "main"]);
        git(&root, &["config", "user.name", "Spec Viewer"]);
        git(&root, &["config", "user.email", "fixture.invalid"]);
        for index in 0..51 {
            write(&root, "history.md", &format!("{index}\n"));
            git(&root, &["add", "history.md"]);
            git(&root, &["commit", "-m", &format!("commit {index}")]);
            if index == 49 {
                let adapter = GitRepositoryAdapter::default();
                let worktree = WorktreeId::new(root.to_string_lossy()).unwrap();
                let path = RepositoryRelativePath::parse("history.md").unwrap();
                let history = adapter.list_file_history(&worktree, &path, 50).unwrap();
                assert_eq!(history.items.len(), 50);
                assert!(!history.truncated);
            }
        }

        let adapter = GitRepositoryAdapter::default();
        let worktree = WorktreeId::new(root.to_string_lossy()).unwrap();
        let path = RepositoryRelativePath::parse("history.md").unwrap();
        let history = adapter.list_file_history(&worktree, &path, 50).unwrap();
        assert_eq!(history.items.len(), 50);
        assert!(history.truncated);
        assert_eq!(history.items[0].message, "commit 50");
        assert_eq!(history.items[49].message, "commit 1");
        let missing = adapter
            .list_file_history(
                &worktree,
                &RepositoryRelativePath::parse("missing.md").unwrap(),
                50,
            )
            .unwrap();
        assert!(missing.items.is_empty());
        assert!(!missing.truncated);

        fs::remove_dir_all(root).unwrap();
    }

    use super::*;
    use std::{
        process::Command,
        time::{SystemTime, UNIX_EPOCH},
    };

    fn git(root: &Path, args: &[&str]) {
        let status = Command::new("git")
            .arg("-C")
            .arg(root)
            .args(args)
            .status()
            .expect("git starts");
        assert!(status.success(), "git {args:?}");
    }
    fn write(root: &Path, path: &str, text: &str) {
        let target = root.join(path);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(target, text).unwrap();
    }

    #[test]
    fn file_review_reuses_the_explicit_base_bound_to_snapshot() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "spec-viewer-explicit-base-context-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(&root).unwrap();
        git(&root, &["init", "-b", "main"]);
        git(&root, &["config", "user.name", "Spec Viewer"]);
        git(&root, &["config", "user.email", "fixture.invalid"]);
        write(&root, "root.txt", "root\n");
        git(&root, &["add", "."]);
        git(&root, &["commit", "-m", "root"]);
        git(&root, &["switch", "-c", "alternate"]);
        write(&root, "target.txt", "alternate base\n");
        git(&root, &["add", "."]);
        git(&root, &["commit", "-m", "alternate base"]);
        git(&root, &["switch", "-c", "feature"]);
        write(&root, "target.txt", "feature current\n");

        let adapter = GitRepositoryAdapter::default();
        let worktree = WorktreeId::new(root.to_string_lossy()).unwrap();
        let alternate = ValidatedRefName::parse("alternate").unwrap();
        let overview = adapter.load_overview(&worktree, Some(&alternate)).unwrap();
        let path = RepositoryRelativePath::parse("target.txt").unwrap();
        let file = overview
            .changed
            .iter()
            .find(|file| file.new_path.as_ref() == Some(&path))
            .unwrap();
        assert_eq!(file.change, FileChangeKind::Modified);
        let review = adapter
            .load_file(
                &worktree,
                overview.current_snapshot_id.as_ref().unwrap(),
                &path,
            )
            .unwrap();
        assert_eq!(
            review.old_content,
            ContentAvailability::Available("alternate base\n".into())
        );
        assert_eq!(
            review.new_content,
            ContentAvailability::Available("feature current\n".into())
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn file_review_reports_binary_and_large_omissions_independently() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "spec-viewer-content-omissions-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(&root).unwrap();
        git(&root, &["init", "-b", "main"]);
        git(&root, &["config", "user.name", "Spec Viewer"]);
        git(&root, &["config", "user.email", "fixture.invalid"]);
        write(&root, "binary.dat", "text base\n");
        write(&root, "large.txt", "small base\n");
        git(&root, &["add", "."]);
        git(&root, &["commit", "-m", "base"]);
        git(&root, &["switch", "-c", "feature"]);
        fs::write(root.join("binary.dat"), [b'a', 0, b'b']).unwrap();
        fs::write(root.join("large.txt"), vec![b'a'; CONTENT_LIMIT + 1]).unwrap();

        let adapter = GitRepositoryAdapter::default();
        let worktree = WorktreeId::new(root.to_string_lossy()).unwrap();
        let base = ValidatedRefName::parse("main").unwrap();
        let overview = adapter.load_overview(&worktree, Some(&base)).unwrap();
        let snapshot = overview.current_snapshot_id.as_ref().unwrap();
        let binary_path = RepositoryRelativePath::parse("binary.dat").unwrap();
        let binary_file = overview
            .changed
            .iter()
            .find(|file| file.new_path.as_ref() == Some(&binary_path))
            .unwrap();
        assert_eq!(
            binary_file.content_classification,
            ContentClassification::Binary
        );
        let binary = adapter
            .load_file(&worktree, snapshot, &binary_path)
            .unwrap();
        assert_eq!(
            binary.old_content,
            ContentAvailability::Available("text base\n".into())
        );
        assert!(matches!(
            binary.new_content,
            ContentAvailability::Omitted {
                reason: OmissionReason::Binary,
                ..
            }
        ));
        assert_eq!(
            binary.structured_diff,
            StructuredDiff::Omitted {
                reason: OmissionReason::Binary
            }
        );

        let large_path = RepositoryRelativePath::parse("large.txt").unwrap();
        let large = adapter.load_file(&worktree, snapshot, &large_path).unwrap();
        assert_eq!(
            large.old_content,
            ContentAvailability::Available("small base\n".into())
        );
        assert_eq!(
            large.new_content,
            ContentAvailability::Omitted {
                reason: OmissionReason::LargeFile,
                byte_length: Some((CONTENT_LIMIT + 1) as u64),
            }
        );
        assert_eq!(
            large.structured_diff,
            StructuredDiff::Omitted {
                reason: OmissionReason::LargeFile
            }
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn similarity_limit_warning_is_independent_from_snapshot_identity() {
        let path = RepositoryRelativePath::parse("candidate.txt").unwrap();
        let candidate = DiffFile {
            old_path: None,
            new_path: Some(path),
            change: FileChangeKind::Added,
            entry_kind: EntryKind::Regular,
            content_classification: ContentClassification::Text,
            similarity: None,
            old_mode: None,
            new_mode: Some(GitFileMode::Regular),
        };
        assert!(similarity_warnings(&vec![candidate.clone(); 1000]).is_empty());
        assert_eq!(
            similarity_warnings(&vec![candidate; 1001]),
            vec![RepositoryWarning::SimilarityDetectionLimit]
        );
    }

    #[test]
    fn content_limits_and_binary_probe_match_exact_boundaries() {
        assert!(matches!(
            GitRepositoryAdapter::side(Some(vec![b'a'; CONTENT_LIMIT])),
            ContentAvailability::Available(_)
        ));
        assert_eq!(
            GitRepositoryAdapter::side(Some(vec![b'a'; CONTENT_LIMIT + 1])),
            ContentAvailability::Omitted {
                reason: OmissionReason::LargeFile,
                byte_length: Some((CONTENT_LIMIT + 1) as u64),
            }
        );
        let mut binary = vec![b'a'; 8192];
        binary[8191] = 0;
        assert_eq!(
            GitRepositoryAdapter::side(Some(binary)),
            ContentAvailability::Omitted {
                reason: OmissionReason::Binary,
                byte_length: Some(8192),
            }
        );
        let mut nul_after_probe = vec![b'a'; 8193];
        nul_after_probe[8192] = 0;
        assert!(matches!(
            GitRepositoryAdapter::side(Some(nul_after_probe)),
            ContentAvailability::Available(_)
        ));
    }

    #[test]
    fn structured_diff_is_atomic_at_byte_and_line_limits() {
        let patch = b"diff --git a/a b/a\n@@ -1,2 +1,2 @@\n-old\n+new\n context\n";
        let StructuredDiff::Available(hunks) = parse_structured_diff(patch) else {
            panic!("small text patch must be available");
        };
        assert_eq!(hunks.len(), 1);
        assert_eq!(hunks[0].lines.len(), 3);
        assert_eq!(hunks[0].lines[0].kind, DiffLineKind::Removed);
        assert_eq!(hunks[0].lines[1].kind, DiffLineKind::Added);

        assert!(matches!(
            parse_structured_diff(&vec![b'x'; PATCH_LIMIT]),
            StructuredDiff::Available(_)
        ));
        assert_eq!(
            parse_structured_diff(&vec![b'x'; PATCH_LIMIT + 1]),
            StructuredDiff::Omitted {
                reason: OmissionReason::DiffLimit
            }
        );
        let exact_line_limit = format!("@@ -0,0 +1,20000 @@\n{}", "+x\n".repeat(20_000));
        assert!(matches!(
            parse_structured_diff(exact_line_limit.as_bytes()),
            StructuredDiff::Available(_)
        ));
        let too_many_lines = format!("@@ -0,0 +1,20001 @@\n{}", "+x\n".repeat(20_001));
        assert_eq!(
            parse_structured_diff(too_many_lines.as_bytes()),
            StructuredDiff::Omitted {
                reason: OmissionReason::DiffLimit
            }
        );
    }

    fn r199_snapshot_fixture() -> (PathBuf, WorktreeId, RepositoryOverview) {
        let root = std::env::temp_dir().join(format!(
            "spec-viewer-r199-{}-{}",
            std::process::id(),
            uuid::Uuid::new_v4()
        ));
        fs::create_dir_all(&root).unwrap();
        git(&root, &["init", "-b", "main"]);
        git(&root, &["config", "user.name", "Spec Viewer"]);
        git(&root, &["config", "user.email", "fixture.invalid"]);
        for path in ["committed.txt", "staged.txt", "unstaged.txt", "deleted.txt"] {
            write(&root, path, "base\n");
        }
        write(&root, ".gitignore", "generated/\n");
        git(&root, &["add", "."]);
        git(&root, &["commit", "-m", "base"]);
        git(&root, &["switch", "-c", "feature"]);
        write(&root, "committed.txt", "committed\n");
        git(&root, &["add", "committed.txt"]);
        git(&root, &["commit", "-m", "feature"]);
        write(&root, "staged.txt", "staged\n");
        git(&root, &["add", "staged.txt"]);
        write(&root, "unstaged.txt", "unstaged\n");
        write(&root, "added.txt", "added\n");
        fs::remove_file(root.join("deleted.txt")).unwrap();
        write(&root, "generated/ignored.txt", "ignored\n");
        let worktree = WorktreeId::new(root.to_string_lossy()).unwrap();
        let overview = GitRepositoryAdapter::default()
            .load_overview(&worktree, Some(&ValidatedRefName::parse("main").unwrap()))
            .unwrap();
        (root, worktree, overview)
    }
    fn r199_changed(overview: &RepositoryOverview, path: &str, kind: FileChangeKind) -> bool {
        overview.changed.iter().any(|file| {
            file.change == kind
                && file
                    .new_path
                    .as_ref()
                    .or(file.old_path.as_ref())
                    .is_some_and(|value| value.as_str() == path)
        })
    }
    macro_rules! r199_snapshot_test {
        ($name:ident, $body:expr) => {
            #[test]
            fn $name() {
                let (root, worktree, overview) = r199_snapshot_fixture();
                ($body)(&worktree, &overview);
                fs::remove_dir_all(root).unwrap();
            }
        };
    }
    r199_snapshot_test!(
        r199_tree_001_added,
        |_, overview: &RepositoryOverview| assert!(r199_changed(
            overview,
            "added.txt",
            FileChangeKind::Untracked
        ))
    );
    r199_snapshot_test!(
        r199_tree_007_modified,
        |_, overview: &RepositoryOverview| assert!(r199_changed(
            overview,
            "unstaged.txt",
            FileChangeKind::Modified
        ))
    );
    r199_snapshot_test!(
        r199_tree_008_deleted,
        |_, overview: &RepositoryOverview| assert!(r199_changed(
            overview,
            "deleted.txt",
            FileChangeKind::Deleted
        ))
    );
    r199_snapshot_test!(
        r199_tree_009_untracked,
        |_, overview: &RepositoryOverview| assert!(r199_changed(
            overview,
            "added.txt",
            FileChangeKind::Untracked
        ))
    );
    r199_snapshot_test!(
        r199_tree_010_ignored,
        |_, overview: &RepositoryOverview| assert!(overview
            .ignored_directories
            .iter()
            .any(|path| path.as_str() == "generated"))
    );
    r199_snapshot_test!(
        r199_tree_005_git_boundary,
        |_, overview: &RepositoryOverview| assert!(overview
            .all_paths
            .iter()
            .all(|path| path.as_str() != ".git" && !path.as_str().starts_with(".git/")))
    );
    r199_snapshot_test!(
        r199_tree_006_generated_changed_excluded,
        |_, overview: &RepositoryOverview| assert!(overview.changed.iter().all(|file| !file
            .new_path
            .as_ref()
            .or(file.old_path.as_ref())
            .is_some_and(|path| path.as_str().starts_with("generated/"))))
    );
    r199_snapshot_test!(
        r199_tree_013_generated_all_deferred,
        |_, overview: &RepositoryOverview| {
            let node = overview
                .all_root
                .iter()
                .find(|node| node.path.as_str() == "generated")
                .unwrap();
            assert!(node.ignored && matches!(node.children, TreeChildren::Deferred { .. }));
        }
    );
    r199_snapshot_test!(
        r199_git_018_committed,
        |_, overview: &RepositoryOverview| assert!(r199_changed(
            overview,
            "committed.txt",
            FileChangeKind::Modified
        ))
    );
    r199_snapshot_test!(
        r199_git_019_staged,
        |_, overview: &RepositoryOverview| assert!(r199_changed(
            overview,
            "staged.txt",
            FileChangeKind::Modified
        ))
    );
    r199_snapshot_test!(
        r199_git_020_unstaged,
        |_, overview: &RepositoryOverview| assert!(r199_changed(
            overview,
            "unstaged.txt",
            FileChangeKind::Modified
        ))
    );
    r199_snapshot_test!(r199_git_021_combined, |_, overview: &RepositoryOverview| {
        for path in ["committed.txt", "staged.txt", "unstaged.txt"] {
            assert_eq!(
                overview
                    .changed
                    .iter()
                    .filter(|file| file
                        .new_path
                        .as_ref()
                        .or(file.old_path.as_ref())
                        .is_some_and(|value| value.as_str() == path))
                    .count(),
                1
            );
        }
    });
    r199_snapshot_test!(r199_git_022_non_spec, |_, overview: &RepositoryOverview| {
        let file = overview
            .changed
            .iter()
            .find(|file| {
                file.new_path
                    .as_ref()
                    .is_some_and(|path| path.as_str() == "unstaged.txt")
            })
            .unwrap();
        assert_eq!(file.entry_kind, EntryKind::Regular);
        assert_eq!(file.content_classification, ContentClassification::Text);
    });

    #[test]
    fn overview_unifies_committed_staged_unstaged_and_untracked_changes() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "spec-viewer-git-fixture-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(&root).unwrap();
        git(&root, &["init", "-b", "main"]);
        git(&root, &["config", "user.name", "Spec Viewer"]);
        git(&root, &["config", "user.email", "fixture@example.invalid"]);
        write(&root, "committed.txt", "base\n");
        write(&root, "staged.txt", "base\n");
        write(&root, "unstaged.txt", "base\n");
        write(&root, "unchanged.txt", "same first\nsame second\n");
        write(&root, ".gitignore", "generated/\nignored.log\n");
        git(&root, &["add", "."]);
        git(&root, &["commit", "-m", "base"]);
        git(&root, &["switch", "-c", "feature"]);
        write(&root, "committed.txt", "commit\n");
        git(&root, &["add", "committed.txt"]);
        git(&root, &["commit", "-m", "feature"]);
        write(&root, "staged.txt", "stage\n");
        git(&root, &["add", "staged.txt"]);
        write(&root, "unstaged.txt", "worktree\n");
        write(&root, "untracked.txt", "new\n");
        write(&root, "ignored.log", "ignored root file\n");

        #[cfg(unix)]
        std::os::unix::fs::symlink("/outside/repository", root.join("outside-link")).unwrap();
        for index in 0..200 {
            write(
                &root,
                &format!("generated/item-{index:03}.txt"),
                "ignored\n",
            );
        }
        write(&root, "generated/nested/child.txt", "nested ignored\n");
        let adapter = GitRepositoryAdapter::default();
        let worktree = WorktreeId::new(root.to_string_lossy()).unwrap();
        let base = ValidatedRefName::parse("main").unwrap();
        let overview = adapter.load_overview(&worktree, Some(&base)).unwrap();

        assert!(overview.current_snapshot_id.is_some());
        let identity = overview.diff_review_identity.as_ref().unwrap();
        assert_eq!(identity.repository_id(), &overview.repository_id);
        assert_eq!(
            identity.current_snapshot_id(),
            overview.current_snapshot_id.as_ref().unwrap()
        );
        assert!(identity.worktree_id().as_str().starts_with("rw1_"));
        assert_eq!(
            overview.display_worktree_label,
            fs::canonicalize(&root).unwrap().to_string_lossy()
        );

        for expected in [
            "committed.txt",
            "staged.txt",
            "unstaged.txt",
            "untracked.txt",
        ] {
            assert!(
                overview.changed.iter().any(|file| {
                    file.new_path
                        .as_ref()
                        .or(file.old_path.as_ref())
                        .is_some_and(|path| path.as_str() == expected)
                }),
                "missing {expected}"
            );
        }
        assert_eq!(
            overview
                .changed
                .iter()
                .filter(|f| f.change == FileChangeKind::Untracked)
                .count(),
            if cfg!(unix) { 2 } else { 1 }
        );
        let first_snapshot = overview.current_snapshot_id.clone().unwrap();
        let generated = RepositoryRelativePath::parse("generated").unwrap();
        let generated_node_id = tree_node_id(generated.as_str());
        assert!(overview.ignored_directories.contains(&generated));
        assert!(overview
            .changed_tree
            .iter()
            .any(|node| node.path.as_str() == "committed.txt"));
        let generated_node = overview
            .all_root
            .iter()
            .find(|node| node.path == generated)
            .unwrap();
        assert!(generated_node.ignored);
        assert!(matches!(
            generated_node.children,
            TreeChildren::Deferred { .. }
        ));
        let ignored_file = overview
            .all_root
            .iter()
            .find(|node| node.path.as_str() == "ignored.log")
            .unwrap();
        assert_eq!(ignored_file.kind, TreeNodeKind::File);
        assert!(ignored_file.ignored);
        assert!(matches!(ignored_file.children, TreeChildren::Loaded(_)));
        assert!(overview
            .all_paths
            .iter()
            .all(|path| !path.as_str().starts_with("generated/")));
        let snapshot = overview.current_snapshot_id.as_ref().unwrap();
        #[cfg(unix)]
        {
            let link = overview
                .changed
                .iter()
                .find(|file| {
                    file.new_path
                        .as_ref()
                        .is_some_and(|path| path.as_str() == "outside-link")
                })
                .unwrap();
            assert_eq!(link.entry_kind, EntryKind::Symlink);
            let review = adapter
                .load_file(&worktree, snapshot, link.new_path.as_ref().unwrap())
                .unwrap();
            assert_eq!(
                review.new_content,
                ContentAvailability::Available("/outside/repository".into())
            );
        }
        let unchanged_path = RepositoryRelativePath::parse("unchanged.txt").unwrap();
        assert!(!overview.changed.iter().any(|file| {
            file.old_path.as_ref() == Some(&unchanged_path)
                || file.new_path.as_ref() == Some(&unchanged_path)
        }));
        assert!(overview.all_paths.contains(&unchanged_path));
        let unchanged_review = adapter
            .load_file(&worktree, snapshot, &unchanged_path)
            .unwrap();
        assert_eq!(unchanged_review.file.old_path, None);
        assert_eq!(unchanged_review.file.new_path, Some(unchanged_path));
        assert_eq!(unchanged_review.file.change, None);
        assert_eq!(unchanged_review.file.entry_kind, EntryKind::Regular);
        assert_eq!(
            unchanged_review.file.content_classification,
            ContentClassification::Text
        );
        assert!(matches!(
            unchanged_review.old_content,
            ContentAvailability::Omitted {
                reason: OmissionReason::MissingSide,
                byte_length: None
            }
        ));
        assert_eq!(
            unchanged_review.new_content,
            ContentAvailability::Available("same first\nsame second\n".into())
        );
        assert_eq!(
            unchanged_review.patch,
            ContentAvailability::Available(String::new())
        );
        assert_eq!(
            unchanged_review.structured_diff,
            StructuredDiff::Available(vec![])
        );

        let committed_path = RepositoryRelativePath::parse("committed.txt").unwrap();
        let committed_review = adapter
            .load_file(&worktree, snapshot, &committed_path)
            .unwrap();
        assert_eq!(committed_review.file.change, Some(FileChangeKind::Modified));
        assert_eq!(
            committed_review.old_content,
            ContentAvailability::Available("base\n".into())
        );
        assert_eq!(
            committed_review.new_content,
            ContentAvailability::Available("commit\n".into())
        );
        let StructuredDiff::Available(committed_hunks) = committed_review.structured_diff else {
            panic!("modified text must have a structured diff");
        };
        assert!(committed_hunks.iter().any(|hunk| {
            hunk.lines
                .iter()
                .any(|line| line.kind == DiffLineKind::Removed)
                && hunk
                    .lines
                    .iter()
                    .any(|line| line.kind == DiffLineKind::Added)
        }));

        for (path, expected_current_content) in
            [("staged.txt", "stage\n"), ("unstaged.txt", "worktree\n")]
        {
            let review = adapter
                .load_file(
                    &worktree,
                    snapshot,
                    &RepositoryRelativePath::parse(path).unwrap(),
                )
                .unwrap();
            assert_eq!(review.file.change, Some(FileChangeKind::Modified));
            assert_eq!(
                review.old_content,
                ContentAvailability::Available("base\n".into()),
                "unexpected base content for {path}"
            );
            assert_eq!(
                review.new_content,
                ContentAvailability::Available(expected_current_content.into()),
                "unexpected current content for {path}"
            );
            let StructuredDiff::Available(hunks) = review.structured_diff else {
                panic!("{path} must have a structured diff");
            };
            assert!(hunks.iter().any(|hunk| {
                hunk.lines
                    .iter()
                    .any(|line| line.kind == DiffLineKind::Removed && line.text == "base")
                    && hunk.lines.iter().any(|line| {
                        line.kind == DiffLineKind::Added
                            && line.text == expected_current_content.trim_end()
                    })
            }));
        }

        let untracked_path = RepositoryRelativePath::parse("untracked.txt").unwrap();
        let untracked_review = adapter
            .load_file(&worktree, snapshot, &untracked_path)
            .unwrap();
        assert_eq!(
            untracked_review.file.change,
            Some(FileChangeKind::Untracked)
        );
        assert!(matches!(
            untracked_review.old_content,
            ContentAvailability::Omitted {
                reason: OmissionReason::MissingSide,
                ..
            }
        ));
        assert_eq!(
            untracked_review.new_content,
            ContentAvailability::Available("new\n".into())
        );
        let StructuredDiff::Available(untracked_hunks) = untracked_review.structured_diff else {
            panic!("untracked text must have a structured diff");
        };
        assert_eq!(untracked_hunks.len(), 1);
        assert_eq!(untracked_hunks[0].lines.len(), 1);
        assert_eq!(untracked_hunks[0].lines[0].kind, DiffLineKind::Added);
        assert_eq!(untracked_hunks[0].lines[0].text, "new");

        let first_page = adapter
            .traverse_ignored(&worktree, snapshot, &generated_node_id, None)
            .unwrap();
        assert_eq!(first_page.node_id, generated_node_id);
        assert_eq!(first_page.entries.len(), 200);
        let cursor = first_page.next_cursor.as_deref().unwrap();
        assert!(cursor.starts_with("ic1_"));
        let cursor_fields = cursor
            .strip_prefix("ic1_")
            .unwrap()
            .split('-')
            .collect::<Vec<_>>();
        assert_eq!(cursor_fields.len(), 4);
        assert_eq!(cursor_fields[0], snapshot.as_str());
        assert!(cursor_fields[1].starts_with("in1_"));
        let wrong_node_cursor = format!(
            "ic1_{}-in1_{}-{}-{}",
            cursor_fields[0],
            "0".repeat(64),
            cursor_fields[2],
            cursor_fields[3]
        );
        assert_eq!(
            adapter
                .traverse_ignored(
                    &worktree,
                    snapshot,
                    &generated_node_id,
                    Some(&wrong_node_cursor),
                )
                .unwrap_err(),
            RepositoryPortError::InvalidCursor
        );
        let out_of_range_cursor = format!(
            "ic1_{}-{}-{}-9999",
            cursor_fields[0], cursor_fields[1], cursor_fields[2]
        );
        assert_eq!(
            adapter
                .traverse_ignored(
                    &worktree,
                    snapshot,
                    &generated_node_id,
                    Some(&out_of_range_cursor),
                )
                .unwrap_err(),
            RepositoryPortError::InvalidCursor
        );
        let second_page = adapter
            .traverse_ignored(&worktree, snapshot, &generated_node_id, Some(cursor))
            .unwrap();
        assert_eq!(second_page.entries.len(), 1);
        assert!(second_page.next_cursor.is_none());
        let nested = &second_page.entries[0];
        assert_eq!(nested.path.as_str(), "generated/nested");
        assert_eq!(nested.kind, TreeNodeKind::Directory);
        let TreeChildren::Deferred { node_id: nested_id } = &nested.children else {
            panic!("nested ignored directory must remain deferred");
        };
        let nested_page = adapter
            .traverse_ignored(&worktree, snapshot, nested_id, None)
            .unwrap();
        assert_eq!(nested_page.node_id, *nested_id);
        assert_eq!(nested_page.entries.len(), 1);
        assert_eq!(
            nested_page.entries[0].path.as_str(),
            "generated/nested/child.txt"
        );
        assert_eq!(nested_page.entries[0].kind, TreeNodeKind::File);
        write(&root, "generated/item-201.txt", "ignored\n");
        assert_eq!(
            adapter
                .traverse_ignored(&worktree, snapshot, &generated_node_id, Some(cursor))
                .unwrap_err(),
            RepositoryPortError::StaleCursor
        );
        write(&root, "unstaged.txt", "different bytes, same status\n");
        let second_snapshot = adapter
            .load_overview(&worktree, Some(&base))
            .unwrap()
            .current_snapshot_id
            .unwrap();
        assert_ne!(first_snapshot, second_snapshot);
        assert_eq!(
            adapter
                .traverse_ignored(&worktree, &first_snapshot, &generated_node_id, None)
                .unwrap_err(),
            RepositoryPortError::StaleSnapshot
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn intermediate_symlink_escape_is_rejected_before_content_read() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let fixture_root = std::env::temp_dir().join(format!(
            "spec-viewer-intermediate-symlink-{}-{nonce}",
            std::process::id()
        ));
        let root = fixture_root.join("repository");
        let outside = fixture_root.join("outside");
        fs::create_dir_all(&root).unwrap();
        fs::create_dir_all(&outside).unwrap();
        git(&root, &["init", "-b", "main"]);
        git(&root, &["config", "user.name", "Spec Viewer"]);
        git(&root, &["config", "user.email", "fixture.invalid"]);
        write(&root, "nested/file.txt", "inside\n");
        git(&root, &["add", "."]);
        git(&root, &["commit", "-m", "base"]);
        git(&root, &["switch", "-c", "feature"]);
        fs::remove_dir_all(root.join("nested")).unwrap();
        write(&outside, "file.txt", "outside secret\n");
        std::os::unix::fs::symlink(&outside, root.join("nested")).unwrap();

        let adapter = GitRepositoryAdapter::default();
        let worktree = WorktreeId::new(root.to_string_lossy()).unwrap();
        let base = ValidatedRefName::parse("main").unwrap();
        assert_eq!(
            adapter.load_overview(&worktree, Some(&base)).unwrap_err(),
            RepositoryPortError::InvalidRepositoryPath
        );

        fs::remove_dir_all(fixture_root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn non_utf8_repository_path_returns_typed_encoding_error() {
        use std::os::unix::ffi::OsStringExt;

        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "spec-viewer-non-utf8-path-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(&root).unwrap();
        git(&root, &["init", "-b", "main"]);
        git(&root, &["config", "user.name", "Spec Viewer"]);
        git(&root, &["config", "user.email", "fixture.invalid"]);
        write(&root, "base.txt", "base\n");
        git(&root, &["add", "."]);
        git(&root, &["commit", "-m", "base"]);
        git(&root, &["switch", "-c", "feature"]);
        let invalid_name = std::ffi::OsString::from_vec(vec![b'b', b'a', b'd', b'-', 0xff]);
        fs::write(root.join(invalid_name), b"invalid path\n").unwrap();

        let adapter = GitRepositoryAdapter::default();
        let worktree = WorktreeId::new(root.to_string_lossy()).unwrap();
        let base = ValidatedRefName::parse("main").unwrap();
        assert_eq!(
            adapter.load_overview(&worktree, Some(&base)).unwrap_err(),
            RepositoryPortError::UnsupportedPathEncoding
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn inferred_base_priority_preserves_source_and_remote_ambiguity() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "spec-viewer-base-priority-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(&root).unwrap();
        git(&root, &["init", "-b", "main"]);
        git(&root, &["config", "user.name", "Spec Viewer"]);
        git(&root, &["config", "user.email", "fixture.invalid"]);
        write(&root, "base.txt", "base\n");
        git(&root, &["add", "."]);
        git(&root, &["commit", "-m", "base"]);
        git(&root, &["switch", "-c", "feature"]);
        write(&root, "feature.txt", "feature\n");
        let main_sha = String::from_utf8(
            Command::new("git")
                .arg("-C")
                .arg(&root)
                .args(["rev-parse", "main"])
                .output()
                .unwrap()
                .stdout,
        )
        .unwrap();
        let main_sha = main_sha.trim();
        git(&root, &["update-ref", "refs/remotes/origin/main", main_sha]);
        git(
            &root,
            &[
                "symbolic-ref",
                "refs/remotes/origin/HEAD",
                "refs/remotes/origin/main",
            ],
        );
        git(&root, &["config", "branch.feature.remote", "origin"]);
        git(
            &root,
            &["config", "branch.feature.gh-merge-base", "refs/heads/main"],
        );

        let adapter = GitRepositoryAdapter::default();
        let worktree = WorktreeId::new(root.to_string_lossy()).unwrap();
        let gh = adapter.load_overview(&worktree, None).unwrap();
        assert_eq!(gh.base_source, Some(BaseResolutionSource::GhMergeBase));
        git(
            &root,
            &["config", "--unset", "branch.feature.gh-merge-base"],
        );
        let current_remote = adapter.load_overview(&worktree, None).unwrap();
        assert_eq!(
            current_remote.base_source,
            Some(BaseResolutionSource::CurrentRemoteHead)
        );
        git(&root, &["config", "--unset", "branch.feature.remote"]);
        let origin = adapter.load_overview(&worktree, None).unwrap();
        assert_eq!(origin.base_source, Some(BaseResolutionSource::OriginHead));

        git(
            &root,
            &["symbolic-ref", "--delete", "refs/remotes/origin/HEAD"],
        );
        for remote in ["upstream", "fork"] {
            let branch_ref = format!("refs/remotes/{remote}/main");
            let head_ref = format!("refs/remotes/{remote}/HEAD");
            git(&root, &["update-ref", &branch_ref, main_sha]);
            git(&root, &["symbolic-ref", &head_ref, &branch_ref]);
        }
        let ambiguous = adapter.load_overview(&worktree, None).unwrap();
        assert!(matches!(
            ambiguous.base,
            BaseBranchResolution::NeedsSelection {
                reason: BaseResolutionFailure::AmbiguousRemoteHead,
                ..
            }
        ));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn shallow_history_without_merge_base_is_explicit_state() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let fixture_root = std::env::temp_dir().join(format!(
            "spec-viewer-shallow-base-{}-{nonce}",
            std::process::id()
        ));
        let source = fixture_root.join("source");
        let shallow = fixture_root.join("shallow");
        fs::create_dir_all(&source).unwrap();
        git(&source, &["init", "-b", "main"]);
        git(&source, &["config", "user.name", "Spec Viewer"]);
        git(&source, &["config", "user.email", "fixture.invalid"]);
        write(&source, "root.txt", "root\n");
        git(&source, &["add", "."]);
        git(&source, &["commit", "-m", "root"]);
        git(&source, &["switch", "-c", "feature"]);
        write(&source, "feature.txt", "feature\n");
        git(&source, &["add", "."]);
        git(&source, &["commit", "-m", "feature"]);
        git(&source, &["switch", "main"]);
        write(&source, "main.txt", "main\n");
        git(&source, &["add", "."]);
        git(&source, &["commit", "-m", "main"]);

        let source_url = format!("file://{}", source.display());
        let clone_status = Command::new("git")
            .args([
                "clone",
                "--depth",
                "1",
                "--branch",
                "feature",
                &source_url,
                shallow.to_str().unwrap(),
            ])
            .status()
            .unwrap();
        assert!(clone_status.success());
        git(
            &shallow,
            &[
                "fetch",
                "--depth",
                "1",
                "origin",
                "main:refs/remotes/origin/main",
            ],
        );

        let adapter = GitRepositoryAdapter::default();
        let worktree = WorktreeId::new(shallow.to_string_lossy()).unwrap();
        let main = ValidatedRefName::parse("refs/remotes/origin/main").unwrap();
        let overview = adapter.load_overview(&worktree, Some(&main)).unwrap();
        assert!(matches!(
            overview.base,
            BaseBranchResolution::NeedsSelection {
                reason: BaseResolutionFailure::ShallowHistory,
                ..
            }
        ));

        fs::remove_dir_all(fixture_root).unwrap();
    }

    #[test]
    fn base_resolution_keeps_missing_detached_unborn_and_disconnected_states() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let fixture_root = std::env::temp_dir().join(format!(
            "spec-viewer-base-states-{}-{nonce}",
            std::process::id()
        ));
        let root = fixture_root.join("normal");
        let unborn = fixture_root.join("unborn");
        fs::create_dir_all(&root).unwrap();
        fs::create_dir_all(&unborn).unwrap();
        git(&root, &["init", "-b", "main"]);
        git(&root, &["config", "user.name", "Spec Viewer"]);
        git(&root, &["config", "user.email", "fixture.invalid"]);
        write(&root, "main.txt", "main\n");
        git(&root, &["add", "."]);
        git(&root, &["commit", "-m", "main"]);
        git(&unborn, &["init", "-b", "main"]);

        let adapter = GitRepositoryAdapter::default();
        let worktree = WorktreeId::new(root.to_string_lossy()).unwrap();
        let missing = ValidatedRefName::parse("missing").unwrap();
        let missing_overview = adapter.load_overview(&worktree, Some(&missing)).unwrap();
        assert_eq!(
            missing_overview.base,
            BaseBranchResolution::InvalidOverride {
                override_ref: "missing".into(),
                missing: true,
            }
        );

        git(&root, &["checkout", "--detach"]);
        let detached = adapter.load_overview(&worktree, None).unwrap();
        assert!(matches!(
            detached.base,
            BaseBranchResolution::NeedsSelection {
                reason: BaseResolutionFailure::DetachedHead,
                ..
            }
        ));
        git(&root, &["switch", "main"]);
        git(&root, &["switch", "--orphan", "orphan"]);
        let _ = fs::remove_file(root.join("main.txt"));
        write(&root, "orphan.txt", "orphan\n");
        git(&root, &["add", "."]);
        git(&root, &["commit", "-m", "orphan"]);
        let main = ValidatedRefName::parse("main").unwrap();
        let disconnected = adapter.load_overview(&worktree, Some(&main)).unwrap();
        assert!(matches!(
            disconnected.base,
            BaseBranchResolution::NeedsSelection {
                reason: BaseResolutionFailure::NoCommonAncestor,
                ..
            }
        ));

        let unborn_id = WorktreeId::new(unborn.to_string_lossy()).unwrap();
        let unborn_overview = adapter.load_overview(&unborn_id, None).unwrap();
        assert!(matches!(
            unborn_overview.base,
            BaseBranchResolution::NeedsSelection {
                reason: BaseResolutionFailure::UnbornHead,
                ..
            }
        ));

        fs::remove_dir_all(fixture_root).unwrap();
    }

    #[test]
    fn changed_records_keep_rename_but_defer_expensive_copy_detection() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "spec-viewer-change-variants-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(&root).unwrap();
        git(&root, &["init", "-b", "main"]);
        git(&root, &["config", "user.name", "Spec Viewer"]);
        git(&root, &["config", "user.email", "fixture.invalid"]);
        write(&root, "rename-old.txt", "rename content\n");
        write(&root, "copy-source.txt", "copy content\n");
        write(&root, "deleted.txt", "delete content\n");
        write(&root, "type-change", "regular content\n");
        write(&root, "mode-only.sh", "echo mode\n");
        git(&root, &["add", "."]);
        git(&root, &["commit", "-m", "base"]);
        git(&root, &["switch", "-c", "feature"]);
        fs::rename(root.join("rename-old.txt"), root.join("rename-new.txt")).unwrap();
        fs::copy(root.join("copy-source.txt"), root.join("copy-target.txt")).unwrap();
        fs::remove_file(root.join("deleted.txt")).unwrap();
        fs::remove_file(root.join("type-change")).unwrap();
        #[cfg(unix)]
        std::os::unix::fs::symlink("regular content", root.join("type-change")).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut permissions = fs::metadata(root.join("mode-only.sh"))
                .unwrap()
                .permissions();
            permissions.set_mode(0o755);
            fs::set_permissions(root.join("mode-only.sh"), permissions).unwrap();
        }
        git(&root, &["add", "-A"]);

        let adapter = GitRepositoryAdapter::default();
        let worktree = WorktreeId::new(root.to_string_lossy()).unwrap();
        let base = ValidatedRefName::parse("main").unwrap();
        let overview = adapter.load_overview(&worktree, Some(&base)).unwrap();
        let renamed = overview
            .changed
            .iter()
            .find(|file| file.change == FileChangeKind::Renamed)
            .unwrap();
        assert_eq!(
            renamed.old_path.as_ref().unwrap().as_str(),
            "rename-old.txt"
        );
        assert_eq!(
            renamed.new_path.as_ref().unwrap().as_str(),
            "rename-new.txt"
        );
        assert_eq!(renamed.similarity, Some(100));
        let copied_target = overview
            .changed
            .iter()
            .find(|file| {
                file.new_path
                    .as_ref()
                    .is_some_and(|path| path.as_str() == "copy-target.txt")
            })
            .unwrap();
        assert_eq!(copied_target.change, FileChangeKind::Added);
        assert_eq!(copied_target.old_path, None);
        assert!(overview.changed.iter().any(|file| {
            file.change == FileChangeKind::Deleted
                && file
                    .old_path
                    .as_ref()
                    .is_some_and(|path| path.as_str() == "deleted.txt")
        }));
        #[cfg(unix)]
        {
            let type_change = overview
                .changed
                .iter()
                .find(|file| {
                    file.new_path
                        .as_ref()
                        .is_some_and(|path| path.as_str() == "type-change")
                })
                .unwrap();
            assert_eq!(type_change.change, FileChangeKind::TypeChanged);
            assert_eq!(type_change.entry_kind, EntryKind::Symlink);
            let mode = overview
                .changed
                .iter()
                .find(|file| {
                    file.new_path
                        .as_ref()
                        .is_some_and(|path| path.as_str() == "mode-only.sh")
                })
                .unwrap();
            assert_eq!(mode.old_mode, Some(GitFileMode::Regular));
            assert_eq!(mode.new_mode, Some(GitFileMode::Executable));
        }
        let review = adapter
            .load_file(
                &worktree,
                overview.current_snapshot_id.as_ref().unwrap(),
                renamed.new_path.as_ref().unwrap(),
            )
            .unwrap();
        assert_eq!(
            review.old_content,
            ContentAvailability::Available("rename content\n".into())
        );
        assert_eq!(
            review.new_content,
            ContentAvailability::Available("rename content\n".into())
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn repository_variants_keep_identity_and_typed_errors() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let fixture_root = std::env::temp_dir().join(format!(
            "spec-viewer-repository-variants-{}-{nonce}",
            std::process::id()
        ));
        let root = fixture_root.join("primary");
        let linked = fixture_root.join("linked");
        let bare = fixture_root.join("bare.git");
        let not_repository = fixture_root.join("plain");
        let escape = fixture_root.join("escape");
        let escaped_common = fixture_root.join("outside-common");
        fs::create_dir_all(&root).unwrap();
        fs::create_dir_all(&bare).unwrap();
        fs::create_dir_all(&not_repository).unwrap();
        fs::create_dir_all(&escape).unwrap();
        fs::create_dir_all(&escaped_common).unwrap();
        git(&root, &["init", "-b", "main"]);
        git(&root, &["config", "user.name", "Spec Viewer"]);
        git(&root, &["config", "user.email", "fixture.invalid"]);
        write(&root, "tracked.txt", "base\n");
        git(&root, &["add", "."]);
        git(&root, &["commit", "-m", "base"]);
        git(
            &root,
            &["worktree", "add", "-b", "linked", linked.to_str().unwrap()],
        );
        git(&bare, &["init", "--bare"]);
        git(&escape, &["init", "-b", "main"]);
        git(&escape, &["config", "user.name", "Spec Viewer"]);
        git(&escape, &["config", "user.email", "fixture.invalid"]);
        write(&escape, "tracked.txt", "base\n");
        git(&escape, &["add", "."]);
        git(&escape, &["commit", "-m", "base"]);
        for name in ["objects", "refs", "config"] {
            fs::rename(escape.join(".git").join(name), escaped_common.join(name)).unwrap();
        }
        fs::write(escape.join(".git/commondir"), "../../outside-common\n").unwrap();

        let adapter = GitRepositoryAdapter::default();
        let base = ValidatedRefName::parse("main").unwrap();
        let primary_id = WorktreeId::new(root.to_string_lossy()).unwrap();
        let linked_id = WorktreeId::new(linked.to_string_lossy()).unwrap();
        let primary = adapter.load_overview(&primary_id, Some(&base)).unwrap();
        let linked_overview = adapter.load_overview(&linked_id, Some(&base)).unwrap();
        assert_eq!(primary.repository_id, linked_overview.repository_id);
        assert_ne!(
            primary.current_snapshot_id,
            linked_overview.current_snapshot_id
        );

        let bare_id = WorktreeId::new(bare.to_string_lossy()).unwrap();
        assert_eq!(
            adapter.load_overview(&bare_id, None).unwrap_err(),
            RepositoryPortError::BareRepository
        );
        let plain_id = WorktreeId::new(not_repository.to_string_lossy()).unwrap();
        assert_eq!(
            adapter.load_overview(&plain_id, None).unwrap_err(),
            RepositoryPortError::NotRepository
        );
        let escape_id = WorktreeId::new(escape.to_string_lossy()).unwrap();
        assert_eq!(
            adapter.load_overview(&escape_id, None).unwrap_err(),
            RepositoryPortError::CommonDirBoundaryEscape
        );
        let missing_id = WorktreeId::new(fixture_root.join("missing").to_string_lossy()).unwrap();
        assert_eq!(
            adapter.load_overview(&missing_id, None).unwrap_err(),
            RepositoryPortError::WorktreeUnavailable
        );

        fs::remove_dir_all(fixture_root).unwrap();
    }

    #[test]
    fn submodule_review_reports_parent_visible_oids_and_dirty_flags() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let fixture_root = std::env::temp_dir().join(format!(
            "spec-viewer-submodule-fixture-{}-{nonce}",
            std::process::id()
        ));
        let source = fixture_root.join("source");
        let root = fixture_root.join("parent");
        fs::create_dir_all(&source).unwrap();
        fs::create_dir_all(&root).unwrap();
        git(&source, &["init", "-b", "main"]);
        git(&source, &["config", "user.name", "Spec Viewer"]);
        git(&source, &["config", "user.email", "fixture.invalid"]);
        write(&source, "tracked.txt", "base\n");
        git(&source, &["add", "."]);
        git(&source, &["commit", "-m", "base"]);

        git(&root, &["init", "-b", "main"]);
        git(&root, &["config", "user.name", "Spec Viewer"]);
        git(&root, &["config", "user.email", "fixture.invalid"]);
        git(
            &root,
            &[
                "-c",
                "protocol.file.allow=always",
                "submodule",
                "add",
                source.to_str().unwrap(),
                "module",
            ],
        );
        git(&root, &["commit", "-am", "base"]);
        git(&root, &["switch", "-c", "feature"]);

        let module = root.join("module");
        git(&module, &["config", "user.name", "Spec Viewer"]);
        git(&module, &["config", "user.email", "fixture.invalid"]);
        write(&module, "tracked.txt", "committed\n");
        git(&module, &["add", "tracked.txt"]);
        git(&module, &["commit", "-m", "advance"]);
        write(&module, "tracked.txt", "dirty\n");
        write(&module, "untracked.txt", "new\n");

        let adapter = GitRepositoryAdapter::default();
        let worktree = WorktreeId::new(root.to_string_lossy()).unwrap();
        let base = ValidatedRefName::parse("main").unwrap();
        let overview = adapter.load_overview(&worktree, Some(&base)).unwrap();
        let path = RepositoryRelativePath::parse("module").unwrap();
        let file = overview
            .changed
            .iter()
            .find(|file| file.new_path.as_ref() == Some(&path))
            .unwrap();
        assert_eq!(file.entry_kind, EntryKind::Submodule);
        let review = adapter
            .load_file(
                &worktree,
                overview.current_snapshot_id.as_ref().unwrap(),
                &path,
            )
            .unwrap();
        let state = review.submodule.unwrap();
        assert!(state.base_gitlink_oid.is_some());
        assert!(state.index_gitlink_oid.is_some());
        assert!(state.worktree_head_oid.is_some());
        assert!(state.commit_changed);
        assert!(state.tracked_changes);
        assert!(state.untracked_changes);
        assert!(!state.uninitialized);

        fs::remove_dir_all(fixture_root).unwrap();
    }

    #[test]
    fn r199_tree_011_binary() {
        file_review_reports_binary_and_large_omissions_independently();
    }

    #[test]
    fn r199_git_002_symbolic_remote_head() {
        inferred_base_priority_preserves_source_and_remote_ambiguity();
    }

    #[test]
    fn r199_git_003_gh_merge_base() {
        inferred_base_priority_preserves_source_and_remote_ambiguity();
    }

    #[test]
    fn r199_git_004_override() {
        file_review_reuses_the_explicit_base_bound_to_snapshot();
    }

    #[test]
    fn r199_git_005_unborn() {
        base_resolution_keeps_missing_detached_unborn_and_disconnected_states();
    }

    #[cfg(unix)]
    #[test]
    fn r199_git_006_non_utf8() {
        non_utf8_repository_path_returns_typed_encoding_error();
    }

    #[cfg(unix)]
    #[test]
    fn r199_git_007_symlink_escape() {
        intermediate_symlink_escape_is_rejected_before_content_read();
    }

    #[test]
    fn r199_git_010_main_priority() {
        inferred_base_priority_preserves_source_and_remote_ambiguity();
    }

    #[test]
    fn r199_git_011_master_fallback() {
        inferred_base_priority_preserves_source_and_remote_ambiguity();
    }

    #[test]
    fn r199_git_012_shallow() {
        shallow_history_without_merge_base_is_explicit_state();
    }

    #[test]
    fn r199_git_013_detached() {
        base_resolution_keeps_missing_detached_unborn_and_disconnected_states();
    }

    #[test]
    fn r199_git_014_unicode() {
        let root = std::env::temp_dir().join(format!(
            "spec-viewer-日本語-{}-{}",
            std::process::id(),
            uuid::Uuid::new_v4()
        ));
        fs::create_dir_all(&root).unwrap();
        git(&root, &["init", "-b", "main"]);
        git(&root, &["config", "user.name", "Spec Viewer"]);
        git(&root, &["config", "user.email", "fixture.invalid"]);
        write(&root, "文書.txt", "本文\n");
        git(&root, &["add", "."]);
        git(&root, &["commit", "-m", "base"]);
        let worktree = WorktreeId::new(root.to_string_lossy()).unwrap();
        let overview = GitRepositoryAdapter::default()
            .load_overview(&worktree, Some(&ValidatedRefName::parse("main").unwrap()))
            .unwrap();
        assert!(overview.display_worktree_label.contains("日本語"));
        assert!(overview
            .all_paths
            .iter()
            .any(|path| path.as_str() == "文書.txt"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn r199_git_015_rename_paths() {
        changed_records_keep_rename_but_defer_expensive_copy_detection();
    }

    #[test]
    fn r199_git_016_large_omitted() {
        file_review_reports_binary_and_large_omissions_independently();
    }

    #[test]
    fn r199_git_017_missing_remote_head() {
        inferred_base_priority_preserves_source_and_remote_ambiguity();
    }
}
