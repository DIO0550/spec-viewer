//! Re-resolution of stored comment anchors against current Markdown blocks.

use crate::domain::spec::MarkdownBlock;

use super::fuzzy::{FuzzyAnchorSelection, EXACT_MATCH_SCORE, FUZZY_MATCH_THRESHOLD};
use super::{AnchorResolutionReason, AnchorResolutionStatus, BlockType, Comment, CommentAnchor};

/// Result of resolving one comment anchor against the current document blocks.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommentAnchorResolution {
    comment: Comment,
    original_anchor: CommentAnchor,
    status: AnchorResolutionStatus,
    reason: AnchorResolutionReason,
    details: Option<String>,
    target: Option<CommentAnchorResolutionTarget>,
}

impl CommentAnchorResolution {
    /// Highest score reported for exact snippet matches.
    pub const EXACT_MATCH_SCORE: u8 = EXACT_MATCH_SCORE;
    /// Minimum fuzzy score required to keep a candidate block.
    pub const FUZZY_MATCH_THRESHOLD: u8 = FUZZY_MATCH_THRESHOLD;

    /// Resolves the comment anchor against the current Markdown blocks.
    pub fn resolve(comment: Comment, current_blocks: &[MarkdownBlock]) -> Self {
        let anchor = comment.anchor().clone();

        if !anchor.block_type().supports_anchor_resolution() {
            return Self::new(
                comment,
                AnchorResolutionStatus::Orphaned,
                AnchorResolutionReason::UnsupportedBlockType,
                Some(format!(
                    "anchor block type {:?} is not supported for anchor resolution",
                    anchor.block_type()
                )),
                None,
            );
        }

        let indexed_block = current_blocks.iter().find(|block| {
            block.index().value() == anchor.block_index().value()
                && BlockType::from(block.block_type()) == anchor.block_type()
        });

        if let Some(block) =
            indexed_block.filter(|block| block.text_hash().as_str() == anchor.text_hash().as_str())
        {
            return Self::new(
                comment,
                AnchorResolutionStatus::Resolved,
                AnchorResolutionReason::ExactMatch,
                None,
                Some(CommentAnchorResolutionTarget::new(block, EXACT_MATCH_SCORE)),
            );
        }

        if let Some(block) = current_blocks
            .iter()
            .find(|block| block.text_hash().as_str() == anchor.text_hash().as_str())
        {
            return Self::new(
                comment,
                AnchorResolutionStatus::Moved,
                AnchorResolutionReason::MovedByHash,
                None,
                Some(CommentAnchorResolutionTarget::new(block, EXACT_MATCH_SCORE)),
            );
        }

        let fuzzy_candidate_blocks = indexed_block
            .map(|block| vec![block])
            .unwrap_or_else(|| current_blocks.iter().collect());

        match FuzzyAnchorSelection::select(&fuzzy_candidate_blocks, &anchor) {
            FuzzyAnchorSelection::Matched(candidate) => {
                return Self::new(
                    comment,
                    candidate.status,
                    candidate.reason,
                    None,
                    Some(CommentAnchorResolutionTarget::new(
                        candidate.block,
                        candidate.score,
                    )),
                );
            }
            FuzzyAnchorSelection::Ambiguous {
                candidate_count,
                score,
            } => {
                return Self::orphaned(
                    comment,
                    AnchorResolutionReason::AmbiguousFuzzyCandidates,
                    format!(
                        "{candidate_count} fuzzy candidates tied at score {score}; keeping the comment recoverable without choosing a target"
                    ),
                );
            }
            FuzzyAnchorSelection::BelowThreshold { best_score } => {
                if indexed_block.is_some() {
                    return Self::orphaned(
                        comment,
                        AnchorResolutionReason::DeletedText,
                        format!(
                            "original block is still present, but selected text no longer matches; best fuzzy score {best_score} is below threshold {FUZZY_MATCH_THRESHOLD}"
                        ),
                    );
                }

                return Self::orphaned(
                    comment,
                    AnchorResolutionReason::BelowThreshold,
                    format!(
                        "best fuzzy score {best_score} is below threshold {FUZZY_MATCH_THRESHOLD}"
                    ),
                );
            }
            FuzzyAnchorSelection::ShortSnippet | FuzzyAnchorSelection::NoCandidates => {
                if indexed_block.is_some() {
                    return Self::orphaned(
                        comment,
                        AnchorResolutionReason::DeletedText,
                        "original block is still present, but selected text could not be found"
                            .to_string(),
                    );
                }
            }
        }

        Self::orphaned(
            comment,
            AnchorResolutionReason::MissingOriginalBlock,
            "original block could not be found in the current Markdown blocks".to_string(),
        )
    }

    fn new(
        comment: Comment,
        status: AnchorResolutionStatus,
        reason: AnchorResolutionReason,
        details: Option<String>,
        target: Option<CommentAnchorResolutionTarget>,
    ) -> Self {
        let original_anchor = comment.anchor().clone();

        Self {
            comment,
            original_anchor,
            status,
            reason,
            details,
            target,
        }
    }

    fn orphaned(comment: Comment, reason: AnchorResolutionReason, details: String) -> Self {
        Self::new(
            comment,
            AnchorResolutionStatus::Orphaned,
            reason,
            Some(details),
            None,
        )
    }

    pub fn comment(&self) -> &Comment {
        &self.comment
    }

    pub fn original_anchor(&self) -> &CommentAnchor {
        &self.original_anchor
    }

    pub fn status(&self) -> AnchorResolutionStatus {
        self.status
    }

    pub fn reason(&self) -> AnchorResolutionReason {
        self.reason
    }

    pub fn details(&self) -> Option<&str> {
        self.details.as_deref()
    }

    pub fn target(&self) -> Option<&CommentAnchorResolutionTarget> {
        self.target.as_ref()
    }

    pub fn is_orphaned(&self) -> bool {
        self.status.is_orphaned()
    }
}

/// Block the anchor resolved to, with the match confidence score.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommentAnchorResolutionTarget {
    block: MarkdownBlock,
    score: u8,
}

impl CommentAnchorResolutionTarget {
    fn new(block: &MarkdownBlock, score: u8) -> Self {
        Self {
            block: block.clone(),
            score,
        }
    }

    pub fn block(&self) -> &MarkdownBlock {
        &self.block
    }

    pub fn score(&self) -> u8 {
        self.score
    }
}
