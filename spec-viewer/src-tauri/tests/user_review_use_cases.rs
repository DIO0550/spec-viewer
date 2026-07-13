use std::{
    collections::VecDeque,
    sync::{Arc, Mutex},
};

use chrono::{DateTime, Utc};
use spec_reviewer_lib::{
    app::{
        services::user_review_id::GenerateUserReviewId,
        use_cases::{
            AppUseCaseError, ArchiveUserReviewInput, CreateUserReviewInput, GetCurrentTime,
            ListUserReviewsInput, LoadUserReviewSources, UserReviewSourceDocument,
            UserReviewUseCaseError, UserReviewUseCases,
        },
    },
    domain::{
        comment::{
            BlockIndex, BlockType, CharRange, Comment, CommentAnchor, CommentBody, CommentId,
            CommentListQuery, CommentRepository, CommentRepositoryError, CommentStatus, TextHash,
            TextSnippet,
        },
        spec::{
            MarkdownBlock, MarkdownBlockHash, MarkdownBlockIndex, MarkdownBlockSourceRange,
            MarkdownBlockText, MarkdownBlockType, SpecFileKey, SpecId,
        },
        user_review::{
            UserReview, UserReviewArchiveOutcome, UserReviewCreateOutcome, UserReviewId,
            UserReviewListOutcome, UserReviewRecordLocator, UserReviewRecordProblem,
            UserReviewRecordProblemKind, UserReviewRepository, UserReviewRepositoryError,
            UserReviewTarget,
        },
        workspace::WorkspaceRelativePath,
    },
};

#[derive(Clone)]
struct FakeCommentRepository {
    comments: Vec<Comment>,
}

impl CommentRepository for FakeCommentRepository {
    fn list(&self, query: &CommentListQuery) -> Result<Vec<Comment>, CommentRepositoryError> {
        Ok(self
            .comments
            .iter()
            .filter(|comment| query.includes(comment))
            .cloned()
            .collect())
    }

    fn add(
        &self,
        _scope: &spec_reviewer_lib::domain::comment::CommentScope,
        _comment: Comment,
    ) -> Result<Comment, CommentRepositoryError> {
        unreachable!("create user-review only lists comments")
    }

    fn update(
        &self,
        _scope: &spec_reviewer_lib::domain::comment::CommentScope,
        _comment: Comment,
    ) -> Result<Comment, CommentRepositoryError> {
        unreachable!("create user-review only lists comments")
    }

    fn delete(
        &self,
        _scope: &spec_reviewer_lib::domain::comment::CommentScope,
        _id: &CommentId,
    ) -> Result<(), CommentRepositoryError> {
        unreachable!("create user-review only lists comments")
    }
}

#[derive(Clone)]
struct FakeSourceLoader {
    documents: Vec<UserReviewSourceDocument>,
}

impl LoadUserReviewSources for FakeSourceLoader {
    fn load_user_review_sources(
        &self,
        _target: &UserReviewTarget,
    ) -> Result<Vec<UserReviewSourceDocument>, AppUseCaseError> {
        Ok(self.documents.clone())
    }
}

#[derive(Clone)]
struct SequenceIdGenerator {
    ids: Arc<Mutex<VecDeque<UserReviewId>>>,
}

impl SequenceIdGenerator {
    fn new(ids: impl IntoIterator<Item = UserReviewId>) -> Self {
        Self {
            ids: Arc::new(Mutex::new(ids.into_iter().collect())),
        }
    }
}

impl GenerateUserReviewId for SequenceIdGenerator {
    fn generate_user_review_id(
        &self,
    ) -> Result<UserReviewId, spec_reviewer_lib::domain::user_review::UserReviewDomainError> {
        Ok(self
            .ids
            .lock()
            .expect("ID queue should not be poisoned")
            .pop_front()
            .expect("test should provide enough IDs"))
    }
}

#[derive(Clone, Copy)]
struct FixedClock(DateTime<Utc>);

impl GetCurrentTime for FixedClock {
    fn now(&self) -> DateTime<Utc> {
        self.0
    }
}

