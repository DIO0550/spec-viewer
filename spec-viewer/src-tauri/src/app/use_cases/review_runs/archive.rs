//! Archive review run use case orchestration.

use chrono::Utc;

use crate::{
    app::use_cases::{
        AppUseCaseError, ArchiveReviewRunInput, ArchiveReviewRunResult, FilesystemAppUseCases,
        LoadWorkspaceResult,
    },
    infrastructure::persistence::{
        review_run_paths::{ReviewRunFolderState, ReviewRunPathResolver},
        review_run_reader::ReviewRunReader,
        review_run_schema::ReviewRunStatusValue,
        review_run_writer::ReviewRunBundleWriter,
    },
};

impl FilesystemAppUseCases {
    pub fn archive_review_run(
        &self,
        workspace: &LoadWorkspaceResult,
        input: ArchiveReviewRunInput,
    ) -> Result<ArchiveReviewRunResult, AppUseCaseError> {
        let active_path = ReviewRunPathResolver::new().resolve(
            workspace.layout(),
            input.target().spec_id(),
            input.review_run_id(),
            ReviewRunFolderState::Active,
        )?;
        let archive_path = ReviewRunPathResolver::new().resolve(
            workspace.layout(),
            input.target().spec_id(),
            input.review_run_id(),
            ReviewRunFolderState::Archive,
        )?;

        if !active_path.run_directory().is_dir() {
            return Err(AppUseCaseError::ReviewRunExport {
                message: format!(
                    "active review run folder is missing: {}",
                    active_path.run_directory().to_string_lossy()
                ),
            });
        }

        if archive_path.run_directory().exists() {
            return Err(AppUseCaseError::ReviewRunExport {
                message: format!(
                    "archived review run already exists: {}",
                    archive_path.run_directory().to_string_lossy()
                ),
            });
        }

        let reader = ReviewRunReader::new();
        let mut manifest = reader.read_manifest(active_path.run_directory())?;

        if manifest.id != input.review_run_id().as_str() {
            return Err(AppUseCaseError::ReviewRunExport {
                message: format!(
                    "review run manifest id does not match requested id: {}",
                    input.review_run_id()
                ),
            });
        }

        if !manifest.has_supported_schema_version()
            || !manifest.target.matches_target(input.target())
        {
            return Err(AppUseCaseError::ReviewRunExport {
                message: format!(
                    "review run does not match selected target: {}",
                    input.review_run_id()
                ),
            });
        }

        let mut status = reader.read_status(active_path.run_directory())?;

        if status.status != ReviewRunStatusValue::Completed {
            return Err(AppUseCaseError::ReviewRunExport {
                message: format!(
                    "only completed review runs can be archived: {}",
                    input.review_run_id()
                ),
            });
        }

        let archived_at = Utc::now();
        let result_summary = reader.read_result_summary(active_path.run_directory())?;
        let source_warnings = reader.collect_source_file_change_warnings(&manifest)?;
        status.status = ReviewRunStatusValue::Archived;
        status.updated_at = archived_at;
        if status.summary.is_none() {
            status.summary = result_summary.clone();
        }
        status.append_unique_warnings(source_warnings);
        manifest.status = ReviewRunStatusValue::Archived;
        manifest.archived_at = Some(archived_at);

        ReviewRunBundleWriter::new().archive_run(
            active_path.run_directory(),
            &archive_path,
            &manifest,
            &status,
        )?;

        Ok(ArchiveReviewRunResult::new(
            manifest.restore_review_run()?,
            archive_path.run_directory().to_string_lossy(),
            status.summary,
            status.warnings,
        ))
    }
}

#[cfg(test)]
mod tests {
    use std::{fs, path::PathBuf};

    use serde_json::Value;

    use super::super::test_support::{
        archive_file_run_input, create_file_run_input, TestWorkspace,
    };
    use crate::{
        app::use_cases::{AppUseCaseError, FilesystemAppUseCases},
        domain::review_run::UserReviewRunStatus,
    };

