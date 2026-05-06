//! Git adapters used by review run worktree isolation.

use std::{
    fs, io,
    path::{Path, PathBuf},
    process::{Command, Output},
};

use thiserror::Error;

use crate::domain::review_run::ReviewRunBranchName;

#[derive(Debug, Clone, Copy, Default)]
pub struct GitReviewWorktreeService;

impl GitReviewWorktreeService {
    pub fn new() -> Self {
        Self
    }

    pub fn prepare_worktree(
        &self,
        workspace_path: impl AsRef<Path>,
        source_paths: &[PathBuf],
        branch_name: &ReviewRunBranchName,
    ) -> Result<GitReviewWorktree, GitReviewWorktreeError> {
        let workspace_path = canonicalize_existing_path(workspace_path.as_ref())?;
        let repository_path = self.detect_repository(&workspace_path)?;
        let worktree_path = default_review_worktree_path(&repository_path, branch_name)?;

        validate_worktree_path(&workspace_path, &worktree_path)?;
        self.ensure_branch_available(&repository_path, branch_name)?;
        self.ensure_source_files_clean(&repository_path, source_paths)?;
        create_worktree_parent(&worktree_path)?;
        self.add_worktree(&repository_path, &worktree_path, branch_name)?;

        Ok(GitReviewWorktree::new(
            repository_path,
            worktree_path,
            branch_name.clone(),
        ))
    }

    fn detect_repository(&self, workspace_path: &Path) -> Result<PathBuf, GitReviewWorktreeError> {
        let output = run_git([
            "-C".to_string(),
            display_path(workspace_path),
            "rev-parse".to_string(),
            "--show-toplevel".to_string(),
        ])?;

        if !output.status.success() {
            return Err(GitReviewWorktreeError::NotGitRepository {
                path: display_path(workspace_path),
            });
        }

        let repository_path = String::from_utf8_lossy(&output.stdout).trim().to_string();

        canonicalize_existing_path(Path::new(&repository_path))
    }

    fn ensure_branch_available(
        &self,
        repository_path: &Path,
        branch_name: &ReviewRunBranchName,
    ) -> Result<(), GitReviewWorktreeError> {
        let ref_name = format!("refs/heads/{}", branch_name.as_str());
        let output = run_git([
            "-C".to_string(),
            display_path(repository_path),
            "show-ref".to_string(),
            "--verify".to_string(),
            "--quiet".to_string(),
            ref_name,
        ])?;

        match output.status.code() {
            Some(0) => Err(GitReviewWorktreeError::BranchAlreadyExists {
                branch_name: branch_name.as_str().to_string(),
            }),
            Some(1) => Ok(()),
            _ => Err(GitReviewWorktreeError::GitCommandFailed {
                command: "git show-ref --verify --quiet".to_string(),
                message: stderr_message(&output),
            }),
        }
    }

    fn ensure_source_files_clean(
        &self,
        repository_path: &Path,
        source_paths: &[PathBuf],
    ) -> Result<(), GitReviewWorktreeError> {
        let mut dirty_paths = Vec::new();

        for source_path in source_paths {
            let source_path = canonicalize_existing_path(source_path)?;
            let relative_path = source_path.strip_prefix(repository_path).map_err(|_| {
                GitReviewWorktreeError::SourceFileOutsideRepository {
                    source_path: display_path(&source_path),
                    repository_path: display_path(repository_path),
                }
            })?;
            let output = run_git([
                "-C".to_string(),
                display_path(repository_path),
                "status".to_string(),
                "--porcelain=v1".to_string(),
                "--untracked-files=all".to_string(),
                "--".to_string(),
                display_path(relative_path),
            ])?;

            if !output.status.success() {
                return Err(GitReviewWorktreeError::GitCommandFailed {
                    command: "git status --porcelain=v1".to_string(),
                    message: stderr_message(&output),
                });
            }

            if !output.stdout.is_empty() {
                dirty_paths.push(display_path(relative_path));
            }
        }

        if dirty_paths.is_empty() {
            return Ok(());
        }

        dirty_paths.sort();
        dirty_paths.dedup();

        Err(GitReviewWorktreeError::DirtySourceFiles { dirty_paths })
    }