#[derive(Default)]
struct RepositoryState {
    create_collisions_remaining: usize,
    create_calls: Vec<UserReviewId>,
    archive_calls: Vec<UserReviewId>,
    list_outcome: Option<UserReviewListOutcome>,
    archive_problems: Vec<UserReviewRecordProblem>,
}

#[derive(Clone, Default)]
struct FakeUserReviewRepository {
    state: Arc<Mutex<RepositoryState>>,
}

impl FakeUserReviewRepository {
    fn with_create_collisions(collisions: usize) -> Self {
        let repository = Self::default();
        repository
            .state
            .lock()
            .expect("repository state should not be poisoned")
            .create_collisions_remaining = collisions;
        repository
    }

    fn with_list_outcome(outcome: UserReviewListOutcome) -> Self {
        let repository = Self::default();
        repository
            .state
            .lock()
            .expect("repository state should not be poisoned")
            .list_outcome = Some(outcome);
        repository
    }

    fn set_archive_problems(&self, problems: Vec<UserReviewRecordProblem>) {
        self.state
            .lock()
            .expect("repository state should not be poisoned")
            .archive_problems = problems;
    }
}

impl UserReviewRepository for FakeUserReviewRepository {
    fn create(
        &self,
        review: UserReview,
    ) -> Result<UserReviewCreateOutcome, UserReviewRepositoryError> {
        let mut state = self
            .state
            .lock()
            .expect("repository state should not be poisoned");
        state.create_calls.push(review.id().clone());

        if state.create_collisions_remaining > 0 {
            state.create_collisions_remaining -= 1;
            return Err(UserReviewRepositoryError::AlreadyExists {
                id: review.id().clone(),
            });
        }

        Ok(UserReviewCreateOutcome::new(review))
    }

    fn list(
        &self,
        _target: &UserReviewTarget,
    ) -> Result<UserReviewListOutcome, UserReviewRepositoryError> {
        Ok(self
            .state
            .lock()
            .expect("repository state should not be poisoned")
            .list_outcome
            .clone()
            .unwrap_or_else(|| UserReviewListOutcome::new(Vec::new(), Vec::new(), Vec::new())))
    }

    fn archive(
        &self,
        id: &UserReviewId,
        target: &UserReviewTarget,
        archived_at: DateTime<Utc>,
    ) -> Result<UserReviewArchiveOutcome, UserReviewRepositoryError> {
        let mut state = self
            .state
            .lock()
            .expect("repository state should not be poisoned");
        state.archive_calls.push(id.clone());
        let listed = state
            .list_outcome
            .as_ref()
            .and_then(|outcome| {
                outcome
                    .active()
                    .iter()
                    .chain(outcome.archived())
                    .find(|review| review.id() == id)
            })
            .cloned()
            .ok_or_else(|| UserReviewRepositoryError::NotFound { id: id.clone() })?;
        let mut archived = listed;
        archived
            .archive(id, target, archived_at)
            .map_err(|_| UserReviewRepositoryError::InvalidState { id: id.clone() })?;

        Ok(UserReviewArchiveOutcome::new(
            archived,
            state.archive_problems.clone(),
        ))
    }
}

fn timestamp(minute: u32) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(&format!("2026-05-06T12:{minute:02}:00.000Z"))
        .expect("timestamp should parse")
        .with_timezone(&Utc)
}

fn review_id(value: u128) -> UserReviewId {
    UserReviewId::new(format!("urv_{value:032x}")).expect("review ID should be valid")
}

fn target() -> UserReviewTarget {
    UserReviewTarget::file(
        SpecId::new("001-auth-flow").expect("spec ID should be valid"),
        SpecFileKey::Tasks,
    )
}

