//! Fuzzy matching between stored anchor snippets and current Markdown blocks.

use crate::domain::spec::MarkdownBlock;

use super::{AnchorResolutionReason, AnchorResolutionStatus, BlockType, CommentAnchor};

pub(super) const MIN_FUZZY_SNIPPET_CHARS: usize = 8;
pub(super) const FUZZY_MATCH_THRESHOLD: u8 = 72;
pub(super) const EXACT_MATCH_SCORE: u8 = 100;

/// Candidate block scored against an anchor snippet.
#[derive(Debug, Clone, Copy)]
pub(super) struct FuzzyAnchorCandidate<'a> {
    pub(super) block: &'a MarkdownBlock,
    pub(super) status: AnchorResolutionStatus,
    pub(super) reason: AnchorResolutionReason,
    pub(super) score: u8,
    pub(super) distance_from_original_index: usize,
}

impl<'a> FuzzyAnchorCandidate<'a> {
    fn evaluate(
        block: &'a MarkdownBlock,
        anchor: &CommentAnchor,
        snippet: &FuzzyText,
    ) -> Option<Self> {
        let score = Self::match_score(block, snippet);

        if score < FUZZY_MATCH_THRESHOLD {
            return None;
        }

        let (status, reason) = if score == EXACT_MATCH_SCORE {
            (
                AnchorResolutionStatus::Moved,
                AnchorResolutionReason::StaleSnippet,
            )
        } else {
            (
                AnchorResolutionStatus::Fuzzy,
                AnchorResolutionReason::FuzzyMatch,
            )
        };

        Some(Self {
            block,
            status,
            reason,
            score,
            distance_from_original_index: block
                .index()
                .value()
                .abs_diff(anchor.block_index().value()),
        })
    }

    fn match_score(block: &MarkdownBlock, snippet: &FuzzyText) -> u8 {
        let block_text = FuzzyText::new(block.text().normalized());
        let raw_block_text = FuzzyText::new(block.text().raw());

        if block_text.contains(snippet) || raw_block_text.contains(snippet) {
            EXACT_MATCH_SCORE
        } else {
            snippet
                .score_against(&block_text)
                .max(snippet.score_against(&raw_block_text))
        }
    }
}

/// Outcome of fuzzy candidate selection for one anchor.
#[derive(Debug, Clone, Copy)]
pub(super) enum FuzzyAnchorSelection<'a> {
    Matched(FuzzyAnchorCandidate<'a>),
    Ambiguous { candidate_count: usize, score: u8 },
    BelowThreshold { best_score: u8 },
    ShortSnippet,
    NoCandidates,
}

impl<'a> FuzzyAnchorSelection<'a> {
    /// Selects the best fuzzy candidate block for the anchor, if any.
    pub(super) fn select(current_blocks: &[&'a MarkdownBlock], anchor: &CommentAnchor) -> Self {
        let snippet = FuzzyText::new(anchor.text_snippet().as_str());

        if snippet.char_count() < MIN_FUZZY_SNIPPET_CHARS {
            return Self::ShortSnippet;
        }

        let mut candidates = current_blocks
            .iter()
            .copied()
            .filter(|block| BlockType::from(block.block_type()) == anchor.block_type())
            .filter_map(|block| FuzzyAnchorCandidate::evaluate(block, anchor, &snippet))
            .collect::<Vec<_>>();

        if candidates.is_empty() {
            let best_score = Self::best_score(current_blocks, anchor, &snippet);

            return best_score.map_or(Self::NoCandidates, |best_score| Self::BelowThreshold {
                best_score,
            });
        }

        candidates.sort_by(|left, right| {
            right
                .score
                .cmp(&left.score)
                .then_with(|| {
                    left.distance_from_original_index
                        .cmp(&right.distance_from_original_index)
                })
                .then_with(|| left.block.index().value().cmp(&right.block.index().value()))
        });

        let best = candidates[0];
        let equally_good_count = candidates
            .iter()
            .filter(|candidate| {
                candidate.score == best.score
                    && candidate.distance_from_original_index == best.distance_from_original_index
            })
            .count();

        if equally_good_count > 1 {
            return Self::Ambiguous {
                candidate_count: equally_good_count,
                score: best.score,
            };
        }

        Self::Matched(best)
    }

    fn best_score(
        current_blocks: &[&MarkdownBlock],
        anchor: &CommentAnchor,
        snippet: &FuzzyText,
    ) -> Option<u8> {
        current_blocks
            .iter()
            .copied()
            .filter(|block| BlockType::from(block.block_type()) == anchor.block_type())
            .map(|block| FuzzyAnchorCandidate::match_score(block, snippet))
            .max()
    }
}

/// Whitespace-normalized lowercase text used for fuzzy scoring.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct FuzzyText {
    value: String,
}

