use crate::domain::repository::{RepositoryPortError, StdioStream};
use std::{
    collections::BTreeSet,
    ffi::OsString,
    io::Read,
    path::Path,
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    thread,
    time::{Duration, Instant},
};

#[derive(Debug, Clone)]
pub struct GitCommandPolicy {
    pub metadata_timeout: Duration,
    pub content_timeout: Duration,
    pub stdout_limit: usize,
    pub stderr_limit: usize,
}
impl Default for GitCommandPolicy {
    fn default() -> Self {
        Self {
            metadata_timeout: Duration::from_secs(15),
            content_timeout: Duration::from_secs(30),
            stdout_limit: 32 * 1024 * 1024,
            stderr_limit: 1024 * 1024,
        }
    }
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GitOperation {
    AllFiles,
    BaseGitlink,
    BaseModes,
    BranchRemote,
    ChangedFiles,
    CheckIgnoredDirectory,
    CommonDir,
    ComparisonRevisionCommit,
    ComparisonRevisionExists,
    ComparisonRevisions,
    CurrentBranch,
    DiffCommentBaseSource,
    FilePatch,
    FileReviewMergeBase,
    GhMergeBase,
    GitDir,
    Head,
    IgnoredRoots,
    IndexGitlink,
    IndexModes,
    IsBare,
    MergeBase,
    MergeBaseOutput,
    ReadStderr,
    ReadStdout,
    RemoteHeads,
    RepositoryRoot,
    SelectedPathIndex,
    SelectedSubmoduleHead,
    SelectedSubmoduleStatus,
    Shallow,
    SnapshotHead,
    SnapshotHeadRecheck,
    SnapshotIndex,
    SnapshotIndexRecheck,
    SnapshotModified,
    SnapshotModifiedRecheck,
    SnapshotSubmoduleHead,
    SnapshotSubmoduleStatus,
    SnapshotUntracked,
    SnapshotUntrackedRecheck,
    SpecFileHistory,
    SubmoduleHead,
    SubmoduleStatus,
    Untracked,
    VerifyMergeBase,
    VerifyRef,
    WorkingTreeFilePatch,
    WorkingTreeHead,
    WorkingTreeHeadReference,
    WorkingTreeSymbolicHead,
    WorktreeList,
    #[cfg(test)]
    TimeoutTest,
    #[cfg(test)]
    BoundedOutputTest,
}

impl GitOperation {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::AllFiles => "all-files",
            Self::BaseGitlink => "base-gitlink",
            Self::BaseModes => "base-modes",
            Self::BranchRemote => "branch-remote",
            Self::ChangedFiles => "changed-files",
            Self::CheckIgnoredDirectory => "check-ignored-directory",
            Self::CommonDir => "common-dir",
            Self::ComparisonRevisionCommit => "comparison-revision-commit",
            Self::ComparisonRevisionExists => "comparison-revision-exists",
            Self::ComparisonRevisions => "comparison-revisions",
            Self::CurrentBranch => "current-branch",
            Self::DiffCommentBaseSource => "diff-comment-base-source",
            Self::FilePatch => "file-patch",
            Self::FileReviewMergeBase => "file-review-merge-base",
            Self::GhMergeBase => "gh-merge-base",
            Self::GitDir => "git-dir",
            Self::Head => "head",
            Self::IgnoredRoots => "ignored-roots",
            Self::IndexGitlink => "index-gitlink",
            Self::IndexModes => "index-modes",
            Self::IsBare => "is-bare",
            Self::MergeBase => "merge-base",
            Self::MergeBaseOutput => "merge-base-output",
            Self::ReadStderr => "read-stderr",
            Self::ReadStdout => "read-stdout",
            Self::RemoteHeads => "remote-heads",
            Self::RepositoryRoot => "repository-root",
            Self::SelectedPathIndex => "selected-path-index",
            Self::SelectedSubmoduleHead => "selected-submodule-head",
            Self::SelectedSubmoduleStatus => "selected-submodule-status",
            Self::Shallow => "shallow",
            Self::SnapshotHead => "snapshot-head",
            Self::SnapshotHeadRecheck => "snapshot-head-recheck",
            Self::SnapshotIndex => "snapshot-index",
            Self::SnapshotIndexRecheck => "snapshot-index-recheck",
            Self::SnapshotModified => "snapshot-modified",
            Self::SnapshotModifiedRecheck => "snapshot-modified-recheck",
            Self::SnapshotSubmoduleHead => "snapshot-submodule-head",
            Self::SnapshotSubmoduleStatus => "snapshot-submodule-status",
            Self::SnapshotUntracked => "snapshot-untracked",
            Self::SnapshotUntrackedRecheck => "snapshot-untracked-recheck",
            Self::SpecFileHistory => "spec-file-history",
            Self::SubmoduleHead => "submodule-head",
            Self::SubmoduleStatus => "submodule-status",
            Self::Untracked => "untracked",
            Self::VerifyMergeBase => "verify-merge-base",
            Self::VerifyRef => "verify-ref",
            Self::WorkingTreeFilePatch => "working-tree-file-patch",
            Self::WorkingTreeHead => "working-tree-head",
            Self::WorkingTreeHeadReference => "working-tree-head-reference",
            Self::WorkingTreeSymbolicHead => "working-tree-symbolic-head",
            Self::WorktreeList => "worktree-list",
            #[cfg(test)]
            Self::TimeoutTest => "timeout-test",
            #[cfg(test)]
            Self::BoundedOutputTest => "bounded-output-test",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GitCommandKind {
    Metadata,
    Content,
}

impl GitCommandKind {
    const fn timeout(self, policy: &GitCommandPolicy) -> Duration {
        match self {
            Self::Metadata => policy.metadata_timeout,
            Self::Content => policy.content_timeout,
        }
    }
}
#[derive(Debug, Clone, Default)]
pub struct GitRunner {
    policy: GitCommandPolicy,
}
impl GitRunner {
    pub fn run(
        &self,
        cwd: &Path,
        operation: GitOperation,
        args: &[&str],
        kind: GitCommandKind,
    ) -> Result<Vec<u8>, RepositoryPortError> {
        self.run_with_stdout_limit(cwd, operation, args, kind, self.policy.stdout_limit)
    }