fn source_document() -> UserReviewSourceDocument {
    let contents =
        "# Tasks\n\nIntro.\n\nTarget first line.\nTarget second line.\n\nAnother target.\n";
    let first_start = contents
        .find("Target first")
        .expect("fixture should contain first target");
    let first_end = contents
        .find("\n\nAnother")
        .expect("fixture should contain block separator")
        + 1;
    let second_start = contents
        .find("Another target")
        .expect("fixture should contain second target");
    let first_block = MarkdownBlock::new(
        MarkdownBlockType::Paragraph,
        MarkdownBlockIndex::new(2),
        MarkdownBlockText::new(
            "Target first line.\nTarget second line.",
            "Target first line. Target second line.",
        )
        .expect("block text should be valid"),
        MarkdownBlockHash::new("sha256:d4b1ea57").expect("hash should be valid"),
        Some(MarkdownBlockSourceRange::new(first_start, first_end).expect("range should be valid")),
    );
    let second_block = MarkdownBlock::new(
        MarkdownBlockType::Paragraph,
        MarkdownBlockIndex::new(3),
        MarkdownBlockText::new("Another target.", "Another target.")
            .expect("block text should be valid"),
        MarkdownBlockHash::new("sha256:aaaaaaaa").expect("hash should be valid"),
        Some(
            MarkdownBlockSourceRange::new(second_start, contents.len())
                .expect("range should be valid"),
        ),
    );

    UserReviewSourceDocument::new(
        target().spec_id().clone(),
        SpecFileKey::Tasks,
        WorkspaceRelativePath::new(".plugin-workspace/.specs/001-auth-flow/tasks.md")
            .expect("source path should be valid"),
        contents,
        vec![first_block, second_block],
    )
}

fn comment(id: &str, status: CommentStatus) -> Comment {
    comment_at(id, status, 2, "sha256:d4b1ea57", "Target first line")
}

fn comment_at(
    id: &str,
    status: CommentStatus,
    block_index: usize,
    text_hash: &str,
    text_snippet: &str,
) -> Comment {
    Comment::restore(
        CommentId::new(id).expect("comment ID should be valid"),
        CommentAnchor::new(
            SpecFileKey::Tasks,
            BlockType::Paragraph,
            BlockIndex::new(block_index),
            TextHash::new(text_hash).expect("hash should be valid"),
            TextSnippet::new(text_snippet).expect("snippet should be valid"),
            CharRange::new(0, 17).expect("range should be valid"),
        ),
        CommentBody::new(format!("Instruction for {id}")).expect("body should be valid"),
        status,
        timestamp(39),
        timestamp(39),
    )
    .expect("comment should be valid")
}

fn use_cases(
    repository: FakeUserReviewRepository,
    comments: Vec<Comment>,
    ids: impl IntoIterator<Item = UserReviewId>,
    now: DateTime<Utc>,
) -> UserReviewUseCases<
    FakeUserReviewRepository,
    FakeCommentRepository,
    FakeSourceLoader,
    SequenceIdGenerator,
    FixedClock,
> {
    use_cases_with_documents(repository, comments, vec![source_document()], ids, now)
}

fn use_cases_with_documents(
    repository: FakeUserReviewRepository,
    comments: Vec<Comment>,
    documents: Vec<UserReviewSourceDocument>,
    ids: impl IntoIterator<Item = UserReviewId>,
    now: DateTime<Utc>,
) -> UserReviewUseCases<
    FakeUserReviewRepository,
    FakeCommentRepository,
    FakeSourceLoader,
    SequenceIdGenerator,
    FixedClock,
> {
    UserReviewUseCases::new(
        repository,
        FakeCommentRepository { comments },
        FakeSourceLoader { documents },
        SequenceIdGenerator::new(ids),
        FixedClock(now),
    )
}

fn source_document_with_empty_block_range() -> UserReviewSourceDocument {
    let contents = "Prelude\nEmpty anchor.\n";
    let offset = contents
        .find("Empty anchor")
        .expect("fixture should contain the target block");
    let block = MarkdownBlock::new(
        MarkdownBlockType::Paragraph,
        MarkdownBlockIndex::new(2),
        MarkdownBlockText::new("Empty anchor.", "Empty anchor.")
            .expect("block text should be valid"),
        MarkdownBlockHash::new("sha256:empty-range").expect("hash should be valid"),
        Some(
            MarkdownBlockSourceRange::new(offset, offset)
                .expect("empty source range is valid at the spec boundary"),
        ),
    );

    UserReviewSourceDocument::new(
        target().spec_id().clone(),
        SpecFileKey::Tasks,
        WorkspaceRelativePath::new(".plugin-workspace/.specs/001-auth-flow/tasks.md")
            .expect("source path should be valid"),
        contents,
        vec![block],
    )
}