    fn add_worktree(
        &self,
        repository_path: &Path,
        worktree_path: &Path,
        branch_name: &ReviewRunBranchName,
    ) -> Result<(), GitReviewWorktreeError> {
        let output = run_git([
            "-C".to_string(),
            display_path(repository_path),
            "worktree".to_string(),
            "add".to_string(),
            "-b".to_string(),
            branch_name.as_str().to_string(),
            display_path(worktree_path),
            "HEAD".to_string(),
        ])?;

        if output.status.success() {
            return Ok(());
        }

        Err(GitReviewWorktreeError::WorktreeAddFailed {
            worktree_path: display_path(worktree_path),
            branch_name: branch_name.as_str().to_string(),
            message: stderr_message(&output),
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GitReviewWorktree {
    repository_path: PathBuf,
    worktree_path: PathBuf,
    branch_name: ReviewRunBranchName,
}

impl GitReviewWorktree {
    fn new(
        repository_path: PathBuf,
        worktree_path: PathBuf,
        branch_name: ReviewRunBranchName,
    ) -> Self {
        Self {
            repository_path,
            worktree_path,
            branch_name,
        }
    }

    pub fn repository_path(&self) -> &Path {
        &self.repository_path
    }

    pub fn worktree_path(&self) -> &Path {
        &self.worktree_path
    }

    pub fn branch_name(&self) -> &ReviewRunBranchName {
        &self.branch_name
    }
}

#[derive(Debug, Error)]
pub enum GitReviewWorktreeError {
    #[error("workspace is not inside a Git repository: {path}")]
    NotGitRepository { path: String },
    #[error("failed to inspect Git path: {path}")]
    InspectPath { path: String, source: io::Error },
    #[error("review worktree parent directory is unavailable: {path}")]
    MissingWorktreeParent { path: String },
    #[error("review worktree path must be outside the selected workspace: {path}")]
    WorktreeInsideWorkspace { path: String },
    #[error("review worktree path already exists: {path}")]
    WorktreePathAlreadyExists { path: String },
    #[error("review branch already exists: {branch_name}")]
    BranchAlreadyExists { branch_name: String },
    #[error(
        "review source file is outside the Git repository: {source_path} (repo: {repository_path})"
    )]
    SourceFileOutsideRepository {
        source_path: String,
        repository_path: String,
    },
    #[error("review source files have uncommitted changes: {dirty_paths:?}")]
    DirtySourceFiles { dirty_paths: Vec<String> },
    #[error("failed to run {command}: {message}")]
    GitCommandFailed { command: String, message: String },
    #[error("failed to create review worktree at {worktree_path} on {branch_name}: {message}")]
    WorktreeAddFailed {
        worktree_path: String,
        branch_name: String,
        message: String,
    },
}

impl GitReviewWorktreeError {
    pub fn message(&self) -> String {
        match self {
            Self::DirtySourceFiles { dirty_paths } => {
                format!(
                    "review source files have uncommitted changes; commit or stash them before using worktree mode: {}",
                    dirty_paths.join(", ")
                )
            }
            _ => self.to_string(),
        }
    }
}

fn default_review_worktree_path(
    repository_path: &Path,
    branch_name: &ReviewRunBranchName,
) -> Result<PathBuf, GitReviewWorktreeError> {
    let parent =
        repository_path
            .parent()
            .ok_or_else(|| GitReviewWorktreeError::MissingWorktreeParent {
                path: display_path(repository_path),
            })?;
    let repository_name = repository_path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| "repository".to_string());
    let run_directory = branch_name
        .as_str()
        .strip_prefix("spec-reviewer/")
        .unwrap_or_else(|| branch_name.as_str())
        .replace('/', "-");

    Ok(parent
        .join(format!("{repository_name}.spec-reviewer-worktrees"))
        .join(run_directory))
}

fn validate_worktree_path(
    workspace_path: &Path,
    worktree_path: &Path,
) -> Result<(), GitReviewWorktreeError> {
    if worktree_path.starts_with(workspace_path) {
        return Err(GitReviewWorktreeError::WorktreeInsideWorkspace {
            path: display_path(worktree_path),
        });
    }

    if worktree_path.exists() {
        return Err(GitReviewWorktreeError::WorktreePathAlreadyExists {
            path: display_path(worktree_path),
        });
    }

    Ok(())
}

fn create_worktree_parent(worktree_path: &Path) -> Result<(), GitReviewWorktreeError> {
    let parent =
        worktree_path
            .parent()
            .ok_or_else(|| GitReviewWorktreeError::MissingWorktreeParent {
                path: display_path(worktree_path),
            })?;

    fs::create_dir_all(parent).map_err(|source| GitReviewWorktreeError::InspectPath {
        path: display_path(parent),
        source,
    })
}

fn canonicalize_existing_path(path: &Path) -> Result<PathBuf, GitReviewWorktreeError> {
    path.canonicalize()
        .map_err(|source| GitReviewWorktreeError::InspectPath {
            path: display_path(path),
            source,
        })
}

fn run_git<I, S>(arguments: I) -> Result<Output, GitReviewWorktreeError>
where
    I: IntoIterator<Item = S>,
    S: AsRef<std::ffi::OsStr>,
{
    Command::new("git")
        .args(arguments)
        .output()
        .map_err(|source| GitReviewWorktreeError::GitCommandFailed {
            command: "git".to_string(),
            message: source.to_string(),
        })
}

fn stderr_message(output: &Output) -> String {
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if stderr.is_empty() {
        return format!("git exited with status {}", output.status);
    }

    stderr
}

fn display_path(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

#[cfg(test)]
mod tests {
    use std::{
        env, fs,
        path::{Path, PathBuf},
        time::{SystemTime, UNIX_EPOCH},
    };

    use super::*;
    use crate::domain::review_run::UserReviewRunId;

    struct TestRepo {
        root: PathBuf,
        worktree_parent: PathBuf,
    }

    impl TestRepo {
        fn new(name: &str) -> Self {
            let timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system time should be after unix epoch")
                .as_nanos();
            let root = env::temp_dir().join(format!(
                "spec-reviewer-git-worktree-{name}-{}-{timestamp}",
                std::process::id()
            ));
            let worktree_parent = root.with_file_name(format!(
                "{}.spec-reviewer-worktrees",
                root.file_name()
                    .expect("root should have a name")
                    .to_string_lossy()
            ));
            fs::create_dir_all(&root).expect("repo directory should be created");
            run_git_command(&root, ["init"]);
            run_git_command(&root, ["config", "user.email", "test@example.com"]);
            run_git_command(&root, ["config", "user.name", "Spec Reviewer Test"]);

            Self {
                root,
                worktree_parent,
            }
        }

        fn root(&self) -> &Path {
            &self.root
        }

        fn write_file(&self, relative_path: &str, contents: &str) -> PathBuf {
            let path = self.root.join(relative_path);
            fs::create_dir_all(path.parent().expect("file should have parent"))
                .expect("parent should be created");
            fs::write(&path, contents).expect("file should be written");
            path
        }

        fn commit_all(&self) {
            run_git_command(&self.root, ["add", "."]);
            run_git_command(&self.root, ["commit", "-m", "Initial commit"]);
        }
    }

    impl Drop for TestRepo {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
            let _ = fs::remove_dir_all(&self.worktree_parent);
        }
    }

    fn run_git_command<const N: usize>(directory: &Path, arguments: [&str; N]) {
        let status = Command::new("git")
            .arg("-C")
            .arg(directory)
            .args(arguments)
            .status()
            .expect("git command should run");

        assert!(status.success(), "git command should succeed");
    }

    fn branch_name() -> ReviewRunBranchName {
        let id = UserReviewRunId::new("2026-05-06T120000Z-file-tasks").expect("id should be valid");

        ReviewRunBranchName::for_run(&id)
    }

    #[test]
    fn prepare_worktree_creates_sibling_checkout_on_review_branch() {
        let repo = TestRepo::new("create");
        let source_file = repo.write_file(".plugin-workspace/.specs/auth/tasks.md", "# Tasks\n");
        repo.commit_all();
        let service = GitReviewWorktreeService::new();

        let worktree = service
            .prepare_worktree(repo.root(), &[source_file], &branch_name())
            .expect("worktree should be created");

        assert!(worktree.worktree_path().is_dir());
        assert!(!worktree.worktree_path().starts_with(repo.root()));
        assert_eq!(
            "spec-reviewer/2026-05-06T120000Z-file-tasks",
            worktree.branch_name().as_str()
        );
        assert!(worktree
            .worktree_path()
            .join(".plugin-workspace/.specs/auth/tasks.md")
            .is_file());
    }

    #[test]
    fn prepare_worktree_rejects_dirty_source_files() {
        let repo = TestRepo::new("dirty");
        let source_file = repo.write_file(".plugin-workspace/.specs/auth/tasks.md", "# Tasks\n");
        repo.commit_all();
        fs::write(&source_file, "# Tasks\n\nChanged\n").expect("source should change");
        let service = GitReviewWorktreeService::new();

        let result = service.prepare_worktree(repo.root(), &[source_file], &branch_name());

        assert!(matches!(
            result,
            Err(GitReviewWorktreeError::DirtySourceFiles { .. })
        ));
    }

    #[test]
    fn prepare_worktree_rejects_existing_branch() {
        let repo = TestRepo::new("branch-conflict");
        let source_file = repo.write_file(".plugin-workspace/.specs/auth/tasks.md", "# Tasks\n");
        repo.commit_all();
        run_git_command(
            repo.root(),
            ["branch", "spec-reviewer/2026-05-06T120000Z-file-tasks"],
        );
        let service = GitReviewWorktreeService::new();

        let result = service.prepare_worktree(repo.root(), &[source_file], &branch_name());

        assert!(matches!(
            result,
            Err(GitReviewWorktreeError::BranchAlreadyExists { .. })
        ));
    }

    #[test]
    fn prepare_worktree_rejects_existing_worktree_path() {
        let repo = TestRepo::new("path-conflict");
        let source_file = repo.write_file(".plugin-workspace/.specs/auth/tasks.md", "# Tasks\n");
        repo.commit_all();
        fs::create_dir_all(repo.worktree_parent.join("2026-05-06T120000Z-file-tasks"))
            .expect("conflicting path should be created");
        let service = GitReviewWorktreeService::new();

        let result = service.prepare_worktree(repo.root(), &[source_file], &branch_name());

        assert!(matches!(
            result,
            Err(GitReviewWorktreeError::WorktreePathAlreadyExists { .. })
        ));
    }
}
