//! Review run use cases that export user comments into filesystem bundles.

use std::{
    collections::{BTreeSet, HashSet},
    fs,
    path::{Path, PathBuf},
    str::FromStr,
};

use chrono::{DateTime, Utc};
use serde::Serialize;
use uuid::Uuid;

use crate::{
    app::use_cases::{
        AppUseCaseError, FilesystemAppUseCases, LoadWorkspaceResult, ReadSpecFileResult,
    },
    domain::{
        comment::{
            AnchorResolutionReason, AnchorResolutionStatus, BlockType, CommentAnchor, CommentId,
            CommentStatus, CommentStatusFilter,
        },
        review_run::{
            ReviewRunBranchName, ReviewRunPathValue, ReviewRunRelativePath,
            UserReviewExecutionTarget, UserReviewRun, UserReviewRunId, UserReviewRunStatus,
            UserReviewRunTarget, UserReviewSourceFile,
        },
        spec::{MarkdownBlock, MarkdownBlockSourceRange, SpecFile, SpecFileKey, SpecId, SpecNode},
        workspace::{WorkspaceLayout, WorkspaceRoot},
    },
    infrastructure::{
        filesystem::{safe_relative_spec_path, spec_directory_path},
        git::{GitReviewWorktreeError, GitReviewWorktreeService},
        persistence::{
            review_run_paths::{
                ReviewRunFolderState, ReviewRunPathResolver, USER_REVIEW_DIRECTORY,
            },
            review_run_schema::{
                ReviewRunExecutionTargetDocument, ReviewRunManifestDocument,
                ReviewRunSourceFileDocument, ReviewRunStatusDocument, ReviewRunStatusValue,
                ReviewRunTargetDocument,
            },
            review_run_writer::{
                ReviewRunBundleDocument, ReviewRunBundleWriter, ReviewRunContextSnapshot,
            },
        },
    },
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReviewRunExecutionMode {
    CurrentWorkspace,
    Worktree,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CreateReviewRunInput {
    target: UserReviewRunTarget,
    comment_ids: Vec<CommentId>,
    execution_mode: ReviewRunExecutionMode,
}

impl CreateReviewRunInput {
    pub fn new(
        target: UserReviewRunTarget,
        comment_ids: Vec<CommentId>,
        execution_mode: ReviewRunExecutionMode,
    ) -> Self {
        Self {
            target,
            comment_ids,
            execution_mode,
        }
    }

    pub fn target(&self) -> &UserReviewRunTarget {
        &self.target
    }

    pub fn comment_ids(&self) -> &[CommentId] {
        &self.comment_ids
    }

    pub fn execution_mode(&self) -> ReviewRunExecutionMode {
        self.execution_mode
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CreateReviewRunResult {
    review_run: UserReviewRun,
    folder_path: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ListReviewRunsInput {
    target: UserReviewRunTarget,
}

impl ListReviewRunsInput {
    pub fn new(target: UserReviewRunTarget) -> Self {
        Self { target }
    }

    pub fn target(&self) -> &UserReviewRunTarget {
        &self.target
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ListedReviewRun {
    review_run: UserReviewRun,
    folder_path: String,
    summary: Option<String>,
    warnings: Vec<String>,
}

impl ListedReviewRun {
    pub fn new(
        review_run: UserReviewRun,
        folder_path: impl Into<String>,
        summary: Option<String>,
        warnings: Vec<String>,
    ) -> Self {
        Self {
            review_run,
            folder_path: folder_path.into(),
            summary,
            warnings,
        }
    }

    pub fn review_run(&self) -> &UserReviewRun {
        &self.review_run
    }

    pub fn folder_path(&self) -> &str {
        &self.folder_path
    }

    pub fn summary(&self) -> Option<&str> {
        self.summary.as_deref()
    }

    pub fn warnings(&self) -> &[String] {
        &self.warnings
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ListReviewRunsResult {
    active: Vec<ListedReviewRun>,
    archived: Vec<ListedReviewRun>,
    problems: Vec<ReviewRunListProblem>,
}

impl ListReviewRunsResult {
    pub fn new(
        active: Vec<ListedReviewRun>,
        archived: Vec<ListedReviewRun>,
        problems: Vec<ReviewRunListProblem>,
    ) -> Self {
        Self {
            active,
            archived,
            problems,
        }
    }

    pub fn active(&self) -> &[ListedReviewRun] {
        &self.active
    }

    pub fn archived(&self) -> &[ListedReviewRun] {
        &self.archived
    }

    pub fn problems(&self) -> &[ReviewRunListProblem] {
        &self.problems
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReviewRunListProblem {
    folder_path: String,
    state: ReviewRunListProblemState,
    message: String,
}

impl ReviewRunListProblem {
    pub fn new(
        folder_path: impl Into<String>,
        state: ReviewRunListProblemState,
        message: impl Into<String>,
    ) -> Self {
        Self {
            folder_path: folder_path.into(),
            state,
            message: message.into(),
        }
    }

    pub fn folder_path(&self) -> &str {
        &self.folder_path
    }

    pub fn state(&self) -> ReviewRunListProblemState {
        self.state
    }

    pub fn message(&self) -> &str {
        &self.message
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReviewRunListProblemState {
    Malformed,
    MissingFolder,
}

impl ReviewRunListProblemState {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Malformed => "malformed",
            Self::MissingFolder => "missingFolder",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArchiveReviewRunInput {
    target: UserReviewRunTarget,
    review_run_id: UserReviewRunId,
}

impl ArchiveReviewRunInput {
    pub fn new(target: UserReviewRunTarget, review_run_id: UserReviewRunId) -> Self {
        Self {
            target,
            review_run_id,
        }
    }

    pub fn target(&self) -> &UserReviewRunTarget {
        &self.target
    }

    pub fn review_run_id(&self) -> &UserReviewRunId {
        &self.review_run_id
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArchiveReviewRunResult {
    review_run: UserReviewRun,
    folder_path: String,
    summary: Option<String>,
    warnings: Vec<String>,
}

impl ArchiveReviewRunResult {
    pub fn new(
        review_run: UserReviewRun,
        folder_path: impl Into<String>,
        summary: Option<String>,
        warnings: Vec<String>,
    ) -> Self {
        Self {
            review_run,
            folder_path: folder_path.into(),
            summary,
            warnings,
        }
    }

    pub fn review_run(&self) -> &UserReviewRun {
        &self.review_run
    }

    pub fn folder_path(&self) -> &str {
        &self.folder_path
    }

    pub fn summary(&self) -> Option<&str> {
        self.summary.as_deref()
    }

    pub fn warnings(&self) -> &[String] {
        &self.warnings
    }
}

impl CreateReviewRunResult {
    pub fn new(review_run: UserReviewRun, folder_path: impl Into<String>) -> Self {
        Self {
            review_run,
            folder_path: folder_path.into(),
        }
    }

    pub fn review_run(&self) -> &UserReviewRun {
        &self.review_run
    }

    pub fn folder_path(&self) -> &str {
        &self.folder_path
    }
}

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
        let run_id = create_review_run_id(input.target(), created_at)?;
        let spec_id = input.target().spec_id().clone();
        let files = collect_target_files(self, workspace, input.target())?;
        let mut bundle_files =
            collect_bundle_files(self, workspace, &files, input.comment_ids(), created_at)?;
        let included_comment_ids = collect_included_comment_ids(&bundle_files);
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
                    .map(|file| PathBuf::from(&file.source_path))
                    .collect::<Vec<_>>();
                let worktree = GitReviewWorktreeService::new().prepare_worktree(
                    workspace.layout().root().as_str(),
                    &source_paths,
                    &branch_name,
                )?;
                let worktree_root = worktree.worktree_path().to_string_lossy().into_owned();

                relocate_bundle_files_to_workspace(
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
                    workspace_layout_at_path(workspace.layout(), &worktree_root)?,
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
            .map(|file| file.source_file.clone())
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
        let bundle = build_bundle_document(&run, &bundle_files, created_at);

        ReviewRunBundleWriter::new().write_active_bundle(&path, run.id(), &bundle)?;

        Ok(CreateReviewRunResult::new(
            run,
            path.run_directory().to_string_lossy(),
        ))
    }

    pub fn list_review_runs(
        &self,
        workspace: &LoadWorkspaceResult,
        input: ListReviewRunsInput,
    ) -> Result<ListReviewRunsResult, AppUseCaseError> {
        let mut problems = Vec::new();
        let active = list_review_runs_for_state(
            workspace.layout(),
            input.target(),
            ReviewRunFolderState::Active,
            &mut problems,
        )?;
        let archived = list_review_runs_for_state(
            workspace.layout(),
            input.target(),
            ReviewRunFolderState::Archive,
            &mut problems,
        )?;

        Ok(ListReviewRunsResult::new(active, archived, problems))
    }

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

        let mut manifest = read_review_run_manifest(active_path.run_directory())?;

        if manifest.id != input.review_run_id().as_str() {
            return Err(AppUseCaseError::ReviewRunExport {
                message: format!(
                    "review run manifest id does not match requested id: {}",
                    input.review_run_id()
                ),
            });
        }

        if !manifest.has_supported_schema_version()
            || !review_run_target_matches(&manifest.target, input.target())
        {
            return Err(AppUseCaseError::ReviewRunExport {
                message: format!(
                    "review run does not match selected target: {}",
                    input.review_run_id()
                ),
            });
        }

        let mut status = read_review_run_status(active_path.run_directory())?;

        if status.status != ReviewRunStatusValue::Completed {
            return Err(AppUseCaseError::ReviewRunExport {
                message: format!(
                    "only completed review runs can be archived: {}",
                    input.review_run_id()
                ),
            });
        }

        let archived_at = Utc::now();
        let result_summary = read_result_summary(active_path.run_directory())?;
        let source_warnings = collect_source_file_change_warnings(&manifest)?;
        status.status = ReviewRunStatusValue::Archived;
        status.updated_at = archived_at;
        if status.summary.is_none() {
            status.summary = result_summary.clone();
        }
        append_unique_warnings(&mut status.warnings, source_warnings);
        manifest.status = ReviewRunStatusValue::Archived;
        manifest.archived_at = Some(archived_at);

        write_json_document(
            &active_path.run_directory().join("manifest.json"),
            &manifest,
        )?;
        write_json_document(&active_path.run_directory().join("status.json"), &status)?;
        fs::create_dir_all(archive_path.archive_directory()).map_err(|source| {
            AppUseCaseError::ReviewRunExport {
                message: format!(
                    "failed to create archive review run directory {}: {source}",
                    archive_path.archive_directory().to_string_lossy()
                ),
            }
        })?;
        fs::rename(active_path.run_directory(), archive_path.run_directory()).map_err(
            |source| AppUseCaseError::ReviewRunExport {
                message: format!(
                    "failed to move review run from {} to {}: {source}",
                    active_path.run_directory().to_string_lossy(),
                    archive_path.run_directory().to_string_lossy()
                ),
            },
        )?;

        Ok(ArchiveReviewRunResult::new(
            restore_review_run_from_manifest(manifest)?,
            archive_path.run_directory().to_string_lossy(),
            status.summary,
            status.warnings,
        ))
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ReviewRunTargetFile {
    spec_id: SpecId,
    spec_label: String,
    file_key: SpecFileKey,
    file_label: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ReviewRunBundleFile {
    spec_id: SpecId,
    spec_label: String,
    file_key: SpecFileKey,
    file_label: String,
    source_path: String,
    context_relative_path: ReviewRunRelativePath,
    source_file: UserReviewSourceFile,
    markdown_contents: String,
    comments: Vec<ReviewRunCommentDocument>,
}

fn collect_target_files(
    use_cases: &FilesystemAppUseCases,
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
            let specs = use_cases.list_specs(workspace)?.into_specs();
            let spec = find_spec_node(&specs, spec_id.as_str()).ok_or_else(|| {
                AppUseCaseError::ReviewRunExport {
                    message: format!("unknown spec id: {spec_id}"),
                }
            })?;
            let files = spec
                .files()
                .iter()
                .filter(|file| !file.is_missing())
                .map(|file| target_file_from_spec_file(spec, file))
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

fn target_file_from_spec_file(spec: &SpecNode, file: &SpecFile) -> ReviewRunTargetFile {
    ReviewRunTargetFile {
        spec_id: SpecId::new(spec.id()).expect("spec tree ids should be valid domain values"),
        spec_label: spec.label().to_string(),
        file_key: file.key(),
        file_label: file.display_label().to_string(),
    }
}

fn collect_bundle_files(
    use_cases: &FilesystemAppUseCases,
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
                match use_cases.read_spec_file(workspace, file.spec_id.as_str(), file.file_key)? {
                    ReadSpecFileResult::Found(document) => document,
                    ReadSpecFileResult::Missing(missing) => {
                        return Err(AppUseCaseError::ReviewRunExport {
                            message: format!("source Markdown file is missing: {}", missing.path()),
                        });
                    }
                };
            let resolutions = use_cases
                .comment_use_cases(workspace)
                .resolve_comment_anchors(
                    file.spec_id.as_str(),
                    file.file_key,
                    CommentStatusFilter::All,
                    document.blocks(),
                )?;
            let comments = resolutions
                .resolutions()
                .iter()
                .filter(|resolution| selected_ids.contains(resolution.comment().id().as_str()))
                .map(|resolution| {
                    ReviewRunCommentDocument::from_resolution(resolution, generated_at)
                })
                .collect::<Vec<_>>();
            let source_relative_path =
                relative_workspace_path(workspace.layout().root().as_str(), document.path())?;
            let context_relative_path =
                context_snapshot_path(file.spec_id.as_str(), file.file_key)?;

            Ok(ReviewRunBundleFile {
                spec_id: file.spec_id.clone(),
                spec_label: file.spec_label.clone(),
                file_key: file.file_key,
                file_label: file.file_label.clone(),
                source_path: document.path().to_string(),
                context_relative_path: context_relative_path.clone(),
                source_file: UserReviewSourceFile::new(
                    file.spec_id.clone(),
                    file.file_key,
                    source_relative_path,
                ),
                markdown_contents: document.contents().to_string(),
                comments,
            })
        })
        .collect()
}

fn collect_included_comment_ids(files: &[ReviewRunBundleFile]) -> Vec<CommentId> {
    files
        .iter()
        .flat_map(|file| file.comments.iter())
        .map(|comment| {
            CommentId::new(comment.id.clone()).expect("serialized comments use valid comment ids")
        })
        .collect()
}

fn build_bundle_document(
    run: &UserReviewRun,
    files: &[ReviewRunBundleFile],
    created_at: DateTime<Utc>,
) -> ReviewRunBundleDocument {
    ReviewRunBundleDocument {
        manifest: manifest_document(run),
        instructions_markdown: render_instructions(run, files),
        comments_json: serde_json::to_value(ReviewRunCommentsDocument {
            schema_version: "spec-reviewer.review-run.comments.v1",
            review_run_id: run.id().as_str(),
            generated_at: created_at,
            comment_count: run.comment_ids().len(),
            files,
        })
        .expect("review run comments document should serialize"),
        result_markdown: render_result_template(run),
        status: ReviewRunStatusDocument {
            status: ReviewRunStatusValue::Active,
            updated_at: created_at,
            summary: None,
            warnings: Vec::new(),
        },
        context_snapshots: files
            .iter()
            .map(|file| {
                ReviewRunContextSnapshot::new(
                    file.context_relative_path.clone(),
                    file.markdown_contents.clone(),
                )
            })
            .collect(),
    }
}

fn manifest_document(run: &UserReviewRun) -> ReviewRunManifestDocument {
    ReviewRunManifestDocument {
        schema_version: ReviewRunManifestDocument::schema_version().to_string(),
        id: run.id().as_str().to_string(),
        status: ReviewRunStatusValue::Active,
        workspace_path: execution_workspace_path(run.execution_target()).to_string(),
        target: target_document(run.target()),
        spec_folder_path: run.spec_folder_path().as_str().to_string(),
        execution_target: execution_target_document(run.execution_target()),
        source_files: run
            .source_files()
            .iter()
            .map(|source_file| ReviewRunSourceFileDocument {
                spec_id: source_file.spec_id().as_str().to_string(),
                file_key: source_file.file_key().as_str().to_string(),
                relative_path: source_file.relative_path().as_str().to_string(),
            })
            .collect(),
        comment_ids: run
            .comment_ids()
            .iter()
            .map(|id| id.as_str().to_string())
            .collect(),
        created_at: run.created_at(),
        archived_at: run.archived_at(),
    }
}

fn target_document(target: &UserReviewRunTarget) -> ReviewRunTargetDocument {
    match target {
        UserReviewRunTarget::File { spec_id, file_key } => ReviewRunTargetDocument::File {
            spec_id: spec_id.as_str().to_string(),
            file_key: file_key.as_str().to_string(),
        },
        UserReviewRunTarget::Spec { spec_id } => ReviewRunTargetDocument::Spec {
            spec_id: spec_id.as_str().to_string(),
        },
    }
}

fn execution_target_document(
    execution_target: &UserReviewExecutionTarget,
) -> ReviewRunExecutionTargetDocument {
    match execution_target {
        UserReviewExecutionTarget::CurrentWorkspace { workspace_path } => {
            ReviewRunExecutionTargetDocument::CurrentWorkspace {
                workspace_path: workspace_path.as_str().to_string(),
            }
        }
        UserReviewExecutionTarget::Worktree {
            repository_path,
            worktree_path,
            branch_name,
        } => ReviewRunExecutionTargetDocument::Worktree {
            repository_path: repository_path.as_str().to_string(),
            worktree_path: worktree_path.as_str().to_string(),
            branch_name: branch_name.as_str().to_string(),
        },
    }
}

fn execution_workspace_path(execution_target: &UserReviewExecutionTarget) -> &str {
    match execution_target {
        UserReviewExecutionTarget::CurrentWorkspace { workspace_path } => workspace_path.as_str(),
        UserReviewExecutionTarget::Worktree { worktree_path, .. } => worktree_path.as_str(),
    }
}

fn render_instructions(run: &UserReviewRun, files: &[ReviewRunBundleFile]) -> String {
    let mut output = String::new();
    output.push_str("# ユーザーレビュー対応指示\n\n");
    output.push_str("このフォルダは spec-reviewer がユーザーコメントから作成したレビュー bundle です。`context/` 配下はエクスポート時点の読み取り用スナップショットです。編集してはいけません。\n\n");
    output.push_str("## 最重要ルール\n\n");
    output.push_str("- 修正対象は `sourceFiles` に記載された元の Markdown ファイルです。\n");
    output.push_str(
        "- `context/` 配下のファイルは参照専用です。変更は元ファイルへ行ってください。\n",
    );
    output.push_str("- 対応後は `result.md` に結果を書き、可能なら `status.json` の `status` を `completed` に更新してください。\n\n");
    output.push_str("## 対象\n\n");
    output.push_str(&format!("- Review run: `{}`\n", run.id()));
    output.push_str(&format!("- Scope: `{}`\n", format_target(run.target())));
    output.push_str(&format!(
        "- Execution: `{}`\n\n",
        format_execution_target(run.execution_target())
    ));
    output.push_str("## ソースファイル\n\n");

    for file in files {
        output.push_str(&format!(
            "- `{}` / `{}`: `{}`\n",
            file.spec_id.as_str(),
            file.file_key.as_str(),
            file.source_path
        ));
        output.push_str(&format!(
            "  - Snapshot: `{}`\n",
            file.context_relative_path.as_str()
        ));
    }

    output.push_str("\n## コメント\n\n");

    for file in files {
        if file.comments.is_empty() {
            continue;
        }

        output.push_str(&format!(
            "### {} / {} (`{}`)\n\n",
            file.spec_label,
            file.file_label,
            file.file_key.as_str()
        ));

        for comment in &file.comments {
            output.push_str(&format!("#### `{}`\n\n", comment.id));
            output.push_str(&format!(
                "- 状態: `{}` / Anchor: `{}`\n",
                comment.status,
                comment
                    .anchor_resolution
                    .as_ref()
                    .map(|resolution| resolution.status.as_str())
                    .unwrap_or("unknown")
            ));
            output.push_str("- 元の選択テキスト:\n\n");
            output.push_str(&format_blockquote(&comment.anchor.text_snippet));
            output.push('\n');

            if let Some(target) = comment
                .anchor_resolution
                .as_ref()
                .and_then(|resolution| resolution.target.as_ref())
            {
                output.push_str("- 現在の解決先スニペット:\n\n");
                output.push_str(&format_blockquote(&target.text_snippet));
                output.push('\n');
            }

            output.push_str("- コメント本文:\n\n");
            output.push_str(comment.body.trim());
            output.push_str("\n\n");
        }
    }

    output.push_str("## English fallback\n\n");
    output.push_str("Edit the source Markdown files listed above. Do not edit files under `context/`; they are read-only snapshots. Summarize the completed work in `result.md` and optionally set `status.json` to `completed`.\n");

    output
}

fn render_result_template(run: &UserReviewRun) -> String {
    format!(
        "# レビュー対応結果\n\n- Review run: `{}`\n- Status: `active`\n\n## 対応した変更\n\n- \n\n## 対応しなかったコメント\n\n- \n\n## フォローアップ質問\n\n- \n",
        run.id()
    )
}

fn create_review_run_id(
    target: &UserReviewRunTarget,
    created_at: DateTime<Utc>,
) -> Result<UserReviewRunId, AppUseCaseError> {
    let target_suffix = match target {
        UserReviewRunTarget::File { file_key, .. } => format!("file-{}", file_key.as_str()),
        UserReviewRunTarget::Spec { .. } => "spec".to_string(),
    };
    let unique_suffix = Uuid::new_v4()
        .simple()
        .to_string()
        .chars()
        .take(8)
        .collect::<String>();
    let value = format!(
        "{}-{}-{}",
        created_at.format("%Y-%m-%dT%H%M%SZ"),
        target_suffix,
        unique_suffix
    );

    UserReviewRunId::new(value).map_err(AppUseCaseError::from)
}

fn relative_workspace_path(
    workspace_path: &str,
    source_path: &str,
) -> Result<ReviewRunRelativePath, AppUseCaseError> {
    let relative = Path::new(source_path)
        .strip_prefix(Path::new(workspace_path))
        .map_err(|_| AppUseCaseError::ReviewRunExport {
            message: format!("source file is outside workspace: {source_path}"),
        })?;

    ReviewRunRelativePath::new(relative.to_string_lossy()).map_err(AppUseCaseError::from)
}

fn workspace_layout_at_path(
    source_layout: &WorkspaceLayout,
    root_path: &str,
) -> Result<WorkspaceLayout, AppUseCaseError> {
    let root =
        WorkspaceRoot::new(root_path).map_err(|source| AppUseCaseError::ReviewRunExport {
            message: source.to_string(),
        })?;

    Ok(WorkspaceLayout::new(root, source_layout.kind()))
}

fn relocate_bundle_files_to_workspace(
    files: &mut [ReviewRunBundleFile],
    current_workspace_path: &str,
    execution_workspace_path: &str,
) -> Result<(), AppUseCaseError> {
    for file in files {
        let relative_path =
            relative_workspace_path(current_workspace_path, &file.source_path)?.to_string();
        file.source_path = Path::new(execution_workspace_path)
            .join(relative_path)
            .to_string_lossy()
            .into_owned();
    }

    Ok(())
}

fn context_snapshot_path(
    spec_id: &str,
    file_key: SpecFileKey,
) -> Result<ReviewRunRelativePath, AppUseCaseError> {
    let spec_path = safe_relative_spec_path(spec_id)?;
    let relative = Path::new("context")
        .join(spec_path)
        .join(format!("{}.md", file_key.as_str()));

    ReviewRunRelativePath::new(relative.to_string_lossy()).map_err(AppUseCaseError::from)
}

fn find_spec_node<'a>(specs: &'a [SpecNode], spec_id: &str) -> Option<&'a SpecNode> {
    specs.iter().find_map(|spec| {
        if spec.id() == spec_id {
            return Some(spec);
        }

        find_spec_node(spec.children(), spec_id)
    })
}

fn format_target(target: &UserReviewRunTarget) -> String {
    match target {
        UserReviewRunTarget::File { spec_id, file_key } => {
            format!("file / {spec_id} / {file_key}")
        }
        UserReviewRunTarget::Spec { spec_id } => format!("spec / {spec_id}"),
    }
}

fn format_execution_target(execution_target: &UserReviewExecutionTarget) -> String {
    match execution_target {
        UserReviewExecutionTarget::CurrentWorkspace { workspace_path } => {
            format!("currentWorkspace / {}", workspace_path.as_str())
        }
        UserReviewExecutionTarget::Worktree {
            worktree_path,
            branch_name,
            ..
        } => format!(
            "worktree / {} / {}",
            worktree_path.as_str(),
            branch_name.as_str()
        ),
    }
}

fn format_blockquote(value: &str) -> String {
    value
        .lines()
        .map(|line| format!("> {line}\n"))
        .collect::<String>()
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReviewRunCommentsDocument<'a> {
    schema_version: &'static str,
    review_run_id: &'a str,
    generated_at: DateTime<Utc>,
    comment_count: usize,
    files: &'a [ReviewRunBundleFile],
}

impl Serialize for ReviewRunBundleFile {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        #[derive(Serialize)]
        #[serde(rename_all = "camelCase")]
        struct FileDocument<'a> {
            spec_id: &'a str,
            spec_label: &'a str,
            file_key: &'a str,
            file_label: &'a str,
            source_path: &'a str,
            context_path: &'a str,
            comments: &'a [ReviewRunCommentDocument],
        }

        FileDocument {
            spec_id: self.spec_id.as_str(),
            spec_label: &self.spec_label,
            file_key: self.file_key.as_str(),
            file_label: &self.file_label,
            source_path: &self.source_path,
            context_path: self.context_relative_path.as_str(),
            comments: &self.comments,
        }
        .serialize(serializer)
    }
}

fn list_review_runs_for_state(
    layout: &WorkspaceLayout,
    target: &UserReviewRunTarget,
    state: ReviewRunFolderState,
    problems: &mut Vec<ReviewRunListProblem>,
) -> Result<Vec<ListedReviewRun>, AppUseCaseError> {
    let directory = review_run_state_directory(layout, target.spec_id(), state)?;

    if !directory.exists() {
        return Ok(Vec::new());
    }

    let entries = fs::read_dir(&directory).map_err(|source| AppUseCaseError::ReviewRunExport {
        message: format!(
            "failed to read review run directory {}: {source}",
            directory.to_string_lossy()
        ),
    })?;
    let mut runs = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|source| AppUseCaseError::ReviewRunExport {
            message: format!(
                "failed to read review run entry {}: {source}",
                directory.to_string_lossy()
            ),
        })?;
        let path = entry.path();

        if !path.exists() {
            problems.push(ReviewRunListProblem::new(
                path.to_string_lossy(),
                ReviewRunListProblemState::MissingFolder,
                "review run folder disappeared while reading the list",
            ));
            continue;
        }

        if !path.is_dir() {
            continue;
        }

        let manifest = match read_review_run_manifest(&path) {
            Ok(manifest) => manifest,
            Err(error) => {
                problems.push(ReviewRunListProblem::new(
                    path.to_string_lossy(),
                    ReviewRunListProblemState::Malformed,
                    error.to_string(),
                ));
                continue;
            }
        };

        if !manifest.has_supported_schema_version()
            || !review_run_target_matches(&manifest.target, target)
        {
            continue;
        }

        let metadata = match read_listed_review_run_metadata(&path) {
            Ok(metadata) => metadata,
            Err(error) => {
                problems.push(ReviewRunListProblem::new(
                    path.to_string_lossy(),
                    ReviewRunListProblemState::Malformed,
                    error.to_string(),
                ));
                continue;
            }
        };
        runs.push(ListedReviewRun::new(
            restore_review_run_from_manifest_with_status(manifest, metadata.status)?,
            path.to_string_lossy(),
            metadata.summary,
            metadata.warnings,
        ));
    }

    runs.sort_by(|left, right| {
        right
            .review_run()
            .created_at()
            .cmp(&left.review_run().created_at())
    });

    Ok(runs)
}

fn review_run_state_directory(
    layout: &WorkspaceLayout,
    spec_id: &SpecId,
    state: ReviewRunFolderState,
) -> Result<PathBuf, AppUseCaseError> {
    Ok(spec_directory_path(layout, spec_id.as_str())?
        .join(USER_REVIEW_DIRECTORY)
        .join(state.directory_name()))
}

fn read_review_run_manifest(
    run_directory: &Path,
) -> Result<ReviewRunManifestDocument, AppUseCaseError> {
    let path = run_directory.join("manifest.json");
    let contents =
        fs::read_to_string(&path).map_err(|source| AppUseCaseError::ReviewRunExport {
            message: format!(
                "failed to read review run manifest {}: {source}",
                path.to_string_lossy()
            ),
        })?;

    serde_json::from_str(&contents).map_err(|source| AppUseCaseError::ReviewRunExport {
        message: format!(
            "failed to parse review run manifest {}: {source}",
            path.to_string_lossy()
        ),
    })
}

fn read_review_run_status(
    run_directory: &Path,
) -> Result<ReviewRunStatusDocument, AppUseCaseError> {
    let path = run_directory.join("status.json");
    let contents =
        fs::read_to_string(&path).map_err(|source| AppUseCaseError::ReviewRunExport {
            message: format!(
                "failed to read review run status {}: {source}",
                path.to_string_lossy()
            ),
        })?;

    serde_json::from_str(&contents).map_err(|source| AppUseCaseError::ReviewRunExport {
        message: format!(
            "failed to parse review run status {}: {source}",
            path.to_string_lossy()
        ),
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ListedReviewRunMetadata {
    status: UserReviewRunStatus,
    summary: Option<String>,
    warnings: Vec<String>,
}

fn read_listed_review_run_metadata(
    run_directory: &Path,
) -> Result<ListedReviewRunMetadata, AppUseCaseError> {
    let status = read_review_run_status(run_directory)?;
    let result_summary = read_result_summary(run_directory)?;

    Ok(ListedReviewRunMetadata {
        status: review_run_status_from_document(status.status),
        summary: status.summary.or(result_summary),
        warnings: status.warnings,
    })
}

fn read_result_summary(run_directory: &Path) -> Result<Option<String>, AppUseCaseError> {
    let path = run_directory.join("result.md");

    if !path.exists() {
        return Ok(None);
    }

    let contents =
        fs::read_to_string(&path).map_err(|source| AppUseCaseError::ReviewRunExport {
            message: format!(
                "failed to read review run result {}: {source}",
                path.to_string_lossy()
            ),
        })?;

    Ok(extract_result_summary(&contents))
}

fn extract_result_summary(contents: &str) -> Option<String> {
    contents
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .find(|line| {
            !line.starts_with('#')
                && !line.starts_with("- Review run:")
                && !line.starts_with("- Status:")
                && *line != "-"
        })
        .map(|line| line.trim_start_matches("- ").to_string())
}

fn review_run_target_matches(
    document: &ReviewRunTargetDocument,
    target: &UserReviewRunTarget,
) -> bool {
    match (document, target) {
        (
            ReviewRunTargetDocument::File { spec_id, file_key },
            UserReviewRunTarget::File {
                spec_id: target_spec_id,
                file_key: target_file_key,
            },
        ) => spec_id == target_spec_id.as_str() && file_key == target_file_key.as_str(),
        (
            ReviewRunTargetDocument::Spec { spec_id },
            UserReviewRunTarget::Spec {
                spec_id: target_spec_id,
            },
        ) => spec_id == target_spec_id.as_str(),
        _ => false,
    }
}

fn restore_review_run_from_manifest(
    manifest: ReviewRunManifestDocument,
) -> Result<UserReviewRun, AppUseCaseError> {
    let status = review_run_status_from_document(manifest.status);

    restore_review_run_from_manifest_with_status(manifest, status)
}

fn restore_review_run_from_manifest_with_status(
    manifest: ReviewRunManifestDocument,
    status: UserReviewRunStatus,
) -> Result<UserReviewRun, AppUseCaseError> {
    UserReviewRun::restore(
        UserReviewRunId::new(manifest.id)?,
        status,
        review_run_target_from_document(manifest.target)?,
        review_run_execution_target_from_document(manifest.execution_target)?,
        ReviewRunPathValue::new(manifest.spec_folder_path)?,
        manifest
            .source_files
            .into_iter()
            .map(review_run_source_file_from_document)
            .collect::<Result<Vec<_>, _>>()?,
        manifest
            .comment_ids
            .into_iter()
            .map(CommentId::new)
            .collect::<Result<Vec<_>, _>>()?,
        manifest.created_at,
        manifest.archived_at,
    )
    .map_err(AppUseCaseError::from)
}

fn collect_source_file_change_warnings(
    manifest: &ReviewRunManifestDocument,
) -> Result<Vec<String>, AppUseCaseError> {
    let workspace_path = execution_workspace_path_from_document(&manifest.execution_target);
    let mut warnings = Vec::new();

    for source_file in &manifest.source_files {
        let source_path = Path::new(workspace_path).join(&source_file.relative_path);

        if source_changed_after_export(&source_path, manifest.created_at)? {
            warnings.push(format!(
                "source file changed after export: {}",
                source_file.relative_path
            ));
        }
    }

    Ok(warnings)
}

fn source_changed_after_export(
    source_path: &Path,
    created_at: DateTime<Utc>,
) -> Result<bool, AppUseCaseError> {
    let metadata = match fs::metadata(source_path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(true);
        }
        Err(source) => {
            return Err(AppUseCaseError::ReviewRunExport {
                message: format!(
                    "failed to read source file metadata {}: {source}",
                    source_path.to_string_lossy()
                ),
            });
        }
    };
    let modified_at = metadata
        .modified()
        .map_err(|source| AppUseCaseError::ReviewRunExport {
            message: format!(
                "failed to read source file modified time {}: {source}",
                source_path.to_string_lossy()
            ),
        })?;
    let modified_at: DateTime<Utc> = modified_at.into();

    Ok(modified_at > created_at)
}

fn execution_workspace_path_from_document(
    execution_target: &ReviewRunExecutionTargetDocument,
) -> &str {
    match execution_target {
        ReviewRunExecutionTargetDocument::CurrentWorkspace { workspace_path } => workspace_path,
        ReviewRunExecutionTargetDocument::Worktree { worktree_path, .. } => worktree_path,
    }
}

fn append_unique_warnings(warnings: &mut Vec<String>, next_warnings: Vec<String>) {
    let mut existing = warnings.iter().cloned().collect::<BTreeSet<_>>();

    for warning in next_warnings {
        if existing.insert(warning.clone()) {
            warnings.push(warning);
        }
    }
}

fn write_json_document<T: Serialize>(path: &Path, document: &T) -> Result<(), AppUseCaseError> {
    let contents = serde_json::to_string_pretty(document).map_err(|source| {
        AppUseCaseError::ReviewRunExport {
            message: format!(
                "failed to serialize review run JSON {}: {source}",
                path.to_string_lossy()
            ),
        }
    })?;

    fs::write(path, format!("{contents}\n")).map_err(|source| AppUseCaseError::ReviewRunExport {
        message: format!(
            "failed to write review run JSON {}: {source}",
            path.to_string_lossy()
        ),
    })
}

fn review_run_status_from_document(status: ReviewRunStatusValue) -> UserReviewRunStatus {
    match status {
        ReviewRunStatusValue::Active => UserReviewRunStatus::Active,
        ReviewRunStatusValue::InProgress => UserReviewRunStatus::InProgress,
        ReviewRunStatusValue::Completed => UserReviewRunStatus::Completed,
        ReviewRunStatusValue::Archived => UserReviewRunStatus::Archived,
    }
}

fn review_run_target_from_document(
    target: ReviewRunTargetDocument,
) -> Result<UserReviewRunTarget, AppUseCaseError> {
    match target {
        ReviewRunTargetDocument::File { spec_id, file_key } => Ok(UserReviewRunTarget::file(
            SpecId::new(spec_id)?,
            SpecFileKey::from_str(&file_key)?,
        )),
        ReviewRunTargetDocument::Spec { spec_id } => {
            Ok(UserReviewRunTarget::spec(SpecId::new(spec_id)?))
        }
    }
}

fn review_run_execution_target_from_document(
    target: ReviewRunExecutionTargetDocument,
) -> Result<UserReviewExecutionTarget, AppUseCaseError> {
    match target {
        ReviewRunExecutionTargetDocument::CurrentWorkspace { workspace_path } => Ok(
            UserReviewExecutionTarget::current_workspace(ReviewRunPathValue::new(workspace_path)?),
        ),
        ReviewRunExecutionTargetDocument::Worktree {
            repository_path,
            worktree_path,
            branch_name,
        } => Ok(UserReviewExecutionTarget::worktree(
            ReviewRunPathValue::new(repository_path)?,
            ReviewRunPathValue::new(worktree_path)?,
            ReviewRunBranchName::new(branch_name)?,
        )),
    }
}

fn review_run_source_file_from_document(
    source_file: ReviewRunSourceFileDocument,
) -> Result<UserReviewSourceFile, AppUseCaseError> {
    Ok(UserReviewSourceFile::new(
        SpecId::new(source_file.spec_id)?,
        SpecFileKey::from_str(&source_file.file_key)?,
        ReviewRunRelativePath::new(source_file.relative_path)?,
    ))
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReviewRunCommentDocument {
    id: String,
    anchor: ReviewRunCommentAnchorDocument,
    body: String,
    status: String,
    resolved: bool,
    anchor_resolution: Option<ReviewRunAnchorResolutionDocument>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    exported_at: DateTime<Utc>,
}

impl ReviewRunCommentDocument {
    fn from_resolution(
        resolution: &crate::app::use_cases::CommentAnchorResolution,
        exported_at: DateTime<Utc>,
    ) -> Self {
        let comment = resolution.comment();

        Self {
            id: comment.id().as_str().to_string(),
            anchor: ReviewRunCommentAnchorDocument::from_anchor(comment.anchor()),
            body: comment.body().as_str().to_string(),
            status: comment_status(comment.status()).to_string(),
            resolved: comment.is_resolved(),
            anchor_resolution: Some(ReviewRunAnchorResolutionDocument::from_resolution(
                resolution,
            )),
            created_at: comment.created_at(),
            updated_at: comment.updated_at(),
            exported_at,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReviewRunCommentAnchorDocument {
    file_key: String,
    block_type: String,
    block_index: usize,
    text_hash: String,
    text_snippet: String,
    char_range: ReviewRunCharRangeDocument,
}

impl ReviewRunCommentAnchorDocument {
    fn from_anchor(anchor: &CommentAnchor) -> Self {
        let char_range = anchor.char_range();

        Self {
            file_key: anchor.file_key().as_str().to_string(),
            block_type: block_type(anchor.block_type()).to_string(),
            block_index: anchor.block_index().value(),
            text_hash: anchor.text_hash().as_str().to_string(),
            text_snippet: anchor.text_snippet().as_str().to_string(),
            char_range: ReviewRunCharRangeDocument {
                start: char_range.start(),
                end: char_range.end(),
            },
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReviewRunCharRangeDocument {
    start: usize,
    end: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReviewRunAnchorResolutionDocument {
    status: String,
    reason: String,
    details: Option<String>,
    target: Option<ReviewRunAnchorResolutionTargetDocument>,
}

impl ReviewRunAnchorResolutionDocument {
    fn from_resolution(resolution: &crate::app::use_cases::CommentAnchorResolution) -> Self {
        Self {
            status: anchor_resolution_status(resolution.status()).to_string(),
            reason: anchor_resolution_reason(resolution.reason()).to_string(),
            details: resolution.details().map(str::to_string),
            target: resolution
                .target()
                .map(ReviewRunAnchorResolutionTargetDocument::from_target),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReviewRunAnchorResolutionTargetDocument {
    block_type: String,
    block_index: usize,
    text_hash: String,
    text_snippet: String,
    source_range: Option<ReviewRunSourceRangeDocument>,
    score: u8,
}

impl ReviewRunAnchorResolutionTargetDocument {
    fn from_target(target: &crate::app::use_cases::CommentAnchorResolutionTarget) -> Self {
        let block = target.block();

        Self {
            block_type: block.block_type().as_str().to_string(),
            block_index: block.index().value(),
            text_hash: block.text_hash().as_str().to_string(),
            text_snippet: block_snippet(block),
            source_range: block.source_range().map(ReviewRunSourceRangeDocument::from),
            score: target.score(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReviewRunSourceRangeDocument {
    start_byte_offset: usize,
    end_byte_offset: usize,
}

impl From<MarkdownBlockSourceRange> for ReviewRunSourceRangeDocument {
    fn from(range: MarkdownBlockSourceRange) -> Self {
        Self {
            start_byte_offset: range.start_byte_offset(),
            end_byte_offset: range.end_byte_offset(),
        }
    }
}

fn block_snippet(block: &MarkdownBlock) -> String {
    const MAX_SNIPPET_CHARS: usize = 240;
    let text = block.text().normalized();
    let mut snippet = text.chars().take(MAX_SNIPPET_CHARS).collect::<String>();

    if text.chars().count() > MAX_SNIPPET_CHARS {
        snippet.push_str("...");
    }

    snippet
}

fn comment_status(status: CommentStatus) -> &'static str {
    match status {
        CommentStatus::Open => "open",
        CommentStatus::Resolved => "resolved",
    }
}

fn anchor_resolution_status(status: AnchorResolutionStatus) -> &'static str {
    match status {
        AnchorResolutionStatus::Resolved => "resolved",
        AnchorResolutionStatus::Moved => "moved",
        AnchorResolutionStatus::Fuzzy => "fuzzy",
        AnchorResolutionStatus::Orphaned => "orphaned",
    }
}

fn anchor_resolution_reason(reason: AnchorResolutionReason) -> &'static str {
    match reason {
        AnchorResolutionReason::ExactMatch => "exact_match",
        AnchorResolutionReason::MovedByHash => "moved_by_hash",
        AnchorResolutionReason::StaleSnippet => "stale_snippet",
        AnchorResolutionReason::FuzzyMatch => "fuzzy_match",
        AnchorResolutionReason::MissingOriginalBlock => "missing_original_block",
        AnchorResolutionReason::AmbiguousFuzzyCandidates => "ambiguous_fuzzy_candidates",
        AnchorResolutionReason::BelowThreshold => "below_threshold",
        AnchorResolutionReason::DeletedText => "deleted_text",
        AnchorResolutionReason::UnsupportedBlockType => "unsupported_block_type",
    }
}

fn block_type(block_type: BlockType) -> &'static str {
    match block_type {
        BlockType::Paragraph => "paragraph",
        BlockType::Heading => "heading",
        BlockType::ListItem => "list_item",
        BlockType::CodeBlock => "code_block",
        BlockType::BlockQuote => "block_quote",
        BlockType::Table => "table",
        BlockType::ThematicBreak => "thematic_break",
        BlockType::Html => "html",
        BlockType::Other => "other",
    }
}

impl From<crate::domain::review_run::ReviewRunDomainError> for AppUseCaseError {
    fn from(source: crate::domain::review_run::ReviewRunDomainError) -> Self {
        Self::ReviewRunExport {
            message: source.to_string(),
        }
    }
}

impl From<crate::infrastructure::persistence::review_run_paths::ReviewRunPathError>
    for AppUseCaseError
{
    fn from(
        source: crate::infrastructure::persistence::review_run_paths::ReviewRunPathError,
    ) -> Self {
        Self::ReviewRunExport {
            message: source.to_string(),
        }
    }
}

impl From<crate::infrastructure::persistence::review_run_writer::ReviewRunBundleWriteError>
    for AppUseCaseError
{
    fn from(
        source: crate::infrastructure::persistence::review_run_writer::ReviewRunBundleWriteError,
    ) -> Self {
        Self::ReviewRunExport {
            message: source.to_string(),
        }
    }
}

impl From<GitReviewWorktreeError> for AppUseCaseError {
    fn from(source: GitReviewWorktreeError) -> Self {
        Self::ReviewRunExport {
            message: source.message(),
        }
    }
}

#[cfg(test)]
mod tests {
    use std::{
        env, fs,
        path::{Path, PathBuf},
        process::Command,
        time::{SystemTime, UNIX_EPOCH},
    };

    use serde_json::Value;

    use super::*;
    struct TestWorkspace {
        root: PathBuf,
        worktree_parent: PathBuf,
    }

    impl TestWorkspace {
        fn new(name: &str) -> Self {
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

        fn root_path(&self) -> &Path {
            &self.root
        }

        fn root_string(&self) -> String {
            self.root.to_string_lossy().into_owned()
        }

        fn task_file_path(&self) -> PathBuf {
            self.root
                .join(".plugin-workspace/.specs/auth")
                .join("tasks.md")
        }

        fn impl_file_path(&self) -> PathBuf {
            self.root
                .join(".plugin-workspace/.specs/auth")
                .join("implementation-plan.md")
        }

        fn active_directory(&self) -> PathBuf {
            self.root
                .join(".plugin-workspace/.specs/auth/user-review/active")
        }

        fn archive_directory(&self) -> PathBuf {
            self.root
                .join(".plugin-workspace/.specs/auth/user-review/archive")
        }

        fn worktree_parent(&self) -> &Path {
            &self.worktree_parent
        }

        fn write_task_file(&self, contents: &str) {
            fs::write(self.task_file_path(), contents).expect("task file should be written");
        }

        fn write_impl_file(&self, contents: &str) {
            fs::write(self.impl_file_path(), contents).expect("impl file should be written");
        }

        fn write_comment_file(&self, comment_id: &str) {
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

        fn write_impl_comment_file(&self, comment_id: &str) {
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

        fn read_json(&self, path: &Path) -> Value {
            let contents = fs::read_to_string(path).expect("json file should be readable");

            serde_json::from_str(&contents).expect("json should parse")
        }

        fn write_json(&self, path: &Path, value: &Value) {
            fs::write(
                path,
                format!(
                    "{}\n",
                    serde_json::to_string_pretty(value).expect("json should serialize")
                ),
            )
            .expect("json file should be written");
        }

        fn initialize_git_repo(&self) {
            self.run_git(["init"]);
            self.run_git(["config", "user.email", "test@example.com"]);
            self.run_git(["config", "user.name", "Spec Reviewer Test"]);
        }

        fn commit_all(&self) {
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

    fn create_file_run_input(comment_id: &str) -> CreateReviewRunInput {
        CreateReviewRunInput::new(
            UserReviewRunTarget::file(
                SpecId::new("auth").expect("spec id should be valid"),
                SpecFileKey::Tasks,
            ),
            vec![CommentId::new(comment_id).expect("comment id should be valid")],
            ReviewRunExecutionMode::CurrentWorkspace,
        )
    }

    fn create_impl_file_run_input(comment_id: &str) -> CreateReviewRunInput {
        CreateReviewRunInput::new(
            UserReviewRunTarget::file(
                SpecId::new("auth").expect("spec id should be valid"),
                SpecFileKey::Impl,
            ),
            vec![CommentId::new(comment_id).expect("comment id should be valid")],
            ReviewRunExecutionMode::CurrentWorkspace,
        )
    }

    fn create_worktree_file_run_input(comment_id: &str) -> CreateReviewRunInput {
        CreateReviewRunInput::new(
            UserReviewRunTarget::file(
                SpecId::new("auth").expect("spec id should be valid"),
                SpecFileKey::Tasks,
            ),
            vec![CommentId::new(comment_id).expect("comment id should be valid")],
            ReviewRunExecutionMode::Worktree,
        )
    }

    fn archive_file_run_input(run_id: &str) -> ArchiveReviewRunInput {
        ArchiveReviewRunInput::new(
            UserReviewRunTarget::file(
                SpecId::new("auth").expect("spec id should be valid"),
                SpecFileKey::Tasks,
            ),
            UserReviewRunId::new(run_id).expect("run id should be valid"),
        )
    }

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
