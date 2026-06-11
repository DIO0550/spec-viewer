//! Comment resolution status.

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum CommentStatus {
    Open,
    Resolved,
}

impl CommentStatus {
    pub fn is_resolved(self) -> bool {
        matches!(self, Self::Resolved)
    }

    /// Stable serialization label shared by exports and frontend payloads.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Open => "open",
            Self::Resolved => "resolved",
        }
    }
}
