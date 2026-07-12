#![allow(dead_code)]

use std::{
    fs,
    path::{Path, PathBuf},
    sync::Arc,
    time::{Duration, SystemTime},
};

use chrono::{DateTime, Utc};
use spec_reviewer_lib::{
    domain::{
        comment::{CommentBody, CommentId, CommentStatus, TextSnippet},
        spec::{MarkdownBlockHash, MarkdownBlockType, SpecFileKey, SpecId},
        user_review::{
            PositiveLineNumber, UserReview, UserReviewComment, UserReviewId, UserReviewRepository,
            UserReviewSource, UserReviewTarget,
        },
        workspace::{WorkspaceConfig, WorkspaceLayout, WorkspaceRelativePath, WorkspaceRoot},
    },
    infrastructure::persistence::{
        user_review_document::encode_user_review_document,
        user_review_repository::{ArchiveMutationObserver, JsonUserReviewRepository},
    },
};
use uuid::Uuid;

pub const SPEC_ID: &str = "001-auth-flow";
pub const SOURCE_PATH: &str = ".plugin-workspace/.specs/001-auth-flow/tasks.md";

pub struct TestWorkspace {
    root: PathBuf,
    layout: WorkspaceLayout,
}

impl TestWorkspace {
    pub fn new(label: &str) -> Self {
        let root = std::env::temp_dir().join(format!(
            "spec-reviewer-user-review-repository-{label}-{}",
            Uuid::new_v4().simple()
        ));
        fs::create_dir_all(root.join(".plugin-workspace/.specs/001-auth-flow"))
            .expect("test spec directory should be created");
        let workspace_root = WorkspaceRoot::new(root.to_string_lossy().into_owned())
            .expect("test workspace root should be valid");

        Self {
            root,
            layout: WorkspaceLayout::plugin_workspace(workspace_root),
        }
    }

    pub fn repository(&self) -> JsonUserReviewRepository {
        JsonUserReviewRepository::new(
            self.layout.clone(),
            WorkspaceConfig::plugin_workspace_default(),
        )
    }

    pub fn repository_with_archive_observer(
        &self,
        observer: Arc<dyn ArchiveMutationObserver>,
    ) -> JsonUserReviewRepository {
        JsonUserReviewRepository::with_archive_observer(
            self.layout.clone(),
            WorkspaceConfig::plugin_workspace_default(),
            observer,
        )
    }

    pub fn repository_with_cleanup_observer(
        &self,
        age: Duration,
        observer: Arc<dyn ArchiveMutationObserver>,
    ) -> JsonUserReviewRepository {
        JsonUserReviewRepository::with_temp_cleanup_age_and_observer(
            self.layout.clone(),
            WorkspaceConfig::plugin_workspace_default(),
            age,
            observer,
        )
    }

    pub fn repository_with_cleanup_age(&self, age: Duration) -> JsonUserReviewRepository {
        JsonUserReviewRepository::with_temp_cleanup_age(
            self.layout.clone(),
            WorkspaceConfig::plugin_workspace_default(),
            age,
        )
    }

    pub fn active_directory(&self) -> PathBuf {
        self.user_review_directory().join("active")
    }

    pub fn archive_directory(&self) -> PathBuf {
        self.user_review_directory().join("archive")
    }

    pub fn active_record_path(&self, id: &UserReviewId) -> PathBuf {
        self.active_directory().join(format!("{id}.json"))
    }

    pub fn archive_record_path(&self, id: &UserReviewId) -> PathBuf {
        self.archive_directory().join(format!("{id}.json"))
    }

    pub fn write_review(&self, path: &Path, review: &UserReview) {
        let parent = path.parent().expect("test record should have a parent");
        fs::create_dir_all(parent).expect("test record directory should be created");
        fs::write(
            path,
            encode_user_review_document(review).expect("test review should encode"),
        )
        .expect("test review should be written");
    }

    pub fn replace_review(&self, path: &Path, review: &UserReview) {
        let parent = path.parent().expect("test record should have a parent");
        let temporary_path = parent.join(format!(
            ".external-replacement-{}.tmp",
            Uuid::new_v4().simple()
        ));
        self.write_review(&temporary_path, review);
        fs::rename(temporary_path, path).expect("test record replacement should be atomic");
    }

    pub fn replace_raw(&self, path: &Path, contents: &str) {
        let parent = path.parent().expect("test record should have a parent");
        let temporary_path = parent.join(format!(
            ".external-replacement-{}.tmp",
            Uuid::new_v4().simple()
        ));
        self.write_raw(&temporary_path, contents);
        fs::rename(temporary_path, path).expect("test raw replacement should be atomic");
    }

