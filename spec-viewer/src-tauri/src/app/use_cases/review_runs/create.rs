//! Create review run use case orchestration.

use std::{
    collections::{BTreeSet, HashSet},
    path::{Path, PathBuf},
};

use chrono::{DateTime, Utc};

use crate::{
    app::use_cases::{
        AppUseCaseError, CommentAnchorResolution, CreateReviewRunInput, CreateReviewRunResult,
        FilesystemAppUseCases, LoadWorkspaceResult, ReadSpecFileResult, ReviewRunExecutionMode,
    },
    domain::{
        comment::{CommentId, CommentStatusFilter},
        review_run::{
            ReviewRunAnchorResolutionDocument, ReviewRunAnchorResolutionTargetDocument,
            ReviewRunBranchName, ReviewRunBundleFile, ReviewRunCommentDocument, ReviewRunPathValue,
            ReviewRunRelativePath, UserReviewExecutionTarget, UserReviewRun, UserReviewRunId,
            UserReviewRunStatus, UserReviewRunTarget, UserReviewSourceFile,
        },
        spec::{SafeSpecPath, SpecFile, SpecFileKey, SpecId, SpecNode},
    },
    infrastructure::{
        git::GitReviewWorktreeService,
        persistence::{
            review_run_paths::{ReviewRunFolderState, ReviewRunPathResolver},
            review_run_writer::{ReviewRunBundleDocument, ReviewRunBundleWriter},
        },
    },
};

impl FilesystemAppUseCases {
    pub fn create_review_run(
        &self,
        workspace: &LoadWorkspaceResult,
        input: CreateReviewRunInput,
    ) -> Result<CreateReviewRunResult, AppUseCaseError> {
        if input.comment_ids().is_empty() {
            return Err(AppUseCaseError::ReviewRunExport {
                message: "review run requires at least one selected comment".to_string(),
            });
        }

        let created_at = Utc::now();
        let run_id = UserReviewRunId::generate(input.target(), created_at)?;
        let spec_id = input.target().spec_id().clone();
        let files = self.collect_target_files(workspace, input.target())?;
        let mut bundle_files =
            self.collect_bundle_files(workspace, &files, input.comment_ids(), created_at)?;
        let included_comment_ids = ReviewRunBundleFile::collect_comment_ids(&bundle_files);
        let requested_comment_ids = input
            .comment_ids()
            .iter()
            .map(|id| id.as_str().to_string())
            .collect::<BTreeSet<_>>();
        let included_comment_id_set = included_comment_ids
            .iter()
            .map(|id| id.as_str().to_string())
            .collect::<BTreeSet<_>>();

        if requested_comment_ids != included_comment_id_set {
            let missing = requested_comment_ids
                .difference(&included_comment_id_set)
                .cloned()
                .collect::<Vec<_>>()
                .join(", ");

            return Err(AppUseCaseError::ReviewRunExport {
                message: format!(
                    "selected comments were not found in the review target: {missing}"
                ),
            });
        }

        let (execution_target, execution_layout) = match input.execution_mode() {
            ReviewRunExecutionMode::CurrentWorkspace => (
                UserReviewExecutionTarget::current_workspace(ReviewRunPathValue::new(
                    workspace.layout().root().as_str(),
                )?),
                workspace.layout().clone(),
            ),
            ReviewRunExecutionMode::Worktree => {
                let branch_name = ReviewRunBranchName::for_run(&run_id);
                let source_paths = bundle_files
                    .iter()
                    .map(|file| PathBuf::from(file.source_path()))
                    .collect::<Vec<_>>();
                let worktree = GitReviewWorktreeService::new().prepare_worktree(
                    workspace.layout().root().as_str(),
                    &source_paths,
                    &branch_name,
                )?;
                let worktree_root = worktree.worktree_path().to_string_lossy().into_owned();

                ReviewRunBundleFile::relocate_all(
                    &mut bundle_files,
                    workspace.layout().root().as_str(),
                    &worktree_root,
                )?;

                (
                    UserReviewExecutionTarget::worktree(
                        ReviewRunPathValue::new(
                            worktree.repository_path().to_string_lossy().into_owned(),
                        )?,
                        ReviewRunPathValue::new(worktree_root.clone())?,
                        worktree.branch_name().clone(),
                    ),
                    workspace
                        .layout()
                        .with_root_path(&worktree_root)
                        .map_err(|source| AppUseCaseError::ReviewRunExport {
                            message: source.to_string(),
                        })?,
                )
            }
        };
        let path = ReviewRunPathResolver::new().resolve(
            &execution_layout,
            &spec_id,
            &run_id,
            ReviewRunFolderState::Active,
        )?;
        let source_files = bundle_files
            .iter()
            .map(|file| file.source_file().clone())
            .collect::<Vec<_>>();
        let run = UserReviewRun::restore(
            run_id,
            UserReviewRunStatus::Active,
            input.target().clone(),
            execution_target,
            ReviewRunPathValue::new(path.spec_directory().to_string_lossy())?,
            source_files,
            included_comment_ids,
            created_at,
            None,
        )?;
        let bundle = ReviewRunBundleDocument::for_new_run(&run, &bundle_files, created_at);

        ReviewRunBundleWriter::new().write_active_bundle(&path, run.id(), &bundle)?;

        Ok(CreateReviewRunResult::new(
            run,
            path.run_directory().to_string_lossy(),
        ))
    }

