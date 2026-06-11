//! Review bundle content concepts exported for a user review run.

use std::path::Path;

use chrono::{DateTime, Utc};
use serde::Serialize;

use crate::domain::{
    comment::{
        AnchorResolutionReason, AnchorResolutionStatus, BlockType, Comment, CommentAnchor,
        CommentId, CommentStatus,
    },
    review_run::{
        ReviewRunDomainError, ReviewRunRelativePath, UserReviewRun, UserReviewSourceFile,
    },
    spec::{MarkdownBlock, MarkdownBlockSourceRange, SpecFileKey, SpecId},
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReviewRunBundleFile {
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

impl ReviewRunBundleFile {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        spec_id: SpecId,
        spec_label: impl Into<String>,
        file_key: SpecFileKey,
        file_label: impl Into<String>,
        source_path: impl Into<String>,
        context_relative_path: ReviewRunRelativePath,
        source_file: UserReviewSourceFile,
        markdown_contents: impl Into<String>,
        comments: Vec<ReviewRunCommentDocument>,
    ) -> Self {
        Self {
            spec_id,
            spec_label: spec_label.into(),
            file_key,
            file_label: file_label.into(),
            source_path: source_path.into(),
            context_relative_path,
            source_file,
            markdown_contents: markdown_contents.into(),
            comments,
        }
    }

    pub fn spec_id(&self) -> &SpecId {
        &self.spec_id
    }

    pub fn spec_label(&self) -> &str {
        &self.spec_label
    }

    pub fn file_key(&self) -> SpecFileKey {
        self.file_key
    }

    pub fn file_label(&self) -> &str {
        &self.file_label
    }

    pub fn source_path(&self) -> &str {
        &self.source_path
    }

    pub fn context_relative_path(&self) -> &ReviewRunRelativePath {
        &self.context_relative_path
    }

    pub fn source_file(&self) -> &UserReviewSourceFile {
        &self.source_file
    }

    pub fn markdown_contents(&self) -> &str {
        &self.markdown_contents
    }

    pub fn comments(&self) -> &[ReviewRunCommentDocument] {
        &self.comments
    }

    pub fn collect_comment_ids(files: &[Self]) -> Vec<CommentId> {
        files
            .iter()
            .flat_map(|file| file.comments.iter())
            .map(|comment| {
                CommentId::new(comment.id.clone())
                    .expect("serialized comments use valid comment ids")
            })
            .collect()
    }

    pub fn relocate_all(
        files: &mut [Self],
        current_workspace_path: &str,
        execution_workspace_path: &str,
    ) -> Result<(), ReviewRunDomainError> {
        for file in files {
            let relative_path = ReviewRunRelativePath::from_workspace_source(
                current_workspace_path,
                &file.source_path,
            )?
            .to_string();
            file.source_path = Path::new(execution_workspace_path)
                .join(relative_path)
                .to_string_lossy()
                .into_owned();
        }

        Ok(())
    }
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

impl UserReviewRun {
    pub fn render_instructions(&self, files: &[ReviewRunBundleFile]) -> String {
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
        output.push_str(&format!("- Review run: `{}`\n", self.id()));
        output.push_str(&format!("- Scope: `{}`\n", self.target().describe()));
        output.push_str(&format!(
            "- Execution: `{}`\n\n",
            self.execution_target().describe()
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

    pub fn render_result_template(&self) -> String {
        format!(
            "# レビュー対応結果\n\n- Review run: `{}`\n- Status: `active`\n\n## 対応した変更\n\n- \n\n## 対応しなかったコメント\n\n- \n\n## フォローアップ質問\n\n- \n",
            self.id()
        )
    }
}

/// Markdown contents of a review run `result.md` document.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReviewRunResultMarkdown {
    contents: String,
}

impl ReviewRunResultMarkdown {
    pub fn new(contents: impl Into<String>) -> Self {
        Self {
            contents: contents.into(),
        }
    }

    pub fn summary(&self) -> Option<String> {
        self.contents
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
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewRunCommentDocument {
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
    pub fn from_comment(
        comment: &Comment,
        anchor_resolution: Option<ReviewRunAnchorResolutionDocument>,
        exported_at: DateTime<Utc>,
    ) -> Self {
        Self {
            id: comment.id().as_str().to_string(),
            anchor: ReviewRunCommentAnchorDocument::from_anchor(comment.anchor()),
            body: comment.body().as_str().to_string(),
            status: comment_status(comment.status()).to_string(),
            resolved: comment.is_resolved(),
            anchor_resolution,
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
pub struct ReviewRunAnchorResolutionDocument {
    status: String,
    reason: String,
    details: Option<String>,
    target: Option<ReviewRunAnchorResolutionTargetDocument>,
}

impl ReviewRunAnchorResolutionDocument {
    pub fn new(
        status: AnchorResolutionStatus,
        reason: AnchorResolutionReason,
        details: Option<&str>,
        target: Option<ReviewRunAnchorResolutionTargetDocument>,
    ) -> Self {
        Self {
            status: anchor_resolution_status(status).to_string(),
            reason: anchor_resolution_reason(reason).to_string(),
            details: details.map(str::to_string),
            target,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewRunAnchorResolutionTargetDocument {
    block_type: String,
    block_index: usize,
    text_hash: String,
    text_snippet: String,
    source_range: Option<ReviewRunSourceRangeDocument>,
    score: u8,
}

impl ReviewRunAnchorResolutionTargetDocument {
    pub fn from_block(block: &MarkdownBlock, score: u8) -> Self {
        Self {
            block_type: block.block_type().as_str().to_string(),
            block_index: block.index().value(),
            text_hash: block.text_hash().as_str().to_string(),
            text_snippet: block_snippet(block),
            source_range: block.source_range().map(ReviewRunSourceRangeDocument::from),
            score,
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

fn format_blockquote(value: &str) -> String {
    value
        .lines()
        .map(|line| format!("> {line}\n"))
        .collect::<String>()
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