fn active_review(id: UserReviewId) -> UserReview {
    let repository = FakeUserReviewRepository::default();
    use_cases(
        repository,
        vec![comment("cmt_active", CommentStatus::Open)],
        [id],
        timestamp(40),
    )
    .create_user_review(CreateUserReviewInput::new(
        target(),
        vec![CommentId::new("cmt_active").expect("comment ID should be valid")],
    ))
    .expect("review fixture should be created")
    .into_user_review()
}

fn recoverable_problem() -> UserReviewRecordProblem {
    UserReviewRecordProblem::new(
        UserReviewRecordLocator::new(format!("{}.json", review_id(90)))
            .expect("locator should be valid"),
        UserReviewRecordProblemKind::RecoverableDuplicate,
    )
}

#[test]
fn create_snapshots_selected_open_comments_in_request_order_with_resolved_source_hints() {
    let repository = FakeUserReviewRepository::default();
    let service = use_cases(
        repository,
        vec![
            comment_at(
                "cmt_second",
                CommentStatus::Open,
                3,
                "sha256:aaaaaaaa",
                "Another target",
            ),
            comment("cmt_first", CommentStatus::Open),
        ],
        [review_id(1)],
        timestamp(40),
    );

    let created = service
        .create_user_review(CreateUserReviewInput::new(
            target(),
            vec![
                CommentId::new("cmt_first").expect("comment ID should be valid"),
                CommentId::new("cmt_second").expect("comment ID should be valid"),
            ],
        ))
        .expect("review should be created");
    let review = created.user_review();

    assert_eq!(review_id(1), *review.id());
    assert_eq!(timestamp(40), review.created_at());
    assert_eq!(2, review.comments().len());
    assert_eq!("cmt_first", review.comments()[0].id().as_str());
    assert_eq!("cmt_second", review.comments()[1].id().as_str());
    assert_eq!(5, review.comments()[0].line_start().value());
    assert_eq!(6, review.comments()[0].line_end().value());
    assert_eq!(
        ".plugin-workspace/.specs/001-auth-flow/tasks.md",
        review.comments()[0].source().file_path().as_str()
    );
    assert_eq!("sha256:d4b1ea57", review.comments()[0].text_hash().as_str());
    assert_eq!(
        "Target first line",
        review.comments()[0].text_snippet().as_str()
    );
}

#[test]
fn create_retries_repository_id_collisions_with_fresh_ids() {
    let repository = FakeUserReviewRepository::with_create_collisions(2);
    let state = Arc::clone(&repository.state);
    let service = use_cases(
        repository,
        vec![comment("cmt_retry", CommentStatus::Open)],
        [review_id(1), review_id(2), review_id(3)],
        timestamp(40),
    );

    let created = service
        .create_user_review(CreateUserReviewInput::new(
            target(),
            vec![CommentId::new("cmt_retry").expect("comment ID should be valid")],
        ))
        .expect("third ID should be published");

    assert_eq!(review_id(3), *created.user_review().id());
    assert_eq!(
        vec![review_id(1), review_id(2), review_id(3)],
        state
            .lock()
            .expect("repository state should not be poisoned")
            .create_calls
    );
}

#[test]
fn create_returns_typed_collision_after_three_failed_attempts() {
    let repository = FakeUserReviewRepository::with_create_collisions(3);
    let service = use_cases(
        repository,
        vec![comment("cmt_collision", CommentStatus::Open)],
        [review_id(1), review_id(2), review_id(3)],
        timestamp(40),
    );

    let result = service.create_user_review(CreateUserReviewInput::new(
        target(),
        vec![CommentId::new("cmt_collision").expect("comment ID should be valid")],
    ));

    assert_eq!(
        Err(AppUseCaseError::UserReview {
            source: UserReviewUseCaseError::CreateIdCollision { attempts: 3 },
        }),
        result
    );
}

