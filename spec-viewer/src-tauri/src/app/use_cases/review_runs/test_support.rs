//! Shared test fixtures for review run use case tests.

use std::{
    env, fs,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

use serde_json::Value;

use crate::{
    app::use_cases::{ArchiveReviewRunInput, CreateReviewRunInput, ReviewRunExecutionMode},
    domain::{
        comment::CommentId,
        review_run::{UserReviewRunId, UserReviewRunTarget},
        spec::{SpecFileKey, SpecId},
    },
};

pub(crate) struct TestWorkspace {
    root: PathBuf,
    worktree_parent: PathBuf,
}

impl TestWorkspace {
    pub(crate) fn new(name: &str) -> Self {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after unix epoch")
            .as_nanos();
        let root = env::temp_dir().join(format!(
            "spec-reviewer-review-run-use-case-{name}-{}-{timestamp}",
            std::process::id()
        ));
        fs::create_dir_all(root.join(".plugin-workspace/.specs/auth/.comments"))
            .expect("test workspace should be created");
        let worktree_parent = root.with_file_name(format!(
            "{}.spec-reviewer-worktrees",
            root.file_name()
                .expect("root should have a name")
                .to_string_lossy()
        ));

        Self {
            root,
            worktree_parent,
        }
    }

    pub(crate) fn root_path(&self) -> &Path {
        &self.root
    }

    pub(crate) fn root_string(&self) -> String {
        self.root.to_string_lossy().into_owned()
    }

    pub(crate) fn task_file_path(&self) -> PathBuf {
        self.root
            .join(".plugin-workspace/.specs/auth")
            .join("tasks.md")
    }

    pub(crate) fn impl_file_path(&self) -> PathBuf {
        self.root
            .join(".plugin-workspace/.specs/auth")
            .join("implementation-plan.md")
    }

    pub(crate) fn active_directory(&self) -> PathBuf {
        self.root
            .join(".plugin-workspace/.specs/auth/user-review/active")
    }

    pub(crate) fn archive_directory(&self) -> PathBuf {
        self.root
            .join(".plugin-workspace/.specs/auth/user-review/archive")
    }

    pub(crate) fn worktree_parent(&self) -> &Path {
        &self.worktree_parent
    }

    pub(crate) fn write_task_file(&self, contents: &str) {
        fs::write(self.task_file_path(), contents).expect("task file should be written");
    }

    pub(crate) fn write_impl_file(&self, contents: &str) {
        fs::write(self.impl_file_path(), contents).expect("impl file should be written");
    }

    pub(crate) fn write_comment_file(&self, comment_id: &str) {
        let contents = format!(
            r#"{{
  "version": 1,
  "comments": [
    {{
      "id": "{comment_id}",
      "anchor": {{
        "blockType": "paragraph",
        "blockIndex": 1,
        "textHash": "sha256:stale",
        "textSnippet": "Clarify checkout task",
        "charOffset": [0, 22]
      }},
      "body": "ここを明確にしてください",
      "resolved": false,
      "createdAt": "2026-05-06T12:00:00Z",
      "updatedAt": "2026-05-06T12:00:00Z"
    }}
  ]
}}"#
        );

        fs::write(
            self.root
                .join(".plugin-workspace/.specs/auth/.comments/tasks.json"),
            contents,
        )
        .expect("comment file should be written");
    }

    pub(crate) fn write_impl_comment_file(&self, comment_id: &str) {
        let contents = format!(
            r#"{{
  "version": 1,
  "comments": [
    {{
      "id": "{comment_id}",
      "anchor": {{
        "blockType": "paragraph",
        "blockIndex": 1,
        "textHash": "sha256:stale",
        "textSnippet": "Clarify implementation plan",
        "charOffset": [0, 27]
      }},
      "body": "ここを明確にしてください",
      "resolved": false,
      "createdAt": "2026-05-06T12:00:00Z",
      "updatedAt": "2026-05-06T12:00:00Z"
    }}
  ]
}}"#
        );

        fs::write(
            self.root
                .join(".plugin-workspace/.specs/auth/.comments/impl.json"),
            contents,
        )
        .expect("impl comment file should be written");
    }

    pub(crate) fn read_json(&self, path: &Path) -> Value {
        let contents = fs::read_to_string(path).expect("json file should be readable");

        serde_json::from_str(&contents).expect("json should parse")
    }

    pub(crate) fn write_json(&self, path: &Path, value: &Value) {
        fs::write(
            path,
            format!(
                "{}\n",
                serde_json::to_string_pretty(value).expect("json should serialize")
            ),
        )
        .expect("json file should be written");
    }

    pub(crate) fn initialize_git_repo(&self) {
        self.run_git(["init"]);
        self.run_git(["config", "user.email", "test@example.com"]);
        self.run_git(["config", "user.name", "Spec Reviewer Test"]);
    }

    pub(crate) fn commit_all(&self) {
        self.run_git(["add", "."]);
        self.run_git(["commit", "-m", "Initial workspace"]);
    }

    fn run_git<const N: usize>(&self, arguments: [&str; N]) {
        let status = Command::new("git")
            .arg("-C")
            .arg(&self.root)
            .args(arguments)
            .status()
            .expect("git command should run");

        assert!(status.success(), "git command should succeed");
    }
}

impl Drop for TestWorkspace {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
        let _ = fs::remove_dir_all(&self.worktree_parent);
    }
}

pub(crate) fn create_file_run_input(comment_id: &str) -> CreateReviewRunInput {
    CreateReviewRunInput::new(
        UserReviewRunTarget::file(
            SpecId::new("auth").expect("spec id should be valid"),
            SpecFileKey::Tasks,
        ),
        vec![CommentId::new(comment_id).expect("comment id should be valid")],
        ReviewRunExecutionMode::CurrentWorkspace,
    )
}

pub(crate) fn create_impl_file_run_input(comment_id: &str) -> CreateReviewRunInput {
    CreateReviewRunInput::new(
        UserReviewRunTarget::file(
            SpecId::new("auth").expect("spec id should be valid"),
            SpecFileKey::Impl,
        ),
        vec![CommentId::new(comment_id).expect("comment id should be valid")],
        ReviewRunExecutionMode::CurrentWorkspace,
    )
}

pub(crate) fn create_worktree_file_run_input(comment_id: &str) -> CreateReviewRunInput {
    CreateReviewRunInput::new(
        UserReviewRunTarget::file(
            SpecId::new("auth").expect("spec id should be valid"),
            SpecFileKey::Tasks,
        ),
        vec![CommentId::new(comment_id).expect("comment id should be valid")],
        ReviewRunExecutionMode::Worktree,
    )
}

pub(crate) fn archive_file_run_input(run_id: &str) -> ArchiveReviewRunInput {
    ArchiveReviewRunInput::new(
        UserReviewRunTarget::file(
            SpecId::new("auth").expect("spec id should be valid"),
            SpecFileKey::Tasks,
        ),
        UserReviewRunId::new(run_id).expect("run id should be valid"),
    )
}