    pub fn capture_paths(&self) -> Vec<PathBuf> {
        let Ok(entries) = fs::read_dir(self.active_directory()) else {
            return Vec::new();
        };
        entries
            .filter_map(Result::ok)
            .filter(|entry| {
                entry
                    .file_name()
                    .to_string_lossy()
                    .starts_with(".user-review-capture-")
            })
            .map(|entry| entry.path())
            .collect()
    }

    pub fn cleanup_capture_paths(&self) -> Vec<PathBuf> {
        let Ok(entries) = fs::read_dir(self.active_directory()) else {
            return Vec::new();
        };
        entries
            .filter_map(Result::ok)
            .filter(|entry| {
                entry
                    .file_name()
                    .to_string_lossy()
                    .starts_with(".user-review-cleanup-")
            })
            .map(|entry| entry.path())
            .collect()
    }

    pub fn set_file_age(&self, path: &Path, age: Duration) {
        let modified = SystemTime::now()
            .checked_sub(age)
            .expect("test file age should be representable");
        let file = fs::OpenOptions::new()
            .write(true)
            .open(path)
            .expect("test file should open for timestamp update");
        file.set_times(fs::FileTimes::new().set_modified(modified))
            .expect("test file timestamp should be updated");
    }

    pub fn write_raw(&self, path: &Path, contents: &str) {
        let parent = path.parent().expect("test record should have a parent");
        fs::create_dir_all(parent).expect("test record directory should be created");
        fs::write(path, contents).expect("test record should be written");
    }

    pub fn known_temp_path(&self, directory: &Path, id: &UserReviewId, nonce: Uuid) -> PathBuf {
        directory.join(format!(".user-review-{id}-{}.tmp", nonce.simple()))
    }

    pub fn user_review_directory(&self) -> PathBuf {
        self.root
            .join(".plugin-workspace/.specs/001-auth-flow/user-review")
    }
}

impl Drop for TestWorkspace {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

pub fn user_review_id(value: u128) -> UserReviewId {
    UserReviewId::new(format!("urv_{value:032x}")).expect("test review id should be valid")
}

pub fn target() -> UserReviewTarget {
    file_target(SpecFileKey::Tasks)
}

pub fn file_target(file_key: SpecFileKey) -> UserReviewTarget {
    UserReviewTarget::file(
        SpecId::new(SPEC_ID).expect("test spec id should be valid"),
        file_key,
    )
}

pub fn timestamp(minute: u32) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(&format!("2026-05-06T12:{minute:02}:00.000Z"))
        .expect("test timestamp should parse")
        .with_timezone(&Utc)
}

pub fn active_review(value: u128, body: &str) -> UserReview {
    active_review_with_source_path(value, body, SOURCE_PATH)
}

pub fn active_review_with_source_path(value: u128, body: &str, source_path: &str) -> UserReview {
    let review_target = target();
    let comment = UserReviewComment::new(
        CommentId::new(format!("cmt_{value}")).expect("test comment id should be valid"),
        CommentStatus::Open,
        UserReviewSource::new(
            review_target.spec_id().clone(),
            SpecFileKey::Tasks,
            WorkspaceRelativePath::new(source_path)
                .expect("test source path should be workspace-relative"),
        ),
        MarkdownBlockType::Paragraph,
        PositiveLineNumber::new(42).expect("test line should be positive"),
        PositiveLineNumber::new(48).expect("test line should be positive"),
        TextSnippet::new("Target text").expect("test snippet should be valid"),
        MarkdownBlockHash::new("sha256:d4b1ea57").expect("test hash should be valid"),
        CommentBody::new(body).expect("test body should be valid"),
        timestamp(39),
        timestamp(39),
    )
    .expect("test review comment should be valid");

    UserReview::new(
        user_review_id(value),
        review_target,
        vec![comment],
        timestamp(40),
    )
    .expect("test review should be valid")
}

pub fn archived_review(mut review: UserReview, minute: u32) -> UserReview {
    let id = review.id().clone();
    let review_target = review.target().clone();
    review
        .archive(&id, &review_target, timestamp(minute))
        .expect("test review should archive");
    review
}

pub fn create(repository: &impl UserReviewRepository, review: UserReview) -> UserReview {
    repository
        .create(review)
        .expect("test review should be created")
        .into_user_review()
}

pub fn encoded_review(review: &UserReview) -> Vec<u8> {
    encode_user_review_document(review)
        .expect("test review should encode")
        .into_bytes()
}