#[test]
fn create_rejects_resolved_or_missing_selected_comments_as_typed_input_error() {
    let repository = FakeUserReviewRepository::default();
    let service = use_cases(
        repository,
        vec![comment("cmt_resolved", CommentStatus::Resolved)],
        [review_id(1)],
        timestamp(40),
    );

    let result = service.create_user_review(CreateUserReviewInput::new(
        target(),
        vec![CommentId::new("cmt_resolved").expect("comment ID should be valid")],
    ));

    assert!(matches!(
        result,
        Err(AppUseCaseError::UserReview {
            source: UserReviewUseCaseError::SelectedCommentsNotFound { .. },
        })
    ));
}

#[test]
fn create_rejects_empty_block_source_range_as_typed_source_error() {
    let selected_id = CommentId::new("cmt_empty_range").expect("comment ID should be valid");
    let service = use_cases_with_documents(
        FakeUserReviewRepository::default(),
        vec![comment_at(
            selected_id.as_str(),
            CommentStatus::Open,
            2,
            "sha256:empty-range",
            "Empty anchor",
        )],
        vec![source_document_with_empty_block_range()],
        [review_id(1)],
        timestamp(40),
    );

    let result = service.create_user_review(CreateUserReviewInput::new(
        target(),
        vec![selected_id.clone()],
    ));

    assert_eq!(
        Err(AppUseCaseError::UserReview {
            source: UserReviewUseCaseError::InvalidBlockSourceRange { id: selected_id },
        }),
        result
    );
}

#[test]
fn list_preserves_partial_recovery_problems_from_repository() {
    let problem = recoverable_problem();
    let active = active_review(review_id(90));
    let repository = FakeUserReviewRepository::with_list_outcome(UserReviewListOutcome::new(
        vec![active.clone()],
        Vec::new(),
        vec![problem.clone()],
    ));
    let service = use_cases(repository, Vec::new(), [], timestamp(40));

    let listed = service
        .list_user_reviews(ListUserReviewsInput::new(target()))
        .expect("list should succeed");

    assert_eq!(vec![active], listed.active());
    assert_eq!(vec![problem], listed.problems());
}

#[test]
fn archive_validates_domain_transition_before_durable_repository_call() {
    let active = active_review(review_id(91));
    let repository = FakeUserReviewRepository::with_list_outcome(UserReviewListOutcome::new(
        vec![active.clone()],
        Vec::new(),
        Vec::new(),
    ));
    let state = Arc::clone(&repository.state);
    let service = use_cases(repository, Vec::new(), [], timestamp(39));

    let result =
        service.archive_user_review(ArchiveUserReviewInput::new(target(), active.id().clone()));

    assert!(matches!(
        result,
        Err(AppUseCaseError::UserReview {
            source: UserReviewUseCaseError::Domain(_),
        })
    ));
    assert!(state
        .lock()
        .expect("repository state should not be poisoned")
        .archive_calls
        .is_empty());
}

#[test]
fn archive_returns_durable_repository_result_and_partial_recovery_problems() {
    let active = active_review(review_id(92));
    let problem = recoverable_problem();
    let repository = FakeUserReviewRepository::with_list_outcome(UserReviewListOutcome::new(
        vec![active.clone()],
        Vec::new(),
        Vec::new(),
    ));
    repository.set_archive_problems(vec![problem.clone()]);
    let service = use_cases(repository, Vec::new(), [], timestamp(41));

    let archived = service
        .archive_user_review(ArchiveUserReviewInput::new(target(), active.id().clone()))
        .expect("archive should succeed");

    assert!(archived.user_review().status().is_archived());
    assert_eq!(Some(timestamp(41)), archived.user_review().archived_at());
    assert_eq!(vec![problem], archived.problems());
}