    fn collect_target_files(
        &self,
        workspace: &LoadWorkspaceResult,
        target: &UserReviewRunTarget,
    ) -> Result<Vec<ReviewRunTargetFile>, AppUseCaseError> {
        match target {
            UserReviewRunTarget::File { spec_id, file_key } => Ok(vec![ReviewRunTargetFile {
                spec_id: spec_id.clone(),
                spec_label: spec_id.as_str().to_string(),
                file_key: *file_key,
                file_label: file_key.display_label().to_string(),
            }]),
            UserReviewRunTarget::Spec { spec_id } => {
                let specs = self.list_specs(workspace)?.into_specs();
                let spec = SpecNode::find_by_id(&specs, spec_id.as_str()).ok_or_else(|| {
                    AppUseCaseError::ReviewRunExport {
                        message: format!("unknown spec id: {spec_id}"),
                    }
                })?;
                let files = spec
                    .files()
                    .iter()
                    .filter(|file| !file.is_missing())
                    .map(|file| ReviewRunTargetFile::from_spec_file(spec, file))
                    .collect::<Vec<_>>();

                if files.is_empty() {
                    return Err(AppUseCaseError::ReviewRunExport {
                        message: format!("review target has no source Markdown files: {spec_id}"),
                    });
                }

                Ok(files)
            }
        }
    }

