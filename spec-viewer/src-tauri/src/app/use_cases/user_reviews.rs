//! User-review use cases that build and persist single-document aggregates.

use std::{
    collections::HashMap,
    path::{Component, Path},
};

use thiserror::Error;

use crate::{
    app::{
        services::user_review_id::{
            GenerateUserReviewId, UuidUserReviewIdGenerator, MAX_USER_REVIEW_CREATE_ATTEMPTS,
        },
        use_cases::{
            comments::{resolve_comment_anchor, GetCurrentTime, UtcCommentClock},
            spec_config_for_directory, AppUseCaseError, FilesystemAppUseCases, LoadWorkspaceResult,
            ReadSpecFileResult,
        },
    },
    domain::{
        comment::{
            CommentId, CommentListQuery, CommentRepository, CommentScope, CommentStatusFilter,
        },
        spec::{MarkdownBlock, SpecDocumentFormat, SpecFileKey, SpecId, SpecNode},
        user_review::{
            PositiveLineNumber, UserReview, UserReviewArchiveOutcome, UserReviewComment,
            UserReviewCreateOutcome, UserReviewDomainError, UserReviewId, UserReviewListOutcome,
            UserReviewRepository, UserReviewRepositoryError, UserReviewSource, UserReviewTarget,
        },
        workspace::WorkspaceRelativePath,
    },
    infrastructure::persistence::{
        comment_store::JsonCommentRepository, user_review_repository::JsonUserReviewRepository,
    },
};

pub type FilesystemUserReviewUseCases<'a> = UserReviewUseCases<
    JsonUserReviewRepository,
    JsonCommentRepository,
    FilesystemUserReviewSourceLoader<'a>,
    UuidUserReviewIdGenerator,
    UtcCommentClock,
>;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CreateUserReviewInput {
    target: UserReviewTarget,
    comment_ids: Vec<CommentId>,
}

impl CreateUserReviewInput {
    pub fn new(target: UserReviewTarget, comment_ids: Vec<CommentId>) -> Self {
        Self {
            target,
            comment_ids,
        }
    }

    pub fn target(&self) -> &UserReviewTarget {
        &self.target
    }

