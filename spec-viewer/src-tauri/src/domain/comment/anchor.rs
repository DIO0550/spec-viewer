//! Comment anchor concepts: block location and matching text.

use std::fmt;

use crate::domain::{
    comment::CommentDomainError,
    spec::{MarkdownBlock, MarkdownBlockType, SpecFileKey},
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum BlockType {
    Paragraph,
    Heading,
    ListItem,
    CodeBlock,
    BlockQuote,
    Table,
    ThematicBreak,
    Html,
    Other,
}

impl BlockType {
    /// Stable serialization label shared by exports and frontend payloads.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Paragraph => "paragraph",
            Self::Heading => "heading",
            Self::ListItem => "list_item",
            Self::CodeBlock => "code_block",
            Self::BlockQuote => "block_quote",
            Self::Table => "table",
            Self::ThematicBreak => "thematic_break",
            Self::Html => "html",
            Self::Other => "other",
        }
    }

    /// Reports whether comments anchored to this block type can be re-resolved.
    pub fn supports_anchor_resolution(self) -> bool {
        matches!(
            self,
            Self::Paragraph
                | Self::Heading
                | Self::ListItem
                | Self::CodeBlock
                | Self::BlockQuote
                | Self::Table
        )
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct BlockIndex {
    value: usize,
}

impl BlockIndex {
    pub fn new(value: usize) -> Self {
        Self { value }
    }

    pub fn value(self) -> usize {
        self.value
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct TextHash {
    value: String,
}

impl TextHash {
    pub fn new(value: impl Into<String>) -> Result<Self, CommentDomainError> {
        let value = value.into();
        let trimmed = value.trim();

        if trimmed.is_empty() {
            return Err(CommentDomainError::MissingTextHash);
        }

        Ok(Self {
            value: trimmed.to_string(),
        })
    }

    pub fn as_str(&self) -> &str {
        &self.value
    }
}

impl fmt::Display for TextHash {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TextSnippet {
    value: String,
}

impl TextSnippet {
    pub fn new(value: impl Into<String>) -> Result<Self, CommentDomainError> {
        let value = value.into();

        if value.trim().is_empty() {
            return Err(CommentDomainError::MissingTextSnippet);
        }

        Ok(Self { value })
    }

    pub fn as_str(&self) -> &str {
        &self.value
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct CharRange {
    start: usize,
    end: usize,
}

impl CharRange {
    pub fn new(start: usize, end: usize) -> Result<Self, CommentDomainError> {
        if end < start {
            return Err(CommentDomainError::InvalidCharRange { start, end });
        }

        Ok(Self { start, end })
    }

    pub fn start(self) -> usize {
        self.start
    }

    pub fn end(self) -> usize {
        self.end
    }

    pub fn len(self) -> usize {
        self.end - self.start
    }

    pub fn is_empty(self) -> bool {
        self.len() == 0
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommentAnchor {
    file_key: SpecFileKey,
    block_type: BlockType,
    block_index: BlockIndex,
    text_hash: TextHash,
    text_snippet: TextSnippet,
    char_range: CharRange,
}

impl CommentAnchor {
    pub fn new(
        file_key: SpecFileKey,
        block_type: BlockType,
        block_index: BlockIndex,
        text_hash: TextHash,
        text_snippet: TextSnippet,
        char_range: CharRange,
    ) -> Self {
        Self {
            file_key,
            block_type,
            block_index,
            text_hash,
            text_snippet,
            char_range,
        }
    }

    pub fn from_markdown_block(
        file_key: SpecFileKey,
        block: &MarkdownBlock,
        text_snippet: TextSnippet,
        char_range: CharRange,
    ) -> Result<Self, CommentDomainError> {
        Ok(Self::new(
            file_key,
            BlockType::from(block.block_type()),
            BlockIndex::new(block.index().value()),
            TextHash::new(block.text_hash().as_str())?,
            text_snippet,
            char_range,
        ))
    }

    pub fn file_key(&self) -> SpecFileKey {
        self.file_key
    }

    pub fn block_type(&self) -> BlockType {
        self.block_type
    }

    pub fn block_index(&self) -> BlockIndex {
        self.block_index
    }

    pub fn text_hash(&self) -> &TextHash {
        &self.text_hash
    }

    pub fn text_snippet(&self) -> &TextSnippet {
        &self.text_snippet
    }

    pub fn char_range(&self) -> CharRange {
        self.char_range
    }
}

impl From<MarkdownBlockType> for BlockType {
    fn from(block_type: MarkdownBlockType) -> Self {
        match block_type {
            MarkdownBlockType::Paragraph => Self::Paragraph,
            MarkdownBlockType::Heading => Self::Heading,
            MarkdownBlockType::ListItem => Self::ListItem,
            MarkdownBlockType::CodeBlock => Self::CodeBlock,
            MarkdownBlockType::BlockQuote => Self::BlockQuote,
            MarkdownBlockType::Table => Self::Table,
            MarkdownBlockType::ThematicBreak => Self::ThematicBreak,
            MarkdownBlockType::Html => Self::Html,
            MarkdownBlockType::Other => Self::Other,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::spec::{
        MarkdownBlockHash, MarkdownBlockIndex, MarkdownBlockSourceRange, MarkdownBlockText,
    };

    fn anchor_for_file(file_key: SpecFileKey) -> CommentAnchor {
        CommentAnchor::new(
            file_key,
            BlockType::Paragraph,
            BlockIndex::new(2),
            TextHash::new("block-hash").expect("hash should be valid"),
            TextSnippet::new("Selected text").expect("snippet should be valid"),
            CharRange::new(4, 17).expect("range should be valid"),
        )
    }

    #[test]
    fn block_index_keeps_zero_based_position() {
        let index = BlockIndex::new(3);

        assert_eq!(3, index.value());
    }

    #[test]
    fn text_hash_accepts_and_trims_non_empty_value() {
        let hash = TextHash::new("  sha256-prefix  ").expect("hash should be valid");

        assert_eq!("sha256-prefix", hash.as_str());
        assert_eq!("sha256-prefix", hash.to_string());
    }

    #[test]
    fn text_hash_rejects_empty_value() {
        let result = TextHash::new("   ");

        assert_eq!(Err(CommentDomainError::MissingTextHash), result);
    }

    #[test]
    fn text_snippet_accepts_non_empty_value_without_trimming() {
        let snippet = TextSnippet::new("  selected text  ").expect("snippet should be valid");

        assert_eq!("  selected text  ", snippet.as_str());
    }

    #[test]
    fn text_snippet_rejects_empty_value() {
        let result = TextSnippet::new("   ");

        assert_eq!(Err(CommentDomainError::MissingTextSnippet), result);
    }

    #[test]
    fn char_range_accepts_ordered_start_and_end() {
        let range = CharRange::new(4, 17).expect("range should be valid");

        assert_eq!(4, range.start());
        assert_eq!(17, range.end());
        assert_eq!(13, range.len());
        assert!(!range.is_empty());
    }

    #[test]
    fn char_range_accepts_empty_range() {
        let range = CharRange::new(4, 4).expect("range should be valid");

        assert!(range.is_empty());
    }

    #[test]
    fn char_range_rejects_end_before_start() {
        let result = CharRange::new(17, 4);

        assert_eq!(
            Err(CommentDomainError::InvalidCharRange { start: 17, end: 4 }),
            result
        );
    }

    #[test]
    fn comment_anchor_keeps_document_location_and_matching_text() {
        let anchor = anchor_for_file(SpecFileKey::Tasks);

        assert_eq!(SpecFileKey::Tasks, anchor.file_key());
        assert_eq!(BlockType::Paragraph, anchor.block_type());
        assert_eq!(2, anchor.block_index().value());
        assert_eq!("block-hash", anchor.text_hash().as_str());
        assert_eq!("Selected text", anchor.text_snippet().as_str());
        assert_eq!(
            CharRange::new(4, 17).expect("range should be valid"),
            anchor.char_range()
        );
    }

    #[test]
    fn comment_anchor_can_be_created_from_markdown_block_metadata() {
        let block = MarkdownBlock::new(
            MarkdownBlockType::ListItem,
            MarkdownBlockIndex::new(4),
            MarkdownBlockText::new("- [x] Finish task", "Finish task")
                .expect("block text should be valid"),
            MarkdownBlockHash::new("sha256:bd64c9e7").expect("hash should be valid"),
            Some(MarkdownBlockSourceRange::new(12, 29).expect("range should be valid")),
        );

        let anchor = CommentAnchor::from_markdown_block(
            SpecFileKey::Tasks,
            &block,
            TextSnippet::new("Finish").expect("snippet should be valid"),
            CharRange::new(0, 6).expect("range should be valid"),
        )
        .expect("anchor should be valid");

        assert_eq!(SpecFileKey::Tasks, anchor.file_key());
        assert_eq!(BlockType::ListItem, anchor.block_type());
        assert_eq!(4, anchor.block_index().value());
        assert_eq!("sha256:bd64c9e7", anchor.text_hash().as_str());
        assert_eq!("Finish", anchor.text_snippet().as_str());
        assert_eq!(
            CharRange::new(0, 6).expect("range should be valid"),
            anchor.char_range()
        );
    }
}