impl FuzzyText {
    pub(super) fn new(value: &str) -> Self {
        Self {
            value: value
                .split_whitespace()
                .collect::<Vec<_>>()
                .join(" ")
                .to_lowercase(),
        }
    }

    fn char_count(&self) -> usize {
        self.value.chars().count()
    }

    fn contains(&self, other: &FuzzyText) -> bool {
        self.value.contains(&other.value)
    }

    /// Scores this snippet against the given block text between 0 and 100.
    fn score_against(&self, block_text: &FuzzyText) -> u8 {
        let snippet_words = Self::words(&self.value);
        let block_words = Self::words(&block_text.value);

        if snippet_words.is_empty() || block_words.is_empty() {
            return 0;
        }

        let best_window_score = Self::best_word_window_score(&snippet_words, &block_words);
        let token_score = Self::token_overlap_score(&snippet_words, &block_words);

        best_window_score.max(token_score)
    }

    fn words(value: &str) -> Vec<&str> {
        value.split_whitespace().collect()
    }

    fn best_word_window_score(snippet_words: &[&str], block_words: &[&str]) -> u8 {
        let snippet_word_count = snippet_words.len();
        let minimum_window_len = snippet_word_count.saturating_sub(1).max(1);
        let maximum_window_len = (snippet_word_count + 1).min(block_words.len());
        let snippet = snippet_words.join(" ");
        let mut best_score = 0;

        for window_len in minimum_window_len..=maximum_window_len {
            for window in block_words.windows(window_len) {
                let score = Self::normalized_levenshtein_score(&snippet, &window.join(" "));
                best_score = best_score.max(score);
            }
        }

        best_score
    }

    fn token_overlap_score(snippet_words: &[&str], block_words: &[&str]) -> u8 {
        let mut unmatched_block_words = block_words.to_vec();
        let mut common_count = 0;

        for snippet_word in snippet_words {
            if let Some(position) = unmatched_block_words
                .iter()
                .position(|block_word| block_word == snippet_word)
            {
                common_count += 1;
                unmatched_block_words.remove(position);
            }
        }

        ((2 * common_count * 100) / (snippet_words.len() + block_words.len())) as u8
    }

    fn normalized_levenshtein_score(left: &str, right: &str) -> u8 {
        let left_chars = left.chars().collect::<Vec<_>>();
        let right_chars = right.chars().collect::<Vec<_>>();
        let max_len = left_chars.len().max(right_chars.len());

        if max_len == 0 {
            return EXACT_MATCH_SCORE;
        }

        let distance = Self::levenshtein_distance(&left_chars, &right_chars);
        (((max_len - distance) * 100) / max_len) as u8
    }

    fn levenshtein_distance(left: &[char], right: &[char]) -> usize {
        let mut previous_row = (0..=right.len()).collect::<Vec<_>>();
        let mut current_row = vec![0; right.len() + 1];

        for (left_index, left_char) in left.iter().enumerate() {
            current_row[0] = left_index + 1;

            for (right_index, right_char) in right.iter().enumerate() {
                let substitution_cost = usize::from(left_char != right_char);
                current_row[right_index + 1] = (previous_row[right_index + 1] + 1)
                    .min(current_row[right_index] + 1)
                    .min(previous_row[right_index] + substitution_cost);
            }

            previous_row.clone_from(&current_row);
        }

        previous_row[right.len()]
    }
}