    pub fn comment_ids(&self) -> &[CommentId] {
        &self.comment_ids
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ListUserReviewsInput {
    target: UserReviewTarget,
}

impl ListUserReviewsInput {
    pub fn new(target: UserReviewTarget) -> Self {
        Self { target }
    }

    pub fn target(&self) -> &UserReviewTarget {
        &self.target
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArchiveUserReviewInput {
    target: UserReviewTarget,
    user_review_id: UserReviewId,
}

impl ArchiveUserReviewInput {
    pub fn new(target: UserReviewTarget, user_review_id: UserReviewId) -> Self {
        Self {
            target,
            user_review_id,
        }
    }

    pub fn target(&self) -> &UserReviewTarget {
        &self.target
    }

    pub fn user_review_id(&self) -> &UserReviewId {
        &self.user_review_id
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UserReviewSourceDocument {
    spec_id: SpecId,
    file_key: SpecFileKey,
    file_path: WorkspaceRelativePath,
    contents: String,
    blocks: Vec<MarkdownBlock>,
}

impl UserReviewSourceDocument {
    pub fn new(
        spec_id: SpecId,
        file_key: SpecFileKey,
        file_path: WorkspaceRelativePath,
        contents: impl Into<String>,
        blocks: Vec<MarkdownBlock>,
    ) -> Self {
        Self {
            spec_id,
            file_key,
            file_path,
            contents: contents.into(),
            blocks,
        }
    }

    pub fn spec_id(&self) -> &SpecId {
        &self.spec_id
    }

    pub fn file_key(&self) -> SpecFileKey {
        self.file_key
    }

    pub fn file_path(&self) -> &WorkspaceRelativePath {
        &self.file_path
    }

    pub fn contents(&self) -> &str {
        &self.contents
    }

    pub fn blocks(&self) -> &[MarkdownBlock] {
        &self.blocks
    }
}

pub trait LoadUserReviewSources {
    fn load_user_review_sources(
        &self,
        target: &UserReviewTarget,
    ) -> Result<Vec<UserReviewSourceDocument>, AppUseCaseError>;
}

#[derive(Debug, Clone)]
pub struct UserReviewUseCases<Repository, Comments, Sources, IdGenerator, Clock> {
    repository: Repository,
    comments: Comments,
    sources: Sources,
    id_generator: IdGenerator,
    clock: Clock,
}

impl<Repository, Comments, Sources, IdGenerator, Clock>
    UserReviewUseCases<Repository, Comments, Sources, IdGenerator, Clock>
{
    pub fn new(
        repository: Repository,
        comments: Comments,
        sources: Sources,
        id_generator: IdGenerator,
        clock: Clock,
    ) -> Self {
        Self {
            repository,
            comments,
            sources,
            id_generator,
            clock,
        }
    }
}

impl<Repository, Comments, Sources, IdGenerator, Clock>
    UserReviewUseCases<Repository, Comments, Sources, IdGenerator, Clock>
where
    Repository: UserReviewRepository,
    Comments: CommentRepository,
    Sources: LoadUserReviewSources,
    IdGenerator: GenerateUserReviewId,
    Clock: GetCurrentTime,
{
    pub fn create_user_review(
        &self,
        input: CreateUserReviewInput,
    ) -> Result<UserReviewCreateOutcome, AppUseCaseError> {
        if input.comment_ids().is_empty() {
            return Err(UserReviewUseCaseError::MissingCommentSelection.into());
        }

        let source_documents = self.sources.load_user_review_sources(input.target())?;
        if source_documents.is_empty() {
            return Err(UserReviewUseCaseError::MissingTargetSources {
                spec_id: input.target().spec_id().clone(),
            }
            .into());
        }
        let comments = self.collect_selected_comments(&input, &source_documents)?;
        let created_at = self.clock.now();

        for attempt in 1..=MAX_USER_REVIEW_CREATE_ATTEMPTS {
            let id = self
                .id_generator
                .generate_user_review_id()
                .map_err(UserReviewUseCaseError::Domain)?;
            let review = UserReview::new(id, input.target().clone(), comments.clone(), created_at)
                .map_err(UserReviewUseCaseError::Domain)?;

            match self.repository.create(review) {
                Ok(created) => return Ok(created),
                Err(UserReviewRepositoryError::AlreadyExists { .. })
                    if attempt < MAX_USER_REVIEW_CREATE_ATTEMPTS => {}
                Err(UserReviewRepositoryError::AlreadyExists { .. }) => {
                    return Err(UserReviewUseCaseError::CreateIdCollision {
                        attempts: MAX_USER_REVIEW_CREATE_ATTEMPTS,
                    }
                    .into());
                }
                Err(source) => return Err(UserReviewUseCaseError::Repository(source).into()),
            }
        }

        Err(UserReviewUseCaseError::CreateIdCollision {
            attempts: MAX_USER_REVIEW_CREATE_ATTEMPTS,
        }
        .into())
    }

    pub fn list_user_reviews(
        &self,
        input: ListUserReviewsInput,
    ) -> Result<UserReviewListOutcome, AppUseCaseError> {
        self.repository
            .list(input.target())
            .map_err(|source| UserReviewUseCaseError::Repository(source).into())
    }

    pub fn archive_user_review(
        &self,
        input: ArchiveUserReviewInput,
    ) -> Result<UserReviewArchiveOutcome, AppUseCaseError> {
        let archived_at = self.clock.now();
        let listed = self
            .repository
            .list(input.target())
            .map_err(UserReviewUseCaseError::Repository)?;

        if let Some(mut review) = listed
            .active()
            .iter()
            .chain(listed.archived())
            .find(|review| review.id() == input.user_review_id())
            .cloned()
        {
            review
                .archive(input.user_review_id(), input.target(), archived_at)
                .map_err(UserReviewUseCaseError::Domain)?;
        }

        self.repository
            .archive(input.user_review_id(), input.target(), archived_at)
            .map_err(|source| UserReviewUseCaseError::Repository(source).into())
    }

    fn collect_selected_comments(
        &self,
        input: &CreateUserReviewInput,
        source_documents: &[UserReviewSourceDocument],
    ) -> Result<Vec<UserReviewComment>, AppUseCaseError> {
        let mut snapshots = HashMap::new();

        for source in source_documents {
            let query = CommentListQuery::with_status_filter(
                CommentScope::new(source.spec_id().clone(), source.file_key()),
                CommentStatusFilter::Open,
            );
            let comments = self.comments.list(&query)?;

            for comment in comments
                .into_iter()
                .filter(|comment| input.comment_ids().contains(comment.id()))
            {
                let id = comment.id().clone();
                let snapshot = snapshot_comment(comment, source)?;
                if snapshots.insert(id.clone(), snapshot).is_some() {
                    return Err(UserReviewUseCaseError::AmbiguousCommentId { id }.into());
                }
            }
        }

        let missing = input
            .comment_ids()
            .iter()
            .filter(|id| !snapshots.contains_key(*id))
            .cloned()
            .collect::<Vec<_>>();
        if !missing.is_empty() {
            return Err(UserReviewUseCaseError::SelectedCommentsNotFound { ids: missing }.into());
        }

        input
            .comment_ids()
            .iter()
            .map(|id| {
                snapshots
                    .get(id)
                    .cloned()
                    .ok_or_else(|| UserReviewUseCaseError::SelectedCommentsNotFound {
                        ids: vec![id.clone()],
                    })
                    .map_err(AppUseCaseError::from)
            })
            .collect()
    }
}

fn snapshot_comment(
    comment: crate::domain::comment::Comment,
    source: &UserReviewSourceDocument,
) -> Result<UserReviewComment, AppUseCaseError> {
    let resolution = resolve_comment_anchor(comment, source.blocks());
    let comment = resolution.comment();
    let block = resolution
        .target()
        .map(|target| target.block())
        .ok_or_else(|| UserReviewUseCaseError::UnresolvedCommentAnchor {
            id: comment.id().clone(),
        })?;
    let range =
        block
            .source_range()
            .ok_or_else(|| UserReviewUseCaseError::MissingBlockSourceRange {
                id: comment.id().clone(),
            })?;
    let line_start = line_number_at_offset(source.contents(), range.start_byte_offset())
        .ok_or_else(|| UserReviewUseCaseError::InvalidBlockSourceRange {
            id: comment.id().clone(),
        })?;
    let final_byte = range.end_byte_offset().saturating_sub(1);
    let line_end = line_number_at_offset(source.contents(), final_byte).ok_or_else(|| {
        UserReviewUseCaseError::InvalidBlockSourceRange {
            id: comment.id().clone(),
        }
    })?;

    UserReviewComment::new(
        comment.id().clone(),
        comment.status(),
        UserReviewSource::new(
            source.spec_id().clone(),
            source.file_key(),
            source.file_path().clone(),
        ),
        block.block_type(),
        PositiveLineNumber::new(line_start).map_err(UserReviewUseCaseError::Domain)?,
        PositiveLineNumber::new(line_end).map_err(UserReviewUseCaseError::Domain)?,
        comment.anchor().text_snippet().clone(),
        block.text_hash().clone(),
        comment.body().clone(),
        comment.created_at(),
        comment.updated_at(),
    )
    .map_err(|source| UserReviewUseCaseError::Domain(source).into())
}

fn line_number_at_offset(contents: &str, offset: usize) -> Option<u32> {
    if offset >= contents.len() {
        return None;
    }

    let line = contents.as_bytes()[..offset]
        .iter()
        .filter(|byte| **byte == b'\n')
        .count()
        .checked_add(1)?;

    u32::try_from(line).ok()
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum UserReviewUseCaseError {
    #[error("user review requires at least one selected comment")]
    MissingCommentSelection,
    #[error("user review target has no source files: {spec_id}")]
    MissingTargetSources { spec_id: SpecId },
    #[error("selected open comments were not found in the review target: {ids:?}")]
    SelectedCommentsNotFound { ids: Vec<CommentId> },
    #[error("comment ID is ambiguous across review target files: {id}")]
    AmbiguousCommentId { id: CommentId },
    #[error("comment anchor could not be resolved to a current Markdown block: {id}")]
    UnresolvedCommentAnchor { id: CommentId },
    #[error("resolved Markdown block has no source range: {id}")]
    MissingBlockSourceRange { id: CommentId },
    #[error("resolved Markdown block has an invalid source range: {id}")]
    InvalidBlockSourceRange { id: CommentId },
    #[error("source Markdown file is missing: {path}")]
    SourceFileMissing { path: String },
    #[error("source file is outside the workspace: {path}")]
    SourceOutsideWorkspace { path: String },
    #[error("source path is not a valid workspace-relative path: {path}: {message}")]
    InvalidSourcePath { path: String, message: String },
    #[error("user-review source must be Markdown: {path}")]
    UnsupportedSourceFormat { path: String },
    #[error("unknown user-review target spec: {spec_id}")]
    UnknownTargetSpec { spec_id: SpecId },
    #[error("user review ID collided after {attempts} create attempts")]
    CreateIdCollision { attempts: usize },
    #[error(transparent)]
    Domain(UserReviewDomainError),
    #[error(transparent)]
    Repository(UserReviewRepositoryError),
}

impl From<UserReviewUseCaseError> for AppUseCaseError {
    fn from(source: UserReviewUseCaseError) -> Self {
        Self::UserReview { source }
    }
}

pub struct FilesystemUserReviewSourceLoader<'a> {
    use_cases: &'a FilesystemAppUseCases,
    workspace: &'a LoadWorkspaceResult,
}

impl LoadUserReviewSources for FilesystemUserReviewSourceLoader<'_> {
    fn load_user_review_sources(
        &self,
        target: &UserReviewTarget,
    ) -> Result<Vec<UserReviewSourceDocument>, AppUseCaseError> {
        let file_keys = match target {
            UserReviewTarget::File { file_key, .. } => vec![*file_key],
            UserReviewTarget::Spec { spec_id } => {
                let specs = self.use_cases.list_specs(self.workspace)?.into_specs();
                let spec = find_spec_node(&specs, spec_id).ok_or_else(|| {
                    UserReviewUseCaseError::UnknownTargetSpec {
                        spec_id: spec_id.clone(),
                    }
                })?;

                spec.files()
                    .iter()
                    .filter(|file| {
                        !file.is_missing() && file.format() == SpecDocumentFormat::Markdown
                    })
                    .map(|file| file.key())
                    .collect()
            }
        };

        file_keys
            .into_iter()
            .map(|file_key| self.load_source(target.spec_id(), file_key))
            .collect()
    }
}

impl FilesystemUserReviewSourceLoader<'_> {
    fn load_source(
        &self,
        spec_id: &SpecId,
        file_key: SpecFileKey,
    ) -> Result<UserReviewSourceDocument, AppUseCaseError> {
        let document =
            match self
                .use_cases
                .read_spec_file(self.workspace, spec_id.as_str(), file_key)?
            {
                ReadSpecFileResult::Found(document) => document,
                ReadSpecFileResult::Missing(missing) => {
                    return Err(UserReviewUseCaseError::SourceFileMissing {
                        path: missing.path().to_string(),
                    }
                    .into());
                }
            };
        if document.format() != SpecDocumentFormat::Markdown {
            return Err(UserReviewUseCaseError::UnsupportedSourceFormat {
                path: document.path().to_string(),
            }
            .into());
        }
        let relative = Path::new(document.path())
            .strip_prefix(Path::new(self.workspace.layout().root().as_str()))
            .map_err(|_| UserReviewUseCaseError::SourceOutsideWorkspace {
                path: document.path().to_string(),
            })?;
        let path = slash_separated_relative_path(relative).ok_or_else(|| {
            UserReviewUseCaseError::InvalidSourcePath {
                path: relative.to_string_lossy().into_owned(),
                message: "path contains a non-normal or non-UTF-8 component".to_string(),
            }
        })?;
        let file_path = WorkspaceRelativePath::new(&path).map_err(|source| {
            UserReviewUseCaseError::InvalidSourcePath {
                path,
                message: source.to_string(),
            }
        })?;

        Ok(UserReviewSourceDocument::new(
            spec_id.clone(),
            file_key,
            file_path,
            document.contents(),
            document.blocks().to_vec(),
        ))
    }
}

impl FilesystemAppUseCases {
    pub fn user_review_use_cases<'a>(
        &'a self,
        workspace: &'a LoadWorkspaceResult,
        target: &UserReviewTarget,
    ) -> Result<FilesystemUserReviewUseCases<'a>, AppUseCaseError> {
        let config = spec_config_for_directory(
            &self.config_loader,
            workspace.layout(),
            workspace.config(),
            target.spec_id().as_str(),
        )?;

        Ok(UserReviewUseCases::new(
            JsonUserReviewRepository::new(workspace.layout().clone(), config),
            JsonCommentRepository::new(workspace.layout().clone()),
            FilesystemUserReviewSourceLoader {
                use_cases: self,
                workspace,
            },
            UuidUserReviewIdGenerator,
            UtcCommentClock,
        ))
    }
}

fn find_spec_node<'a>(specs: &'a [SpecNode], spec_id: &SpecId) -> Option<&'a SpecNode> {
    specs.iter().find_map(|spec| {
        if spec.id() == spec_id {
            return Some(spec);
        }

        find_spec_node(spec.children(), spec_id)
    })
}

fn slash_separated_relative_path(path: &Path) -> Option<String> {
    let components = path
        .components()
        .map(|component| match component {
            Component::Normal(segment) => segment.to_str(),
            _ => None,
        })
        .collect::<Option<Vec<_>>>()?;

    if components.is_empty() {
        return None;
    }

    Some(components.join("/"))
}

#[cfg(test)]
mod tests {
    use super::line_number_at_offset;

    #[test]
    fn line_lookup_counts_newlines_at_utf8_continuation_byte_offsets() {
        let contents = "第一行\n第二行";

        assert_eq!(Some(2), line_number_at_offset(contents, contents.len() - 1));
    }

    #[test]
    fn line_lookup_rejects_the_exclusive_end_of_the_document() {
        let contents = "one line";

        assert_eq!(None, line_number_at_offset(contents, contents.len()));
    }
}