    pub fn run_with_stdout_limit(
        &self,
        cwd: &Path,
        operation: GitOperation,
        args: &[&str],
        kind: GitCommandKind,
        stdout_limit: usize,
    ) -> Result<Vec<u8>, RepositoryPortError> {
        let mut command = Command::new("git");
        isolate_git_environment(&mut command);
        let mut child = command
            .arg("-C")
            .arg(cwd)
            .args(args)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|error| {
                if error.kind() == std::io::ErrorKind::NotFound {
                    RepositoryPortError::GitUnavailable
                } else {
                    RepositoryPortError::Io
                }
            })?;
        let stdout = child.stdout.take().ok_or(RepositoryPortError::Io)?;
        let stderr = child.stderr.take().ok_or(RepositoryPortError::Io)?;
        let err_limit = self.policy.stderr_limit;
        let out_exceeded = Arc::new(AtomicBool::new(false));
        let err_exceeded = Arc::new(AtomicBool::new(false));
        let out_signal = Arc::clone(&out_exceeded);
        let err_signal = Arc::clone(&err_exceeded);
        let out_reader = thread::spawn(move || read_capped(stdout, stdout_limit, out_signal));
        let err_reader = thread::spawn(move || read_capped(stderr, err_limit, err_signal));
        let timeout = kind.timeout(&self.policy);
        let start = Instant::now();
        let status = loop {
            if out_exceeded.load(Ordering::Acquire) || err_exceeded.load(Ordering::Acquire) {
                let stream = if out_exceeded.load(Ordering::Acquire) {
                    StdioStream::Stdout
                } else {
                    StdioStream::Stderr
                };
                let _ = child.kill();
                let _ = child.wait();
                let _ = out_reader.join();
                let _ = err_reader.join();
                return Err(RepositoryPortError::GitOutputLimitExceeded { stream });
            }
            match child.try_wait() {
                Ok(Some(status)) => break status,
                Ok(None) if start.elapsed() < timeout => thread::sleep(Duration::from_millis(10)),
                Ok(None) => {
                    let _ = child.kill();
                    let _ = child.wait();
                    let _ = out_reader.join();
                    let _ = err_reader.join();
                    return Err(RepositoryPortError::GitTimedOut {
                        operation: operation.as_str().to_owned(),
                    });
                }
                Err(_) => {
                    let _ = child.kill();
                    let _ = child.wait();
                    let _ = out_reader.join();
                    let _ = err_reader.join();
                    return Err(RepositoryPortError::Io);
                }
            }
        };
        let stdout = out_reader
            .join()
            .map_err(|_| reader_thread_error(StdioStream::Stdout))??;
        let stderr = err_reader
            .join()
            .map_err(|_| reader_thread_error(StdioStream::Stderr))??;
        if stdout.1 {
            return Err(RepositoryPortError::GitOutputLimitExceeded {
                stream: StdioStream::Stdout,
            });
        }
        if stderr.1 {
            return Err(RepositoryPortError::GitOutputLimitExceeded {
                stream: StdioStream::Stderr,
            });
        }
        if !status.success() {
            return Err(RepositoryPortError::GitFailed {
                operation: operation.as_str().to_owned(),
                code: status.code(),
                stderr: sanitize_diagnostic(&stderr.0),
            });
        }
        Ok(stdout.0)
    }
}

pub(super) fn isolate_git_environment(command: &mut Command) {
    command
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env(
            "GIT_CONFIG_GLOBAL",
            if cfg!(windows) { "NUL" } else { "/dev/null" },
        )
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GCM_INTERACTIVE", "Never")
        .env("GIT_OPTIONAL_LOCKS", "0")
        .env("GIT_PAGER", "cat")
        .env("LC_ALL", "C")
        .env("LANG", "C")
        .env("TZ", "UTC")
        .env_remove("GIT_CONFIG_COUNT")
        .env_remove("GIT_CONFIG_PARAMETERS");

    let injected_config_names = command
        .get_envs()
        .map(|(name, _)| name.to_os_string())
        .chain(std::env::vars_os().map(|(name, _)| name))
        .filter(|name| is_indexed_git_config_name(name))
        .collect::<BTreeSet<OsString>>();
    for name in injected_config_names {
        command.env_remove(name);
    }
}

fn is_indexed_git_config_name(name: &std::ffi::OsStr) -> bool {
    let name = name.to_string_lossy();
    ["GIT_CONFIG_KEY_", "GIT_CONFIG_VALUE_"]
        .iter()
        .any(|prefix| {
            name.strip_prefix(prefix).is_some_and(|suffix| {
                !suffix.is_empty() && suffix.bytes().all(|byte| byte.is_ascii_digit())
            })
        })
}

fn sanitize_diagnostic(bytes: &[u8]) -> String {
    let mut sanitized = String::new();
    for character in String::from_utf8_lossy(bytes).chars() {
        for escaped in character.escape_default() {
            if sanitized.len() >= 4096 {
                return sanitized;
            }
            sanitized.push(escaped);
        }
    }
    sanitized
}

fn reader_thread_error(stream: StdioStream) -> RepositoryPortError {
    let operation = match stream {
        StdioStream::Stdout => GitOperation::ReadStdout,
        StdioStream::Stderr => GitOperation::ReadStderr,
    };
    RepositoryPortError::GitFailed {
        operation: operation.as_str().to_owned(),
        code: None,
        stderr: format!("{stream} reader thread terminated unexpectedly"),
    }
}

fn read_capped(
    mut reader: impl Read,
    limit: usize,
    exceeded_signal: Arc<AtomicBool>,
) -> Result<(Vec<u8>, bool), RepositoryPortError> {
    let mut bytes = Vec::new();
    let mut chunk = [0_u8; 8192];
    let mut exceeded = false;
    loop {
        let read = reader
            .read(&mut chunk)
            .map_err(|_| RepositoryPortError::Io)?;
        if read == 0 {
            break;
        }
        let remaining = limit.saturating_sub(bytes.len());
        bytes.extend_from_slice(&chunk[..read.min(remaining)]);
        if read > remaining {
            exceeded = true;
            exceeded_signal.store(true, Ordering::Release);
            break;
        }
    }
    Ok((bytes, exceeded))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::OsStr;

    #[test]
    fn r199_git_001_env_isolation() {
        let mut command = Command::new("git");
        command
            .env("GIT_CONFIG_COUNT", "8")
            .env("GIT_CONFIG_KEY_7", "credential.helper")
            .env("GIT_CONFIG_VALUE_7", "malicious")
            .env("GIT_CONFIG_PARAMETERS", "'core.hooksPath'='/tmp/hooks'");
        isolate_git_environment(&mut command);
        let values = command
            .get_envs()
            .collect::<std::collections::BTreeMap<_, _>>();
        assert_eq!(
            values.get(OsStr::new("GIT_CONFIG_NOSYSTEM")),
            Some(&Some(OsStr::new("1")))
        );
        assert_eq!(
            values.get(OsStr::new("GIT_TERMINAL_PROMPT")),
            Some(&Some(OsStr::new("0")))
        );
        assert_eq!(
            values.get(OsStr::new("GIT_OPTIONAL_LOCKS")),
            Some(&Some(OsStr::new("0")))
        );
        assert_eq!(
            values.get(OsStr::new("GIT_PAGER")),
            Some(&Some(OsStr::new("cat")))
        );
        assert_eq!(
            values.get(OsStr::new("LC_ALL")),
            Some(&Some(OsStr::new("C")))
        );
        assert_eq!(values.get(OsStr::new("TZ")), Some(&Some(OsStr::new("UTC"))));
        assert_eq!(values.get(OsStr::new("GIT_CONFIG_COUNT")), Some(&None));
        assert_eq!(values.get(OsStr::new("GIT_CONFIG_KEY_7")), Some(&None));
        assert_eq!(values.get(OsStr::new("GIT_CONFIG_VALUE_7")), Some(&None));
        assert_eq!(values.get(OsStr::new("GIT_CONFIG_PARAMETERS")), Some(&None));
    }

    #[test]
    fn diagnostics_escape_control_characters_and_are_bounded() {
        let input = format!("line\nsecret\0{}", "x".repeat(5000));
        let diagnostic = sanitize_diagnostic(input.as_bytes());
        assert!(!diagnostic.contains('\n'));
        assert!(!diagnostic.contains('\0'));
        assert!(diagnostic.contains("\\n"));
        assert!(diagnostic.len() <= 4096);
    }

    #[test]
    fn default_policy_matches_contract() {
        let p = GitCommandPolicy::default();
        assert_eq!(p.metadata_timeout, Duration::from_secs(15));
        assert_eq!(p.content_timeout, Duration::from_secs(30));
        assert_eq!(p.stdout_limit, 32 * 1024 * 1024);
        assert_eq!(p.stderr_limit, 1024 * 1024);
    }

    #[cfg(unix)]
    #[test]
    fn timeout_returns_typed_error_after_killing_and_reaping_child() {
        let runner = GitRunner {
            policy: GitCommandPolicy {
                metadata_timeout: Duration::from_millis(20),
                ..GitCommandPolicy::default()
            },
        };
        let error = runner
            .run(
                Path::new(env!("CARGO_MANIFEST_DIR")),
                "timeout-test",
                &["-c", "alias.pause=!sleep 0.2", "pause"],
                false,
            )
            .unwrap_err();
        assert_eq!(
            error,
            RepositoryPortError::GitTimedOut {
                operation: "timeout-test".into()
            }
        );
    }

    #[test]
    fn stdout_cap_returns_typed_error_without_partial_output() {
        let runner = GitRunner {
            policy: GitCommandPolicy {
                stdout_limit: 8,
                ..GitCommandPolicy::default()
            },
        };
        let error = runner
            .run(
                Path::new(env!("CARGO_MANIFEST_DIR")),
                "bounded-output-test",
                &["rev-parse", "--show-toplevel"],
                false,
            )
            .unwrap_err();
        assert_eq!(
            error,
            RepositoryPortError::GitOutputLimitExceeded {
                stream: "stdout".into()
            }
        );
    }

    #[test]
    fn capped_reader_signals_at_limit_plus_one() {
        let signal = Arc::new(AtomicBool::new(false));
        let (bytes, exceeded) = read_capped(&b"12345"[..], 4, Arc::clone(&signal)).unwrap();
        assert_eq!(bytes, b"1234");
        assert!(exceeded);
        assert!(signal.load(Ordering::Acquire));
    }
}