    fn collect_bundle_files(
        &self,
        workspace: &LoadWorkspaceResult,
        files: &[ReviewRunTargetFile],
        selected_comment_ids: &[CommentId],
        generated_at: DateTime<Utc>,
    ) -> Result<Vec<ReviewRunBundleFile>, AppUseCaseError> {
        let selected_ids = selected_comment_ids
            .iter()
            .map(|id| id.as_str().to_string())
            .collect::<HashSet<_>>();

        files
            .iter()
            .map(|file| {
                let document =
                    match self.read_spec_file(workspace, file.spec_id.as_str(), file.file_key)? {
                        ReadSpecFileResult::Found(document) => document,
                        ReadSpecFileResult::Missing(missing) => {
                            return Err(AppUseCaseError::ReviewRunExport {
                                message: format!(
                                    "source Markdown file is missing: {}",
                                    missing.path()
                                ),
                            });
                        }
                    };
                let resolutions = self.comment_use_cases(workspace).resolve_comment_anchors(
                    file.spec_id.as_str(),
                    file.file_key,
                    CommentStatusFilter::All,
                    document.blocks(),
                )?;
                let comments = resolutions
                    .resolutions()
                    .iter()
                    .filter(|resolution| selected_ids.contains(resolution.comment().id().as_str()))
                    .map(|resolution| comment_document_from_resolution(resolution, generated_at))
                    .collect::<Vec<_>>();
                let source_relative_path = ReviewRunRelativePath::from_workspace_source(
                    workspace.layout().root().as_str(),
                    document.path(),
                )?;
                let context_relative_path =
                    context_snapshot_path(file.spec_id.as_str(), file.file_key)?;

                Ok(ReviewRunBundleFile::new(
                    file.spec_id.clone(),
                    file.spec_label.clone(),
                    file.file_key,
                    file.file_label.clone(),
                    document.path(),
                    context_relative_path,
                    UserReviewSourceFile::new(
                        file.spec_id.clone(),
                        file.file_key,
                        source_relative_path,
                    ),
                    document.contents(),
                    comments,
                ))
            })
            .collect()
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ReviewRunTargetFile {
    spec_id: SpecId,
    spec_label: String,
    file_key: SpecFileKey,
    file_label: String,
}

impl ReviewRunTargetFile {
    fn from_spec_file(spec: &SpecNode, file: &SpecFile) -> Self {
        Self {
            spec_id: SpecId::new(spec.id()).expect("spec tree ids should be valid domain values"),
            spec_label: spec.label().to_string(),
            file_key: file.key(),
            file_label: file.display_label().to_string(),
        }
    }
}

fn comment_document_from_resolution(
    resolution: &CommentAnchorResolution,
    exported_at: DateTime<Utc>,
) -> ReviewRunCommentDocument {
    ReviewRunCommentDocument::from_comment(
        resolution.comment(),
        Some(ReviewRunAnchorResolutionDocument::new(
            resolution.status(),
            resolution.reason(),
            resolution.details(),
            resolution.target().map(|target| {
                ReviewRunAnchorResolutionTargetDocument::from_block(target.block(), target.score())
            }),
        )),
        exported_at,
    )
}

fn context_snapshot_path(
    spec_id: &str,
    file_key: SpecFileKey,
) -> Result<ReviewRunRelativePath, AppUseCaseError> {
    let spec_path = SafeSpecPath::parse(spec_id)?.into_path_buf();
    let relative = Path::new("context")
        .join(spec_path)
        .join(format!("{}.md", file_key.as_str()));

    ReviewRunRelativePath::new(relative.to_string_lossy()).map_err(AppUseCaseError::from)
}

#[cfg(test)]
mod tests {
    use std::{fs, path::PathBuf};

    use super::super::test_support::{
        create_file_run_input, create_impl_file_run_input, create_worktree_file_run_input,
        TestWorkspace,
    };
    use crate::app::use_cases::{AppUseCaseError, FilesystemAppUseCases};

    #[test]
    fn create_review_run_writes_current_workspace_bundle_without_modifying_source() {
        let workspace = TestWorkspace::new("current-workspace");
        let source_markdown = "# Tasks\n\nClarify checkout task.\n";
        workspace.write_task_file(source_markdown);
        workspace.write_comment_file("cmt_1");
        let use_cases = FilesystemAppUseCases::default();
        let loaded_workspace = use_cases
            .load_workspace(workspace.root_string())
            .expect("workspace should load");

        let result = use_cases
            .create_review_run(&loaded_workspace, create_file_run_input("cmt_1"))
            .expect("review run should be created");
        let run_directory = PathBuf::from(result.folder_path());

        assert!(run_directory.join("manifest.json").is_file());
        assert!(run_directory.join("instructions.md").is_file());
        assert!(run_directory.join("comments.json").is_file());
        assert!(run_directory.join("context/auth/tasks.md").is_file());
        assert!(run_directory.join("result.md").is_file());
        assert!(run_directory.join("status.json").is_file());
        assert_eq!(
            source_markdown,
            fs::read_to_string(workspace.task_file_path()).expect("source should be readable")
        );

        let manifest = workspace.read_json(&run_directory.join("manifest.json"));
        assert_eq!("active", manifest["status"]);
        assert_eq!("file", manifest["target"]["scope"]);
        assert_eq!("tasks", manifest["target"]["fileKey"]);
        assert_eq!("currentWorkspace", manifest["executionTarget"]["mode"]);
        assert_eq!(1, manifest["commentIds"].as_array().map_or(0, Vec::len));

        let comments = workspace.read_json(&run_directory.join("comments.json"));
        assert_eq!(1, comments["commentCount"]);
        assert_eq!("cmt_1", comments["files"][0]["comments"][0]["id"]);

        let instructions = fs::read_to_string(run_directory.join("instructions.md"))
            .expect("instructions should be readable");
        assert!(instructions.contains("編集してはいけません"));
        assert!(instructions.contains("Edit the source Markdown files listed above"));
    }

    #[test]
    fn create_review_run_manifest_uses_mapped_impl_source_file_path() {
        let workspace = TestWorkspace::new("mapped-impl-source");
        workspace.write_impl_file("# Implementation\n\nClarify implementation plan.\n");
        workspace.write_impl_comment_file("cmt_impl");
        let use_cases = FilesystemAppUseCases::default();
        let loaded_workspace = use_cases
            .load_workspace(workspace.root_string())
            .expect("workspace should load");

        let result = use_cases
            .create_review_run(&loaded_workspace, create_impl_file_run_input("cmt_impl"))
            .expect("review run should be created");
        let run_directory = PathBuf::from(result.folder_path());

        assert!(run_directory.join("context/auth/impl.md").is_file());
        let manifest = workspace.read_json(&run_directory.join("manifest.json"));
        assert_eq!("impl", manifest["sourceFiles"][0]["fileKey"]);
        assert_eq!(
            ".plugin-workspace/.specs/auth/implementation-plan.md",
            manifest["sourceFiles"][0]["relativePath"]
        );
    }

    #[test]
    fn create_review_run_failure_leaves_no_partial_active_run_for_missing_comment() {
        let workspace = TestWorkspace::new("missing-comment");
        workspace.write_task_file("# Tasks\n\nClarify checkout task.\n");
        workspace.write_comment_file("cmt_1");
        let use_cases = FilesystemAppUseCases::default();
        let loaded_workspace = use_cases
            .load_workspace(workspace.root_string())
            .expect("workspace should load");

        let result =
            use_cases.create_review_run(&loaded_workspace, create_file_run_input("cmt_missing"));

        assert!(matches!(
            result,
            Err(AppUseCaseError::ReviewRunExport { .. })
        ));
        assert!(!workspace.active_directory().exists());
    }

    #[test]
    fn create_review_run_writes_worktree_bundle_into_isolated_checkout() {
        let workspace = TestWorkspace::new("worktree-mode");
        let source_markdown = "# Tasks\n\nClarify checkout task.\n";
        workspace.write_task_file(source_markdown);
        workspace.initialize_git_repo();
        workspace.commit_all();
        workspace.write_comment_file("cmt_1");
        let use_cases = FilesystemAppUseCases::default();
        let loaded_workspace = use_cases
            .load_workspace(workspace.root_path().to_string_lossy())
            .expect("workspace should load");

        let result = use_cases
            .create_review_run(&loaded_workspace, create_worktree_file_run_input("cmt_1"))
            .expect("worktree review run should be created");
        let run_directory = PathBuf::from(result.folder_path());

        assert!(run_directory.starts_with(workspace.worktree_parent()));
        assert!(run_directory.join("manifest.json").is_file());
        assert!(run_directory.join("instructions.md").is_file());
        assert!(run_directory.join("context/auth/tasks.md").is_file());
        assert!(!workspace.active_directory().exists());
        assert_eq!(
            source_markdown,
            fs::read_to_string(workspace.task_file_path()).expect("source should be readable")
        );

        let manifest = workspace.read_json(&run_directory.join("manifest.json"));
        assert_eq!("worktree", manifest["executionTarget"]["mode"]);
        assert_eq!(
            workspace
                .root_path()
                .canonicalize()
                .expect("workspace root should canonicalize")
                .to_string_lossy()
                .as_ref(),
            manifest["executionTarget"]["repositoryPath"]
                .as_str()
                .expect("repository path should be present")
        );
        assert!(manifest["executionTarget"]["branchName"]
            .as_str()
            .is_some_and(|branch| branch.starts_with("spec-reviewer/")));
        assert!(manifest["specFolderPath"].as_str().is_some_and(
            |path| path.starts_with(workspace.worktree_parent().to_string_lossy().as_ref())
        ));

        let instructions = fs::read_to_string(run_directory.join("instructions.md"))
            .expect("instructions should be readable");
        assert!(instructions.contains(&workspace.worktree_parent().to_string_lossy().to_string()));
        assert!(!instructions.contains(&workspace.task_file_path().to_string_lossy().to_string()));
    }

    #[test]
    fn create_review_run_rejects_non_git_worktree_mode_before_writing_bundle() {
        let workspace = TestWorkspace::new("non-git-worktree-mode");
        workspace.write_task_file("# Tasks\n\nClarify checkout task.\n");
        workspace.write_comment_file("cmt_1");
        let use_cases = FilesystemAppUseCases::default();
        let loaded_workspace = use_cases
            .load_workspace(workspace.root_path().to_string_lossy())
            .expect("workspace should load");
        let input = create_worktree_file_run_input("cmt_1");

        let result = use_cases.create_review_run(&loaded_workspace, input);

        assert!(matches!(
            result,
            Err(AppUseCaseError::ReviewRunExport { .. })
        ));
        assert!(!workspace.active_directory().exists());
    }
}
