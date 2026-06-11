//! List review runs use case orchestration.

use crate::{
    app::use_cases::{
        AppUseCaseError, FilesystemAppUseCases, ListReviewRunsInput, ListReviewRunsResult,
        ListedReviewRun, LoadWorkspaceResult, ReviewRunListProblem, ReviewRunListProblemState,
    },
    domain::{review_run::UserReviewRunTarget, workspace::WorkspaceLayout},
    infrastructure::persistence::{
        review_run_paths::ReviewRunFolderState,
        review_run_reader::{ReviewRunListDefect, ReviewRunReader},
    },
};

impl FilesystemAppUseCases {
    pub fn list_review_runs(
        &self,
        workspace: &LoadWorkspaceResult,
        input: ListReviewRunsInput,
    ) -> Result<ListReviewRunsResult, AppUseCaseError> {
        let mut problems = Vec::new();
        let active = listed_review_runs_for_state(
            workspace.layout(),
            input.target(),
            ReviewRunFolderState::Active,
            &mut problems,
        )?;
        let archived = listed_review_runs_for_state(
            workspace.layout(),
            input.target(),
            ReviewRunFolderState::Archive,
            &mut problems,
        )?;

        Ok(ListReviewRunsResult::new(active, archived, problems))
    }
}

fn listed_review_runs_for_state(
    layout: &WorkspaceLayout,
    target: &UserReviewRunTarget,
    state: ReviewRunFolderState,
    problems: &mut Vec<ReviewRunListProblem>,
) -> Result<Vec<ListedReviewRun>, AppUseCaseError> {
    let (records, defects) = ReviewRunReader::new()
        .list_state(layout, target, state)?
        .into_parts();

    for defect in defects {
        match defect {
            ReviewRunListDefect::MissingFolder { folder_path } => {
                problems.push(ReviewRunListProblem::new(
                    folder_path,
                    ReviewRunListProblemState::MissingFolder,
                    "review run folder disappeared while reading the list",
                ));
            }
            ReviewRunListDefect::Malformed { folder_path, error } => {
                problems.push(ReviewRunListProblem::new(
                    folder_path,
                    ReviewRunListProblemState::Malformed,
                    AppUseCaseError::from(error).to_string(),
                ));
            }
        }
    }

    Ok(records
        .into_iter()
        .map(|record| {
            let (review_run, folder_path, summary, warnings) = record.into_parts();

            ListedReviewRun::new(review_run, folder_path, summary, warnings)
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::super::test_support::{create_file_run_input, TestWorkspace};
    use crate::{
        app::use_cases::{FilesystemAppUseCases, ListReviewRunsInput, ReviewRunListProblemState},
        domain::{
            review_run::UserReviewRunTarget,
            spec::{SpecFileKey, SpecId},
        },
    };

    #[test]
    fn list_review_runs_returns_active_runs_for_selected_target() {
        let workspace = TestWorkspace::new("list-active");
        workspace.write_task_file("# Tasks\n\nClarify checkout task.\n");
        workspace.write_comment_file("cmt_1");
        let use_cases = FilesystemAppUseCases::default();
        let loaded_workspace = use_cases
            .load_workspace(workspace.root_string())
            .expect("workspace should load");
        let created = use_cases
            .create_review_run(&loaded_workspace, create_file_run_input("cmt_1"))
            .expect("review run should be created");
        let input = ListReviewRunsInput::new(UserReviewRunTarget::file(
            SpecId::new("auth").expect("spec id should be valid"),
            SpecFileKey::Tasks,
        ));

        let result = use_cases
            .list_review_runs(&loaded_workspace, input)
            .expect("review runs should list");

        assert_eq!(1, result.active().len());
        assert_eq!(0, result.archived().len());
        assert_eq!(created.folder_path(), result.active()[0].folder_path());
        assert_eq!(
            "cmt_1",
            result.active()[0].review_run().comment_ids()[0].as_str()
        );
    }

    #[test]
    fn list_review_runs_reports_malformed_run_without_deleting_folder() {
        let workspace = TestWorkspace::new("list-malformed");
        let malformed_directory = workspace
            .active_directory()
            .join("2026-05-06T120000Z-file-tasks-bad00000");
        fs::create_dir_all(&malformed_directory).expect("malformed run should be created");
        fs::write(malformed_directory.join("manifest.json"), "{ invalid")
            .expect("bad manifest should be written");
        let use_cases = FilesystemAppUseCases::default();
        let loaded_workspace = use_cases
            .load_workspace(workspace.root_string())
            .expect("workspace should load");
        let input = ListReviewRunsInput::new(UserReviewRunTarget::file(
            SpecId::new("auth").expect("spec id should be valid"),
            SpecFileKey::Tasks,
        ));

        let result = use_cases
            .list_review_runs(&loaded_workspace, input)
            .expect("review runs should list with problems");

        assert_eq!(0, result.active().len());
        assert_eq!(1, result.problems().len());
        assert_eq!(
            ReviewRunListProblemState::Malformed,
            result.problems()[0].state()
        );
        assert!(malformed_directory.is_dir());
    }
}
