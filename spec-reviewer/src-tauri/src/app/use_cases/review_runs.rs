//! Review run use cases that export user comments into filesystem bundles.

use std::{
    collections::{BTreeSet, HashSet},
    path::Path,
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
            ReviewRunPathValue, ReviewRunRelativePath, UserReviewExecutionTarget, UserReviewRun,
            UserReviewRunId, UserReviewRunStatus, UserReviewRunTarget, UserReviewSourceFile,
        },
        spec::{MarkdownBlock, MarkdownBlockSourceRange, SpecFile, SpecFileKey, SpecId, SpecNode},
    },
    infrastructure::{
        filesystem::safe_relative_spec_path,
        persistence::{
            review_run_paths::{ReviewRunFolderState, ReviewRunPathResolver},
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
        if matches!(input.execution_mode(), ReviewRunExecutionMode::Worktree) {
            return Err(AppUseCaseError::ReviewRunExport {
                message:
                    "worktree mode will be enabled by RL.3; use currentWorkspace for this export"
                        .to_string(),
            });
        }

        if input.comment_ids().is_empty() {
            return Err(AppUseCaseError::ReviewRunExport {
                message: "review run requires at least one selected comment".to_string(),
            });
        }

        let created_at = Utc::now();
        let run_id = create_review_run_id(input.target(), created_at)?;
        let spec_id = input.target().spec_id().clone();
        let path = ReviewRunPathResolver::new().resolve(
            workspace.layout(),
            &spec_id,
            &run_id,
            ReviewRunFolderState::Active,
        )?;
        let files = collect_target_files(self, workspace, input.target())?;
        let bundle_files =
            collect_bundle_files(self, workspace, &files, input.comment_ids(), created_at)?;
        let source_files = bundle_files
            .iter()
            .map(|file| file.source_file.clone())
            .collect::<Vec<_>>();
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

        let execution_target = UserReviewExecutionTarget::current_workspace(
            ReviewRunPathValue::new(workspace.layout().root().as_str())?,
        );
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

#[cfg(test)]
mod tests {
    use std::{
        env, fs,
        path::{Path, PathBuf},
        time::{SystemTime, UNIX_EPOCH},
    };

    use serde_json::Value;

    use super::*;
    struct TestWorkspace {
        root: PathBuf,
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

            Self { root }
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

        fn active_directory(&self) -> PathBuf {
            self.root
                .join(".plugin-workspace/.specs/auth/user-review/active")
        }

        fn write_task_file(&self, contents: &str) {
            fs::write(self.task_file_path(), contents).expect("task file should be written");
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

        fn read_json(&self, path: &Path) -> Value {
            let contents = fs::read_to_string(path).expect("json file should be readable");

            serde_json::from_str(&contents).expect("json should parse")
        }
    }

    impl Drop for TestWorkspace {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
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
    fn create_review_run_rejects_worktree_mode_before_writing_bundle() {
        let workspace = TestWorkspace::new("worktree-mode");
        workspace.write_task_file("# Tasks\n\nClarify checkout task.\n");
        workspace.write_comment_file("cmt_1");
        let use_cases = FilesystemAppUseCases::default();
        let loaded_workspace = use_cases
            .load_workspace(workspace.root_path().to_string_lossy())
            .expect("workspace should load");
        let input = CreateReviewRunInput::new(
            UserReviewRunTarget::file(
                SpecId::new("auth").expect("spec id should be valid"),
                SpecFileKey::Tasks,
            ),
            vec![CommentId::new("cmt_1").expect("comment id should be valid")],
            ReviewRunExecutionMode::Worktree,
        );

        let result = use_cases.create_review_run(&loaded_workspace, input);

        assert!(matches!(
            result,
            Err(AppUseCaseError::ReviewRunExport { .. })
        ));
        assert!(!workspace.active_directory().exists());
    }
}
