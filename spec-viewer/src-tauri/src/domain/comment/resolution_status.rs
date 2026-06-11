//! Anchor re-resolution status and reason labels.

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum AnchorResolutionStatus {
    Resolved,
    Moved,
    Fuzzy,
    Orphaned,
}

impl AnchorResolutionStatus {
    pub fn is_orphaned(self) -> bool {
        matches!(self, Self::Orphaned)
    }

    /// Stable serialization label shared by exports and frontend payloads.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Resolved => "resolved",
            Self::Moved => "moved",
            Self::Fuzzy => "fuzzy",
            Self::Orphaned => "orphaned",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum AnchorResolutionReason {
    ExactMatch,
    MovedByHash,
    StaleSnippet,
    FuzzyMatch,
    MissingOriginalBlock,
    AmbiguousFuzzyCandidates,
    BelowThreshold,
    DeletedText,
    UnsupportedBlockType,
}

impl AnchorResolutionReason {
    /// Stable serialization label shared by exports and frontend payloads.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::ExactMatch => "exact_match",
            Self::MovedByHash => "moved_by_hash",
            Self::StaleSnippet => "stale_snippet",
            Self::FuzzyMatch => "fuzzy_match",
            Self::MissingOriginalBlock => "missing_original_block",
            Self::AmbiguousFuzzyCandidates => "ambiguous_fuzzy_candidates",
            Self::BelowThreshold => "below_threshold",
            Self::DeletedText => "deleted_text",
            Self::UnsupportedBlockType => "unsupported_block_type",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn anchor_resolution_status_and_reason_use_frontend_labels() {
        assert_eq!("resolved", AnchorResolutionStatus::Resolved.as_str());
        assert_eq!("moved", AnchorResolutionStatus::Moved.as_str());
        assert_eq!("fuzzy", AnchorResolutionStatus::Fuzzy.as_str());
        assert_eq!("orphaned", AnchorResolutionStatus::Orphaned.as_str());
        assert_eq!("exact_match", AnchorResolutionReason::ExactMatch.as_str());
        assert_eq!(
            "stale_snippet",
            AnchorResolutionReason::StaleSnippet.as_str()
        );
        assert_eq!(
            "ambiguous_fuzzy_candidates",
            AnchorResolutionReason::AmbiguousFuzzyCandidates.as_str()
        );
    }
}