    #[test]
    fn archive_review_run_moves_completed_bundle_and_preserves_files() {
        let workspace = TestWorkspace::new("archive-completed");
        workspace.write_task_file("# Tasks\n\nClarify checkout task.\n");
        workspace.write_comment_file("cmt_1");
        let use_cases = FilesystemAppUseCases::default();
        let loaded_workspace = use_cases
            .load_workspace(workspace.root_string())
            .expect("workspace should load");
        let created = use_cases
            .create_review_run(&loaded_workspace, create_file_run_input("cmt_1"))
            .expect("review run should be created");
        let active_directory = PathBuf::from(created.folder_path());
        let mut status = workspace.read_json(&active_directory.join("status.json"));
        status["status"] = Value::String("completed".to_string());
        status["summary"] = Value::String("対応完了".to_string());
        status["warnings"] = Value::Array(vec![Value::String("既存警告".to_string())]);
        workspace.write_json(&active_directory.join("status.json"), &status);
        fs::write(
            active_directory.join("result.md"),
            "# レビュー対応結果\n\n- 対応内容\n",
        )
        .expect("result should be written");
        std::thread::sleep(std::time::Duration::from_millis(10));
        workspace.write_task_file("# Tasks\n\nClarify checkout task after archive.\n");

        let archived = use_cases
            .archive_review_run(
                &loaded_workspace,
                archive_file_run_input(created.review_run().id().as_str()),
            )
            .expect("review run should archive");
        let archive_directory = PathBuf::from(archived.folder_path());

        assert!(!active_directory.exists());
        assert!(archive_directory.join("manifest.json").is_file());
        assert!(archive_directory.join("instructions.md").is_file());
        assert!(archive_directory.join("comments.json").is_file());
        assert!(archive_directory.join("context/auth/tasks.md").is_file());
        assert!(archive_directory.join("result.md").is_file());
        assert!(archive_directory.join("status.json").is_file());

        let manifest = workspace.read_json(&archive_directory.join("manifest.json"));
        assert_eq!("archived", manifest["status"]);
        assert!(manifest["archivedAt"].as_str().is_some());

        let status = workspace.read_json(&archive_directory.join("status.json"));
        assert_eq!("archived", status["status"]);
        assert_eq!("対応完了", status["summary"]);
        let warnings = status["warnings"]
            .as_array()
            .expect("warnings should be an array")
            .iter()
            .filter_map(Value::as_str)
            .collect::<Vec<_>>();
        assert!(warnings.contains(&"既存警告"));
        assert!(warnings
            .iter()
            .any(|warning| warning.contains("source file changed after export")));
        assert_eq!(
            UserReviewRunStatus::Archived,
            archived.review_run().status()
        );
    }

    #[test]
    fn archive_review_run_refuses_archive_conflict() {
        let workspace = TestWorkspace::new("archive-conflict");
        workspace.write_task_file("# Tasks\n\nClarify checkout task.\n");
        workspace.write_comment_file("cmt_1");
        let use_cases = FilesystemAppUseCases::default();
        let loaded_workspace = use_cases
            .load_workspace(workspace.root_string())
            .expect("workspace should load");
        let created = use_cases
            .create_review_run(&loaded_workspace, create_file_run_input("cmt_1"))
            .expect("review run should be created");
        let active_directory = PathBuf::from(created.folder_path());
        let mut status = workspace.read_json(&active_directory.join("status.json"));
        status["status"] = Value::String("completed".to_string());
        workspace.write_json(&active_directory.join("status.json"), &status);
        fs::create_dir_all(
            workspace
                .archive_directory()
                .join(created.review_run().id().as_str()),
        )
        .expect("archive conflict should be created");

        let result = use_cases.archive_review_run(
            &loaded_workspace,
            archive_file_run_input(created.review_run().id().as_str()),
        );

        assert!(matches!(
            result,
            Err(AppUseCaseError::ReviewRunExport { .. })
        ));
        assert!(active_directory.is_dir());
    }
}
