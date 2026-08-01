use super::GitRunner;
use crate::domain::{
    repository::*,
    workspace::{ValidatedRefName, WorktreeId},
};
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
    ignored_nodes: BTreeMap<String, RepositoryRelativePath>,
}

type ContextKey = (Vec<u8>, String);
type ContextStore = Arc<Mutex<BTreeMap<ContextKey, RepositoryReviewContext>>>;

#[derive(Debug, Clone)]
struct WorkingTreeReviewContext {
    head: CommitSha,
    changed: Vec<DiffFile>,
}

type WorkingTreeContextStore = Arc<Mutex<BTreeMap<ContextKey, WorkingTreeReviewContext>>>;

#[derive(Debug, Clone, Default)]
pub struct GitRepositoryAdapter {
    runner: GitRunner,
    contexts: ContextStore,
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
        head: CommitSha,
        changed: Vec<DiffFile>,
    ) -> Result<(), RepositoryPortError> {
        let key = Self::context_key(root, snapshot);
        let mut contexts = self
            .working_tree_contexts
            .lock()
            .map_err(|_| RepositoryPortError::Io)?;
        if contexts.len() >= 64 && !contexts.contains_key(&key) {
            contexts.pop_first();
        }
        contexts.insert(key, WorkingTreeReviewContext { head, changed });
        Ok(())
    }

    fn working_tree_context(
        &self,
        root: &Path,
        snapshot: &SnapshotId,
    ) -> Result<WorkingTreeReviewContext, RepositoryPortError> {
        self.working_tree_contexts
            .lock()
            .map_err(|_| RepositoryPortError::Io)?
            .get(&Self::context_key(root, snapshot))
            .cloned()
            .ok_or(RepositoryPortError::StaleSnapshot)
    }

    fn working_tree_head(&self, root: &Path) -> Result<CommitSha, RepositoryPortError> {
        let bytes = match self.runner.run(
            root,
            "working-tree-head",
            &["rev-parse", "--verify", "HEAD"],
            false,
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
            operation: "working-tree-head".into(),
            code: None,
            stderr: "Git returned an invalid object id".into(),
        })
    }

    fn is_unborn_head(&self, root: &Path) -> Result<bool, RepositoryPortError> {
        let symbolic_head = match self.runner.run(
            root,
            "working-tree-symbolic-head",
            &["symbolic-ref", "-q", "HEAD"],
            false,
        ) {
            Ok(bytes) => bytes,
            Err(RepositoryPortError::GitFailed { .. }) => return Ok(false),
            Err(error) => return Err(error),
        };
        let reference = std::str::from_utf8(&symbolic_head)
            .map_err(|_| RepositoryPortError::UnsupportedPathEncoding)?;
        match self.runner.run(
            root,
            "working-tree-head-reference",
            &["show-ref", "--verify", "--quiet", reference.trim()],
            false,
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
                "working-tree-file-patch",
                &arguments,
                true,
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
                "is-bare",
                &["rev-parse", "--is-bare-repository"],
                false,
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
            "repository-root",
            &["rev-parse", "--show-toplevel"],
            false,
        )?;
        fs::canonicalize(root.trim()).map_err(|_| RepositoryPortError::WorktreeUnavailable)
    }
    fn text(
        &self,
        root: &Path,
        operation: &str,
        args: &[&str],
        content: bool,
    ) -> Result<String, RepositoryPortError> {
        String::from_utf8(self.runner.run(root, operation, args, content)?)
            .map_err(|_| RepositoryPortError::UnsupportedPathEncoding)
    }
    fn git_directories(&self, root: &Path) -> Result<(PathBuf, PathBuf), RepositoryPortError> {
        let git_dir = self.text(root, "git-dir", &["rev-parse", "--git-dir"], false)?;
        let canonical_git_dir = fs::canonicalize(root.join(git_dir.trim()))
            .map_err(|_| RepositoryPortError::WorktreeUnavailable)?;
        let common = self.text(
            root,
            "common-dir",
            &["rev-parse", "--git-common-dir"],
            false,
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
            self.text(root, "head", &["rev-parse", "HEAD"], false)?
                .trim(),
        )
        .map_err(|_| RepositoryPortError::GitFailed {
            operation: "head".into(),
            code: None,
            stderr: String::new(),
        })
    }
    fn ref_exists(&self, root: &Path, reference: &str) -> bool {
        self.runner
            .run(
                root,
                "verify-ref",
                &[
                    "rev-parse",
                    "--verify",
                    "--quiet",
                    "--end-of-options",
                    reference,
                ],
                false,
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
                "current-branch",
                &["symbolic-ref", "--quiet", "--short", "HEAD"],
                false,
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
                if let Ok(value) =
                    self.text(root, "gh-merge-base", &["config", "--get", &key], false)
                {
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
                    "branch-remote",
                    &["config", "--get", &remote_key],
                    false,
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
                    "remote-heads",
                    &["for-each-ref", "--format=%(refname)", "refs/remotes/*/HEAD"],
                    false,
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
                "merge-base",
                &["merge-base", "--", &reference, "HEAD"],
                false,
            );
            if let Ok(merge) = merge {
                let merge_base_sha =
                    CommitSha::parse(merge.trim()).map_err(|_| RepositoryPortError::GitFailed {
                        operation: "merge-base-output".into(),
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
                    "shallow",
                    &["rev-parse", "--is-shallow-repository"],
                    false,
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
            "snapshot-head",
            &["rev-parse", "--verify", "HEAD"],
            false,
        )?;
        let index_bytes = self.runner.run(
            root,
            "snapshot-index",
            &["ls-files", "--stage", "-z"],
            false,
        )?;
        frame(&mut hasher, &head_bytes);
        frame(&mut hasher, &index_bytes);
        let tracked =
            self.runner
                .run(root, "snapshot-tracked", &["ls-files", "-c", "-z"], false)?;
        let mut tracked_paths = tracked
            .split(|byte| *byte == 0)
            .filter(|path| !path.is_empty())
            .collect::<Vec<_>>();
        tracked_paths.sort_unstable();
        for raw_path in tracked_paths {
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
                            "snapshot-submodule-head",
                            &["rev-parse", "HEAD"],
                            false,
                        )
                        .unwrap_or_default();
                    let status = self
                        .runner
                        .run(
                            &target,
                            "snapshot-submodule-status",
                            &["status", "--porcelain=v1", "-z", "--untracked-files=all"],
                            false,
                        )
                        .unwrap_or_default();
                    frame(&mut hasher, &head);
                    frame(&mut hasher, &status);
                }
                Ok(_) => hasher.update([4]),
            }
        }
        let untracked = self.runner.run(
            root,
            "snapshot-untracked",
            &["ls-files", "--others", "--exclude-standard", "-z"],
            false,
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
        let final_tracked = self.runner.run(
            root,
            "snapshot-tracked-recheck",
            &["ls-files", "-c", "-z"],
            false,
        )?;
        let final_untracked = self.runner.run(
            root,
            "snapshot-untracked-recheck",
            &["ls-files", "--others", "--exclude-standard", "-z"],
            false,
        )?;
        let final_head = self.runner.run(
            root,
            "snapshot-head-recheck",
            &["rev-parse", "--verify", "HEAD"],
            false,
        )?;
        let final_index = self.runner.run(
            root,
            "snapshot-index-recheck",
            &["ls-files", "--stage", "-z"],
            false,
        )?;
        if final_head != head_bytes
            || final_index != index_bytes
            || final_tracked != tracked
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
            "base-modes",
            &["ls-tree", "-r", "-z", merge.as_str()],
            false,
        )?)?;
        let index_modes = parse_mode_map(&self.runner.run(
            root,
            "index-modes",
            &["ls-files", "--stage", "-z"],
            false,
        )?)?;
        let raw = self.runner.run(
            root,
            "changed-files",
            &[
                "diff",
                "--name-status",
                "-z",
                "-M50%",
                "-C50%",
                "--find-copies-harder",
                "-l1000",
                merge.as_str(),
            ],
            false,
        )?;
        let mut fields = raw.split(|b| *b == 0).filter(|v| !v.is_empty());
        let mut files = Vec::new();
        while let Some(status) = fields.next() {
            let code = status[0] as char;
            if matches!(code, 'R' | 'C') {
                let old = Self::path(
                    fields
                        .next()
                        .ok_or(RepositoryPortError::InvalidRepositoryPath)?,
                )?;
                let new = Self::path(
                    fields
                        .next()
                        .ok_or(RepositoryPortError::InvalidRepositoryPath)?,
                )?;
                let change = if code == 'R' {
                    FileChangeKind::Renamed
                } else {
                    FileChangeKind::Copied
                };
                let similarity = std::str::from_utf8(&status[1..])
                    .ok()
                    .and_then(|value| value.parse().ok());
                files.push(
                    DiffFile::new(
                        Some(old),
                        Some(new),
                        change,
                        EntryKind::Regular,
                        ContentClassification::Unknown,
                        similarity,
                        None,
                        None,
                    )
                    .map_err(|_| RepositoryPortError::InvalidRepositoryPath)?,
                );
            } else {
                let path = Self::path(
                    fields
                        .next()
                        .ok_or(RepositoryPortError::InvalidRepositoryPath)?,
                )?;
                let change = match code {
                    'A' => FileChangeKind::Added,
                    'D' => FileChangeKind::Deleted,
                    'T' => FileChangeKind::TypeChanged,
                    _ => FileChangeKind::Modified,
                };
                files.push(
                    DiffFile::new(
                        (change != FileChangeKind::Added).then(|| path.clone()),
                        (change != FileChangeKind::Deleted).then_some(path),
                        change,
                        EntryKind::Regular,
                        ContentClassification::Unknown,
                        None,
                        None,
                        None,
                    )
                    .map_err(|_| RepositoryPortError::InvalidRepositoryPath)?,
                );
            }
        }
        let untracked = self.runner.run(
            root,
            "untracked",
            &["ls-files", "--others", "--exclude-standard", "-z"],
            false,
        )?;
        for raw_path in untracked.split(|b| *b == 0).filter(|v| !v.is_empty()) {
            let path = Self::path(raw_path)?;
            if !files.iter().any(|f| f.new_path.as_ref() == Some(&path)) {
                files.push(
                    DiffFile::new(
                        None,
                        Some(path),
                        FileChangeKind::Untracked,
                        EntryKind::Regular,
                        ContentClassification::Unknown,
                        None,
                        None,
                        None,
                    )
                    .map_err(|_| RepositoryPortError::InvalidRepositoryPath)?,
                );
            }
        }
        files.sort_by(|a, b| {
            a.new_path
                .as_ref()
                .or(a.old_path.as_ref())
                .map(|p| p.as_str())
                .cmp(
                    &b.new_path
                        .as_ref()
                        .or(b.old_path.as_ref())
                        .map(|p| p.as_str()),
                )
        });
        for file in &mut files {
            let old_mode = file
                .old_path
                .as_ref()
                .and_then(|path| base_modes.get(path.as_str()))
                .cloned();
            let mut new_mode = file
                .new_path
                .as_ref()
                .and_then(|path| index_modes.get(path.as_str()))
                .cloned();
            if new_mode.is_none() {
                if let Some(path) = file.new_path.as_ref() {
                    if fs::symlink_metadata(root.join(path.as_str()))
                        .is_ok_and(|metadata| metadata.file_type().is_symlink())
                    {
                        new_mode = Some("120000".into());
                    }
                }
            }
            file.entry_kind = match new_mode.as_deref().or(old_mode.as_deref()) {
                Some("160000") => EntryKind::Submodule,
                Some("120000") => EntryKind::Symlink,
                _ => EntryKind::Regular,
            };
            if old_mode != new_mode {
                file.old_mode = old_mode;
                file.new_mode = new_mode;
            }
            file.content_classification = self.classify_current(root, file)?;
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
            "all-files",
            &["ls-files", "-c", "-o", "--exclude-standard", "-z"],
            false,
        )?;
        for raw in visible
            .split(|byte| *byte == 0)
            .filter(|value| !value.is_empty())
        {
            paths.insert(Self::path(raw)?);
        }
        let ignored = self.runner.run(
            root,
            "ignored-roots",
            &[
                "ls-files",
                "-o",
                "-i",
                "--exclude-standard",
                "--directory",
                "-z",
            ],
            false,
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
        let size = self
            .text(
                root,
                "base-content-size",
                &["cat-file", "-s", &object],
                false,
            )?
            .trim()
            .parse::<u64>()
            .map_err(|_| RepositoryPortError::GitFailed {
                operation: "base-content-size".into(),
                code: None,
                stderr: "Git returned an invalid object size".into(),
            })?;
        if size > CONTENT_LIMIT as u64 {
            return Ok(ContentAvailability::Omitted {
                reason: OmissionReason::LargeFile,
                byte_length: Some(size),
            });
        }
        let bytes = self.runner.run_with_stdout_limit(
            root,
            "base-content",
            &["show", &object],
            true,
            CONTENT_LIMIT,
        )?;
        Ok(Self::side_for_entry(Some(bytes), kind))
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
                "base-gitlink",
                &["ls-tree", merge.as_str(), "--", path.as_str()],
                false,
            )
            .ok()
            .and_then(|bytes| Self::parse_oid_field(&bytes, 2));
        let index = self
            .runner
            .run(
                root,
                "index-gitlink",
                &["ls-files", "--stage", "--", path.as_str()],
                false,
            )
            .ok()
            .and_then(|bytes| Self::parse_oid_field(&bytes, 1));
        let submodule_root = root.join(path.as_str());
        let worktree = self
            .runner
            .run(
                &submodule_root,
                "submodule-head",
                &["rev-parse", "HEAD"],
                false,
            )
            .ok()
            .and_then(|bytes| Self::parse_oid_field(&bytes, 0));
        let status = self
            .runner
            .run(
                &submodule_root,
                "submodule-status",
                &["status", "--porcelain=v1", "-z", "--untracked-files=all"],
                false,
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
impl WorkingTreeDiffPort for GitRepositoryAdapter {
    fn load_working_tree_overview(
        &self,
        worktree: &WorktreeId,
    ) -> Result<WorkingTreeDiffOverview, RepositoryPortError> {
        let root = self.root(worktree)?;
        let repository_id = self.repository_id(&root)?;
        let head = self.working_tree_head(&root)?;
        let snapshot = self.snapshot(&root, &repository_id)?;
        let changed = self.changes(&root, &head)?;
        if self.working_tree_head(&root)? != head {
            return Err(RepositoryPortError::HeadChangedDuringRead);
        }
        if self.snapshot(&root, &repository_id)? != snapshot {
            return Err(RepositoryPortError::EntryChangedDuringRead);
        }
        self.remember_working_tree_context(&root, &snapshot, head.clone(), changed.clone())?;
        Ok(WorkingTreeDiffOverview {
            head_sha: head,
            current_snapshot_id: snapshot,
            changed,
        })
    }

    fn load_working_tree_file(
        &self,
        worktree: &WorktreeId,
        snapshot: &SnapshotId,
        path: &RepositoryRelativePath,
    ) -> Result<FileReview, RepositoryPortError> {
        let root = self.root(worktree)?;
        let repository_id = self.repository_id(&root)?;
        if self.snapshot(&root, &repository_id)? != *snapshot {
            return Err(RepositoryPortError::StaleSnapshot);
        }
        let context = self.working_tree_context(&root, snapshot)?;
        if self.working_tree_head(&root)? != context.head {
            return Err(RepositoryPortError::HeadChangedDuringRead);
        }
        let file = context
            .changed
            .into_iter()
            .find(|file| {
                file.new_path.as_ref() == Some(path) || file.old_path.as_ref() == Some(path)
            })
            .ok_or(RepositoryPortError::InvalidRepositoryPath)?;
        self.build_working_tree_review(&root, &repository_id, snapshot, &context.head, path, file)
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
        let snapshot = self.snapshot(&root, &repository_id)?;
        let changed = self.changes(&root, merge_base_sha)?;
        let (all_paths, ignored_directories, ignored_entries) = self.all_paths(&root, &changed)?;
        let warnings = similarity_warnings(&changed);
        let changed_tree = changed_tree(&changed)?;
        let all_root = all_tree(&all_paths, &ignored_entries, &ignored_directories, &changed)?;
        let current_head = self.head(&root)?;
        let current_merge = self.text(
            &root,
            "verify-merge-base",
            &["merge-base", "--", branch_ref, "HEAD"],
            false,
        )?;
        if current_head != *head_sha || current_merge.trim() != merge_base_sha.as_str() {
            return Err(RepositoryPortError::StaleBase);
        }
        if self.snapshot(&root, &repository_id)? != snapshot {
            return Err(RepositoryPortError::EntryChangedDuringRead);
        }
        self.remember_context(
            &root,
            &snapshot,
            base.clone(),
            changed.clone(),
            &ignored_directories,
        )?;
        Ok(RepositoryOverview {
            repository_id,
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
                "check-ignored-directory",
                &["check-ignore", "--quiet", "--", directory.as_str()],
                false,
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
    ) -> Result<FileReview, RepositoryPortError> {
        let root = self.root(worktree)?;
        let repository_id = self.repository_id(&root)?;
        if self.snapshot(&root, &repository_id)? != *snapshot {
            return Err(RepositoryPortError::StaleSnapshot);
        }
        let context = self.review_context(&root, snapshot)?;
        let mut file = context
            .changed
            .into_iter()
            .find(|file| {
                file.new_path.as_ref() == Some(path) || file.old_path.as_ref() == Some(path)
            })
            .ok_or(RepositoryPortError::InvalidRepositoryPath)?;
        let (branch_ref, merge, expected_head) = match context.base {
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
            "file-review-merge-base",
            &["merge-base", "--", &branch_ref, "HEAD"],
            false,
        )?;
        if current_head != expected_head || current_merge.trim() != merge.as_str() {
            return Err(RepositoryPortError::StaleBase);
        }
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
            if self.snapshot(&root, &repository_id)? != *snapshot {
                return Err(RepositoryPortError::EntryChangedDuringRead);
            }
            return Ok(review);
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
                "file-patch",
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
                true,
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
        if self.snapshot(&root, &repository_id)? != *snapshot {
            return Err(RepositoryPortError::EntryChangedDuringRead);
        }
        Ok(review)
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

fn similarity_warnings(files: &[DiffFile]) -> Vec<String> {
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
        vec!["similarityDetectionLimit".into()]
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

fn parse_mode_map(bytes: &[u8]) -> Result<BTreeMap<String, String>, RepositoryPortError> {
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
        modes.insert(path.as_str().to_string(), mode.to_string());
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
        let overview = adapter.load_working_tree_overview(&worktree).unwrap();
        assert_eq!(overview.changed.len(), 5);

        let detail = |path: &str| {
            adapter
                .load_working_tree_file(
                    &worktree,
                    &overview.current_snapshot_id,
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
        assert!(matches!(
            deleted.new_content,
            ContentAvailability::Omitted {
                reason: OmissionReason::MissingSide,
                ..
            }
        ));

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
                .working_tree_context(Path::new("/repo"), &snapshot)
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
        let overview = adapter.load_working_tree_overview(&worktree).unwrap();
        assert_eq!(overview.changed.len(), 2);

        let main = ValidatedRefName::parse("main").unwrap();
        adapter.load_overview(&worktree, Some(&main)).unwrap();

        let modified_path = RepositoryRelativePath::parse("specs/001/tasks.md").unwrap();
        let modified = adapter
            .load_working_tree_file(&worktree, &overview.current_snapshot_id, &modified_path)
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
            .load_working_tree_file(&worktree, &overview.current_snapshot_id, &untracked_path)
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
            adapter.load_working_tree_overview(&worktree).unwrap_err(),
            RepositoryPortError::UnbornHead
        );

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
            new_mode: Some("100644".into()),
        };
        assert!(similarity_warnings(&vec![candidate.clone(); 1000]).is_empty());
        assert_eq!(
            similarity_warnings(&vec![candidate; 1001]),
            vec!["similarityDetectionLimit"]
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
        let committed_path = RepositoryRelativePath::parse("committed.txt").unwrap();
        let committed_review = adapter
            .load_file(&worktree, snapshot, &committed_path)
            .unwrap();
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

        let untracked_path = RepositoryRelativePath::parse("untracked.txt").unwrap();
        let untracked_review = adapter
            .load_file(&worktree, snapshot, &untracked_path)
            .unwrap();
        let StructuredDiff::Available(untracked_hunks) = untracked_review.structured_diff else {
            panic!("untracked text must have a structured diff");
        };
        assert_eq!(untracked_hunks.len(), 1);
        assert!(untracked_hunks[0]
            .lines
            .iter()
            .all(|line| line.kind == DiffLineKind::Added));

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
    fn changed_records_cover_rename_copy_delete_type_and_mode() {
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
        let copied = overview
            .changed
            .iter()
            .find(|file| file.change == FileChangeKind::Copied)
            .unwrap();
        assert_eq!(
            copied.old_path.as_ref().unwrap().as_str(),
            "copy-source.txt"
        );
        assert_eq!(
            copied.new_path.as_ref().unwrap().as_str(),
            "copy-target.txt"
        );
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
            assert_eq!(mode.old_mode.as_deref(), Some("100644"));
            assert_eq!(mode.new_mode.as_deref(), Some("100755"));
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
}
