//! Anchor re-resolution use case for listed comments.

use crate::{
    app::use_cases::AppUseCaseError,
    domain::{
        comment::{CommentAnchorResolution, CommentRepository, CommentStatusFilter},
        spec::{MarkdownBlock, SpecFileKey},
    },
};

use super::{CommentUseCases, GenerateCommentId, GetCurrentTime};

impl<Repository, IdGenerator, Clock> CommentUseCases<Repository, IdGenerator, Clock>
where
    Repository: CommentRepository,
    IdGenerator: GenerateCommentId,
    Clock: GetCurrentTime,
{
    pub fn resolve_comment_anchors(
        &self,
        spec_id: &str,
        file_key: SpecFileKey,
        status_filter: CommentStatusFilter,
        current_blocks: &[MarkdownBlock],
    ) -> Result<ResolveCommentAnchorsResult, AppUseCaseError> {
        let comments = self.list_comments(spec_id, file_key, status_filter)?;
        let resolutions = comments
            .into_iter()
            .map(|comment| CommentAnchorResolution::resolve(comment, current_blocks))
            .collect();

        Ok(ResolveCommentAnchorsResult::new(resolutions))
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolveCommentAnchorsResult {
    resolutions: Vec<CommentAnchorResolution>,
}

impl ResolveCommentAnchorsResult {
    pub fn new(resolutions: Vec<CommentAnchorResolution>) -> Self {
        Self { resolutions }
    }

    pub fn resolutions(&self) -> &[CommentAnchorResolution] {
        &self.resolutions
    }

    pub fn into_resolutions(self) -> Vec<CommentAnchorResolution> {
        self.resolutions
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{
        anchor, anchor_with, comment_with_anchor, markdown_block, timestamp, use_cases,
        FailingCommentRepository, FakeClock, FakeCommentRepository, FakeIdGenerator,
    };
    use super::*;
    use crate::domain::comment::{
        AnchorResolutionReason, AnchorResolutionStatus, BlockType, CommentId,
    };
    use crate::domain::spec::MarkdownBlockType;

    const FUZZY_MATCH_THRESHOLD: u8 = CommentAnchorResolution::FUZZY_MATCH_THRESHOLD;
    const EXACT_MATCH_SCORE: u8 = CommentAnchorResolution::EXACT_MATCH_SCORE;

    #[test]
    fn resolve_comment_anchors_returns_exact_match_when_index_type_and_hash_match() {
        let repository = FakeCommentRepository::default();
        repository
            .comments
            .borrow_mut()
            .push(comment_with_anchor("cmt_exact", anchor(SpecFileKey::Impl)));
        let use_cases = use_cases(repository);
        let blocks = [markdown_block(
            MarkdownBlockType::Paragraph,
            2,
            "selected text",
            "selected text",
            "sha256_prefix_8chars",
        )];

        let result = use_cases
            .resolve_comment_anchors(
                "auth-flow",
                SpecFileKey::Impl,
                CommentStatusFilter::All,
                &blocks,
            )
            .expect("anchors should resolve");

        let resolution = &result.resolutions()[0];
        assert_eq!(AnchorResolutionStatus::Resolved, resolution.status());
        assert_eq!(AnchorResolutionReason::ExactMatch, resolution.reason());
        assert_eq!(None, resolution.details());
        assert_eq!(
            2,
            resolution
                .target()
                .expect("target should exist")
                .block()
                .index()
                .value()
        );
        assert_eq!(
            "sha256_prefix_8chars",
            resolution.original_anchor().text_hash().as_str()
        );
    }

    #[test]
    fn resolve_comment_anchors_falls_back_to_document_hash_for_moved_block() {
        let repository = FakeCommentRepository::default();
        repository
            .comments
            .borrow_mut()
            .push(comment_with_anchor("cmt_moved", anchor(SpecFileKey::Impl)));
        let use_cases = use_cases(repository);
        let blocks = [
            markdown_block(
                MarkdownBlockType::Paragraph,
                0,
                "selected text",
                "selected text",
                "sha256_prefix_8chars",
            ),
            markdown_block(
                MarkdownBlockType::Paragraph,
                2,
                "replacement",
                "replacement",
                "sha256_replacement",
            ),
        ];

        let result = use_cases
            .resolve_comment_anchors(
                "auth-flow",
                SpecFileKey::Impl,
                CommentStatusFilter::All,
                &blocks,
            )
            .expect("anchors should resolve");

        let resolution = &result.resolutions()[0];
        assert_eq!(AnchorResolutionStatus::Moved, resolution.status());
        assert_eq!(AnchorResolutionReason::MovedByHash, resolution.reason());
        assert_eq!(
            0,
            resolution
                .target()
                .expect("target should exist")
                .block()
                .index()
                .value()
        );
    }

    #[test]
    fn resolve_comment_anchors_orphans_deleted_text_when_original_block_changed() {
        let repository = FakeCommentRepository::default();
        repository.comments.borrow_mut().push(comment_with_anchor(
            "cmt_deleted",
            anchor(SpecFileKey::Impl),
        ));
        let use_cases = use_cases(repository);
        let blocks = [markdown_block(
            MarkdownBlockType::Paragraph,
            2,
            "different block text after deletion",
            "different block text after deletion",
            "sha256_different",
        )];

        let result = use_cases
            .resolve_comment_anchors(
                "auth-flow",
                SpecFileKey::Impl,
                CommentStatusFilter::All,
                &blocks,
            )
            .expect("anchors should resolve");

        let resolution = &result.resolutions()[0];
        assert_eq!(AnchorResolutionStatus::Orphaned, resolution.status());
        assert_eq!(AnchorResolutionReason::DeletedText, resolution.reason());
        assert!(resolution.is_orphaned());
        assert!(resolution.target().is_none());
        assert!(resolution
            .details()
            .expect("details should explain orphaning")
            .contains("original block is still present"));
    }

    #[test]
    fn resolve_comment_anchors_orphans_deleted_text_when_snippet_exists_elsewhere() {
        let repository = FakeCommentRepository::default();
        repository.comments.borrow_mut().push(comment_with_anchor(
            "cmt_deleted_elsewhere",
            anchor(SpecFileKey::Impl),
        ));
        let use_cases = use_cases(repository);
        let blocks = [
            markdown_block(
                MarkdownBlockType::Paragraph,
                2,
                "different block text after deletion",
                "different block text after deletion",
                "sha256_different",
            ),
            markdown_block(
                MarkdownBlockType::Paragraph,
                7,
                "selected text",
                "selected text",
                "sha256_elsewhere",
            ),
        ];

        let result = use_cases
            .resolve_comment_anchors(
                "auth-flow",
                SpecFileKey::Impl,
                CommentStatusFilter::All,
                &blocks,
            )
            .expect("anchors should resolve");

        let resolution = &result.resolutions()[0];
        assert_eq!(AnchorResolutionStatus::Orphaned, resolution.status());
        assert_eq!(AnchorResolutionReason::DeletedText, resolution.reason());
        assert!(resolution.target().is_none());
    }

    #[test]
    fn resolve_comment_anchors_marks_stale_when_snippet_matches_after_hash_mismatch() {
        let repository = FakeCommentRepository::default();
        repository
            .comments
            .borrow_mut()
            .push(comment_with_anchor("cmt_stale", anchor(SpecFileKey::Impl)));
        let use_cases = use_cases(repository);
        let blocks = [markdown_block(
            MarkdownBlockType::Paragraph,
            3,
            "selected text with edits",
            "selected text with edits",
            "sha256_changed",
        )];

        let result = use_cases
            .resolve_comment_anchors(
                "auth-flow",
                SpecFileKey::Impl,
                CommentStatusFilter::All,
                &blocks,
            )
            .expect("anchors should resolve");

        let resolution = &result.resolutions()[0];
        assert_eq!(AnchorResolutionStatus::Moved, resolution.status());
        assert_eq!(AnchorResolutionReason::StaleSnippet, resolution.reason());
        assert_eq!(
            3,
            resolution
                .target()
                .expect("target should exist")
                .block()
                .index()
                .value()
        );
    }

    #[test]
    fn resolve_comment_anchors_marks_fuzzy_for_snippet_typo() {
        let repository = FakeCommentRepository::default();
        repository
            .comments
            .borrow_mut()
            .push(comment_with_anchor("cmt_typo", anchor(SpecFileKey::Impl)));
        let use_cases = use_cases(repository);
        let blocks = [markdown_block(
            MarkdownBlockType::Paragraph,
            4,
            "selected tezt",
            "selected tezt",
            "sha256_typo",
        )];

        let result = use_cases
            .resolve_comment_anchors(
                "auth-flow",
                SpecFileKey::Impl,
                CommentStatusFilter::All,
                &blocks,
            )
            .expect("anchors should resolve");

        let resolution = &result.resolutions()[0];
        let target = resolution.target().expect("target should exist");
        assert_eq!(AnchorResolutionStatus::Fuzzy, resolution.status());
        assert_eq!(AnchorResolutionReason::FuzzyMatch, resolution.reason());
        assert_eq!(4, target.block().index().value());
        assert!(target.score() >= FUZZY_MATCH_THRESHOLD);
        assert!(target.score() < EXACT_MATCH_SCORE);
    }

    #[test]
    fn resolve_comment_anchors_marks_fuzzy_for_moved_reworded_block() {
        let repository = FakeCommentRepository::default();
        repository.comments.borrow_mut().push(comment_with_anchor(
            "cmt_reworded",
            anchor_with(
                SpecFileKey::Impl,
                BlockType::Paragraph,
                2,
                "sha256_old",
                "review payment failure handling",
            ),
        ));
        let use_cases = use_cases(repository);
        let blocks = [markdown_block(
            MarkdownBlockType::Paragraph,
            7,
            "Review payment error handling",
            "Review payment error handling",
            "sha256_reworded",
        )];

        let result = use_cases
            .resolve_comment_anchors(
                "auth-flow",
                SpecFileKey::Impl,
                CommentStatusFilter::All,
                &blocks,
            )
            .expect("anchors should resolve");

        let resolution = &result.resolutions()[0];
        let target = resolution.target().expect("target should exist");
        assert_eq!(AnchorResolutionStatus::Fuzzy, resolution.status());
        assert_eq!(AnchorResolutionReason::FuzzyMatch, resolution.reason());
        assert_eq!(7, target.block().index().value());
        assert!(target.score() >= FUZZY_MATCH_THRESHOLD);
    }

    #[test]
    fn resolve_comment_anchors_orphans_when_fuzzy_score_is_below_threshold() {
        let repository = FakeCommentRepository::default();
        repository.comments.borrow_mut().push(comment_with_anchor(
            "cmt_low_score",
            anchor_with(
                SpecFileKey::Impl,
                BlockType::Paragraph,
                2,
                "sha256_old",
                "review payment failure handling",
            ),
        ));
        let use_cases = use_cases(repository);
        let blocks = [markdown_block(
            MarkdownBlockType::Paragraph,
            8,
            "Release checklist and deployment notes",
            "Release checklist and deployment notes",
            "sha256_unrelated",
        )];

        let result = use_cases
            .resolve_comment_anchors(
                "auth-flow",
                SpecFileKey::Impl,
                CommentStatusFilter::All,
                &blocks,
            )
            .expect("anchors should resolve");

        let resolution = &result.resolutions()[0];
        assert_eq!(AnchorResolutionStatus::Orphaned, resolution.status());
        assert_eq!(AnchorResolutionReason::BelowThreshold, resolution.reason());
        assert!(resolution
            .details()
            .expect("details should include score")
            .contains("below threshold"));
        assert!(resolution.target().is_none());
    }

    #[test]
    fn resolve_comment_anchors_uses_nearest_index_as_fuzzy_tie_breaker() {
        let repository = FakeCommentRepository::default();
        repository.comments.borrow_mut().push(comment_with_anchor(
            "cmt_tie_breaker",
            anchor(SpecFileKey::Impl),
        ));
        let use_cases = use_cases(repository);
        let blocks = [
            markdown_block(
                MarkdownBlockType::Paragraph,
                0,
                "selected text",
                "selected text",
                "sha256_first",
            ),
            markdown_block(
                MarkdownBlockType::Paragraph,
                3,
                "selected text",
                "selected text",
                "sha256_nearest",
            ),
        ];

        let result = use_cases
            .resolve_comment_anchors(
                "auth-flow",
                SpecFileKey::Impl,
                CommentStatusFilter::All,
                &blocks,
            )
            .expect("anchors should resolve");

        let resolution = &result.resolutions()[0];
        let target = resolution.target().expect("target should exist");
        assert_eq!(AnchorResolutionStatus::Moved, resolution.status());
        assert_eq!(AnchorResolutionReason::StaleSnippet, resolution.reason());
        assert_eq!(3, target.block().index().value());
        assert_eq!(EXACT_MATCH_SCORE, target.score());
    }

    #[test]
    fn resolve_comment_anchors_orphans_ambiguous_duplicate_text() {
        let repository = FakeCommentRepository::default();
        repository.comments.borrow_mut().push(comment_with_anchor(
            "cmt_duplicate",
            anchor(SpecFileKey::Impl),
        ));
        let use_cases = use_cases(repository);
        let blocks = [
            markdown_block(
                MarkdownBlockType::Paragraph,
                0,
                "selected text",
                "selected text",
                "sha256_first",
            ),
            markdown_block(
                MarkdownBlockType::Paragraph,
                4,
                "selected text",
                "selected text",
                "sha256_second",
            ),
        ];

        let result = use_cases
            .resolve_comment_anchors(
                "auth-flow",
                SpecFileKey::Impl,
                CommentStatusFilter::All,
                &blocks,
            )
            .expect("anchors should resolve");

        let resolution = &result.resolutions()[0];
        assert_eq!(AnchorResolutionStatus::Orphaned, resolution.status());
        assert_eq!(
            AnchorResolutionReason::AmbiguousFuzzyCandidates,
            resolution.reason()
        );
        assert!(resolution.is_orphaned());
        assert!(resolution
            .details()
            .expect("details should mention tied candidates")
            .contains("2 fuzzy candidates"));
    }

    #[test]
    fn resolve_comment_anchors_filters_fuzzy_candidates_by_block_type() {
        let repository = FakeCommentRepository::default();
        repository
            .comments
            .borrow_mut()
            .push(comment_with_anchor("cmt_type", anchor(SpecFileKey::Impl)));
        let use_cases = use_cases(repository);
        let blocks = [markdown_block(
            MarkdownBlockType::Heading,
            4,
            "selected text",
            "selected text",
            "sha256_heading",
        )];

        let result = use_cases
            .resolve_comment_anchors(
                "auth-flow",
                SpecFileKey::Impl,
                CommentStatusFilter::All,
                &blocks,
            )
            .expect("anchors should resolve");

        let resolution = &result.resolutions()[0];
        assert_eq!(AnchorResolutionStatus::Orphaned, resolution.status());
        assert_eq!(
            AnchorResolutionReason::MissingOriginalBlock,
            resolution.reason()
        );
        assert!(resolution.target().is_none());
    }

    #[test]
    fn resolve_comment_anchors_keeps_duplicate_paragraph_when_original_hash_matches() {
        let repository = FakeCommentRepository::default();
        repository.comments.borrow_mut().push(comment_with_anchor(
            "cmt_duplicate_exact",
            anchor(SpecFileKey::Impl),
        ));
        let use_cases = use_cases(repository);
        let blocks = [
            markdown_block(
                MarkdownBlockType::Paragraph,
                0,
                "selected text",
                "selected text",
                "sha256_elsewhere",
            ),
            markdown_block(
                MarkdownBlockType::Paragraph,
                2,
                "selected text",
                "selected text",
                "sha256_prefix_8chars",
            ),
            markdown_block(
                MarkdownBlockType::Paragraph,
                4,
                "selected text",
                "selected text",
                "sha256_another",
            ),
        ];

        let result = use_cases
            .resolve_comment_anchors(
                "auth-flow",
                SpecFileKey::Impl,
                CommentStatusFilter::All,
                &blocks,
            )
            .expect("anchors should resolve");

        let resolution = &result.resolutions()[0];
        assert_eq!(AnchorResolutionStatus::Resolved, resolution.status());
        assert_eq!(AnchorResolutionReason::ExactMatch, resolution.reason());
        assert_eq!(
            2,
            resolution
                .target()
                .expect("target should exist")
                .block()
                .index()
                .value()
        );
    }

    #[test]
    fn resolve_comment_anchors_keeps_identical_heading_when_original_hash_matches() {
        let repository = FakeCommentRepository::default();
        repository.comments.borrow_mut().push(comment_with_anchor(
            "cmt_heading_exact",
            anchor_with(
                SpecFileKey::Impl,
                BlockType::Heading,
                1,
                "sha256_heading",
                "Overview",
            ),
        ));
        let use_cases = use_cases(repository);
        let blocks = [
            markdown_block(
                MarkdownBlockType::Heading,
                0,
                "# Overview",
                "Overview",
                "sha256_other_heading",
            ),
            markdown_block(
                MarkdownBlockType::Heading,
                1,
                "## Overview",
                "Overview",
                "sha256_heading",
            ),
        ];

        let result = use_cases
            .resolve_comment_anchors(
                "auth-flow",
                SpecFileKey::Impl,
                CommentStatusFilter::All,
                &blocks,
            )
            .expect("anchors should resolve");

        let resolution = &result.resolutions()[0];
        assert_eq!(AnchorResolutionStatus::Resolved, resolution.status());
        assert_eq!(AnchorResolutionReason::ExactMatch, resolution.reason());
        assert_eq!(
            1,
            resolution
                .target()
                .expect("target should exist")
                .block()
                .index()
                .value()
        );
    }

    #[test]
    fn resolve_comment_anchors_ignores_short_snippets_for_fuzzy_matching() {
        let repository = FakeCommentRepository::default();
        repository.comments.borrow_mut().push(comment_with_anchor(
            "cmt_short",
            anchor_with(
                SpecFileKey::Impl,
                BlockType::Paragraph,
                2,
                "sha256_old",
                "short",
            ),
        ));
        let use_cases = use_cases(repository);
        let blocks = [markdown_block(
            MarkdownBlockType::Paragraph,
            9,
            "short",
            "short",
            "sha256_short",
        )];

        let result = use_cases
            .resolve_comment_anchors(
                "auth-flow",
                SpecFileKey::Impl,
                CommentStatusFilter::All,
                &blocks,
            )
            .expect("anchors should resolve");

        let resolution = &result.resolutions()[0];
        assert_eq!(AnchorResolutionStatus::Orphaned, resolution.status());
        assert_eq!(
            AnchorResolutionReason::MissingOriginalBlock,
            resolution.reason()
        );
        assert!(resolution.target().is_none());
    }

    #[test]
    fn resolve_comment_anchors_orphans_missing_original_block_when_no_block_can_be_matched() {
        let repository = FakeCommentRepository::default();
        repository.comments.borrow_mut().push(comment_with_anchor(
            "cmt_missing",
            anchor(SpecFileKey::Impl),
        ));
        let use_cases = use_cases(repository);
        let blocks = [markdown_block(
            MarkdownBlockType::Heading,
            0,
            "Overview",
            "Overview",
            "sha256_overview",
        )];

        let result = use_cases
            .resolve_comment_anchors(
                "auth-flow",
                SpecFileKey::Impl,
                CommentStatusFilter::All,
                &blocks,
            )
            .expect("anchors should resolve");

        let resolution = &result.resolutions()[0];
        assert_eq!(AnchorResolutionStatus::Orphaned, resolution.status());
        assert_eq!(
            AnchorResolutionReason::MissingOriginalBlock,
            resolution.reason()
        );
        assert!(resolution.is_orphaned());
        assert!(resolution.target().is_none());
    }

    #[test]
    fn resolve_comment_anchors_orphans_unsupported_anchor_block_type() {
        let repository = FakeCommentRepository::default();
        repository.comments.borrow_mut().push(comment_with_anchor(
            "cmt_unsupported",
            anchor_with(
                SpecFileKey::Impl,
                BlockType::Other,
                2,
                "sha256_old",
                "selected text",
            ),
        ));
        let use_cases = use_cases(repository);
        let blocks = [markdown_block(
            MarkdownBlockType::Other,
            2,
            "selected text",
            "selected text",
            "sha256_old",
        )];

        let result = use_cases
            .resolve_comment_anchors(
                "auth-flow",
                SpecFileKey::Impl,
                CommentStatusFilter::All,
                &blocks,
            )
            .expect("anchors should resolve");

        let resolution = &result.resolutions()[0];
        assert_eq!(AnchorResolutionStatus::Orphaned, resolution.status());
        assert_eq!(
            AnchorResolutionReason::UnsupportedBlockType,
            resolution.reason()
        );
        assert!(resolution.target().is_none());
    }

    #[test]
    fn resolve_comment_anchors_returns_invalid_data_for_malformed_comment_json() {
        let use_cases = CommentUseCases::new(
            FailingCommentRepository {
                message: "comment JSON is malformed at impl.json".to_string(),
            },
            FakeIdGenerator {
                id: CommentId::new("cmt_generated").expect("comment id should be valid"),
            },
            FakeClock { now: timestamp(5) },
        );

        let result = use_cases.resolve_comment_anchors(
            "auth-flow",
            SpecFileKey::Impl,
            CommentStatusFilter::All,
            &[],
        );

        assert!(matches!(
            result,
            Err(AppUseCaseError::CommentRepository { message }) if message.contains("malformed")
        ));
    }
}
