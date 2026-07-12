//! User review run JSON schema DTOs.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::domain::{
    review_run::USER_REVIEW_MANIFEST_SCHEMA_VERSION,
    spec::{SpecDomainError, SpecId},
};

pub fn parse_persisted_spec_id(value: impl Into<String>) -> Result<SpecId, SpecDomainError> {
    SpecId::new(value)
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewRunManifestDocument {
    pub schema_version: String,
    pub id: String,
    pub status: ReviewRunStatusValue,
    pub workspace_path: String,
    pub target: ReviewRunTargetDocument,
    pub spec_folder_path: String,
    pub execution_target: ReviewRunExecutionTargetDocument,
    pub source_files: Vec<ReviewRunSourceFileDocument>,
    pub comment_ids: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub archived_at: Option<DateTime<Utc>>,
}

impl ReviewRunManifestDocument {
    pub fn schema_version() -> &'static str {
        USER_REVIEW_MANIFEST_SCHEMA_VERSION
    }

    pub fn has_supported_schema_version(&self) -> bool {
        self.schema_version == Self::schema_version()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ReviewRunStatusValue {
    #[serde(rename = "active")]
    Active,
    #[serde(rename = "inProgress")]
    InProgress,
    #[serde(rename = "completed")]
    Completed,
    #[serde(rename = "archived")]
    Archived,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    tag = "scope"
)]
pub enum ReviewRunTargetDocument {
    File { spec_id: String, file_key: String },
    Spec { spec_id: String },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    tag = "mode"
)]
pub enum ReviewRunExecutionTargetDocument {
    CurrentWorkspace {
        workspace_path: String,
    },
    Worktree {
        repository_path: String,
        worktree_path: String,
        branch_name: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewRunSourceFileDocument {
    pub spec_id: String,
    pub file_key: String,
    pub relative_path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewRunStatusDocument {
    pub status: ReviewRunStatusValue,
    pub updated_at: DateTime<Utc>,
    pub summary: Option<String>,
    pub warnings: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn timestamp() -> DateTime<Utc> {
        DateTime::parse_from_rfc3339("2026-05-06T12:00:00Z")
            .expect("timestamp should parse")
            .with_timezone(&Utc)
    }

    #[test]
    fn manifest_serializes_current_workspace_schema() {
        let manifest = ReviewRunManifestDocument {
            schema_version: ReviewRunManifestDocument::schema_version().to_string(),
            id: "2026-05-06T120000Z-file-impl".to_string(),
            status: ReviewRunStatusValue::Active,
            workspace_path: "/workspace/project".to_string(),
            target: ReviewRunTargetDocument::File {
                spec_id: "001-checkout-flow".to_string(),
                file_key: "impl".to_string(),
            },
            spec_folder_path: "/workspace/project/.plugin-workspace/.specs/001-checkout-flow"
                .to_string(),
            execution_target: ReviewRunExecutionTargetDocument::CurrentWorkspace {
                workspace_path: "/workspace/project".to_string(),
            },
            source_files: vec![ReviewRunSourceFileDocument {
                spec_id: "001-checkout-flow".to_string(),
                file_key: "impl".to_string(),
                relative_path: ".plugin-workspace/.specs/001-checkout-flow/implementation-plan.md"
                    .to_string(),
            }],
            comment_ids: vec!["comment-1".to_string()],
            created_at: timestamp(),
            archived_at: None,
        };

        let serialized =
            serde_json::to_string(&manifest).expect("manifest should serialize to JSON");

        assert!(serialized.contains("\"schemaVersion\":\"spec-reviewer.review-run.v1\""));
        assert!(serialized.contains("\"mode\":\"currentWorkspace\""));
        assert!(serialized.contains("\"scope\":\"file\""));
    }

    #[test]
    fn manifest_deserializes_worktree_execution_target() {
        let payload = r#"{
          "schemaVersion": "spec-reviewer.review-run.v1",
          "id": "2026-05-06T120000Z-file-requirements",
          "status": "active",
          "workspacePath": "/workspace/project",
          "target": {
            "scope": "spec",
            "specId": "001-checkout-flow"
          },
          "specFolderPath": "/workspace/project-worktrees/review/.plugin-workspace/.specs/001-checkout-flow",
          "executionTarget": {
            "mode": "worktree",
            "repositoryPath": "/workspace/project",
            "worktreePath": "/workspace/project-worktrees/review",
            "branchName": "spec-reviewer/2026-05-06T120000Z-file-requirements"
          },
          "sourceFiles": [],
          "commentIds": [],
          "createdAt": "2026-05-06T12:00:00Z",
          "archivedAt": null
        }"#;

        let manifest: ReviewRunManifestDocument =
            serde_json::from_str(payload).expect("manifest should deserialize");

        assert!(manifest.has_supported_schema_version());
        assert_eq!(
            ReviewRunExecutionTargetDocument::Worktree {
                repository_path: "/workspace/project".to_string(),
                worktree_path: "/workspace/project-worktrees/review".to_string(),
                branch_name: "spec-reviewer/2026-05-06T120000Z-file-requirements".to_string(),
            },
            manifest.execution_target
        );
    }

    #[test]
    fn status_document_serializes_japanese_summary_and_warnings() {
        let document = ReviewRunStatusDocument {
            status: ReviewRunStatusValue::Completed,
            updated_at: timestamp(),
            summary: Some("対応が完了しました".to_string()),
            warnings: vec!["source file changed after export".to_string()],
        };

        let serialized =
            serde_json::to_string(&document).expect("status document should serialize");

        assert!(serialized.contains("\"status\":\"completed\""));
        assert!(serialized.contains("\"summary\":\"対応が完了しました\""));
        assert!(serialized.contains("\"warnings\""));
    }

    #[test]
    fn current_workspace_fixture_bundle_matches_supported_schema() {
        let manifest: ReviewRunManifestDocument = serde_json::from_str(include_str!(
            "../../../tests/fixtures/review-runs/current-workspace-active/manifest.json"
        ))
        .expect("current workspace fixture manifest should deserialize");
        let status: ReviewRunStatusDocument = serde_json::from_str(include_str!(
            "../../../tests/fixtures/review-runs/current-workspace-active/status.json"
        ))
        .expect("current workspace fixture status should deserialize");
        let comments: serde_json::Value = serde_json::from_str(include_str!(
            "../../../tests/fixtures/review-runs/current-workspace-active/comments.json"
        ))
        .expect("current workspace fixture comments should deserialize");
        let instructions = include_str!(
            "../../../tests/fixtures/review-runs/current-workspace-active/instructions.md"
        );
        let context =
            include_str!("../../../tests/fixtures/review-runs/current-workspace-active/context/001-auth-flow/tasks.md");

        assert!(manifest.has_supported_schema_version());
        assert_eq!(ReviewRunStatusValue::Active, manifest.status);
        assert_eq!(ReviewRunStatusValue::Active, status.status);
        assert_eq!(
            ReviewRunExecutionTargetDocument::CurrentWorkspace {
                workspace_path: "/workspace/spec-reviewer-fixture".to_string(),
            },
            manifest.execution_target
        );
        assert_eq!(1, manifest.source_files.len());
        assert_eq!(
            Some("spec-reviewer.review-comments.v1"),
            comments
                .get("schemaVersion")
                .and_then(serde_json::Value::as_str)
        );
        assert!(instructions.contains("ユーザーレビュー"));
        assert!(instructions.contains("context/"));
        assert!(context.contains("ログイン失敗時"));
    }

    #[test]
    fn worktree_archived_fixture_bundle_matches_supported_schema() {
        let manifest: ReviewRunManifestDocument = serde_json::from_str(include_str!(
            "../../../tests/fixtures/review-runs/worktree-archived/manifest.json"
        ))
        .expect("worktree fixture manifest should deserialize");
        let status: ReviewRunStatusDocument = serde_json::from_str(include_str!(
            "../../../tests/fixtures/review-runs/worktree-archived/status.json"
        ))
        .expect("worktree fixture status should deserialize");
        let comments: serde_json::Value = serde_json::from_str(include_str!(
            "../../../tests/fixtures/review-runs/worktree-archived/comments.json"
        ))
        .expect("worktree fixture comments should deserialize");
        let instructions =
            include_str!("../../../tests/fixtures/review-runs/worktree-archived/instructions.md");
        let result =
            include_str!("../../../tests/fixtures/review-runs/worktree-archived/result.md");

        assert!(manifest.has_supported_schema_version());
        assert_eq!(ReviewRunStatusValue::Archived, manifest.status);
        assert_eq!(ReviewRunStatusValue::Archived, status.status);
        assert!(manifest.archived_at.is_some());
        assert_eq!(
            ReviewRunExecutionTargetDocument::Worktree {
                repository_path: "/workspace/spec-reviewer-fixture".to_string(),
                worktree_path:
                    "/workspace/spec-reviewer-fixture-worktrees/2026-05-06T123000Z-spec-worktree"
                        .to_string(),
                branch_name: "spec-reviewer/2026-05-06T123000Z-spec-worktree".to_string(),
            },
            manifest.execution_target
        );
        assert_eq!(2, manifest.source_files.len());
        assert_eq!(
            ".plugin-workspace/.specs/001-auth-flow/implementation-plan.md",
            manifest.source_files[0].relative_path
        );
        assert_eq!(
            2,
            comments
                .get("comments")
                .and_then(serde_json::Value::as_array)
                .map_or(0, Vec::len)
        );
        assert!(instructions.contains("worktree"));
        assert!(result.contains("認証スコープ"));
        assert_eq!(vec!["source file changed after export"], status.warnings);
    }
}
