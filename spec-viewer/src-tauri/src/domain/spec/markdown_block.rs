//! Markdown block concepts shared by anchoring and rendering.

use std::fmt;

use crate::domain::spec::SpecDomainError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum MarkdownBlockType {
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

impl MarkdownBlockType {
    pub const SUPPORTED_TYPES: [Self; 9] = [
        Self::Paragraph,
        Self::Heading,
        Self::ListItem,
        Self::CodeBlock,
        Self::BlockQuote,
        Self::Table,
        Self::ThematicBreak,
        Self::Html,
        Self::Other,
    ];

    pub fn supported_types() -> &'static [Self] {
        &Self::SUPPORTED_TYPES
    }

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
}

impl fmt::Display for MarkdownBlockType {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct MarkdownBlockIndex {
    value: usize,
}

impl MarkdownBlockIndex {
    pub fn new(value: usize) -> Self {
        Self { value }
    }

    pub fn value(self) -> usize {
        self.value
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MarkdownBlockText {
    raw: String,
    normalized: String,
}

impl MarkdownBlockText {
    pub fn new(
        raw: impl Into<String>,
        normalized: impl Into<String>,
    ) -> Result<Self, SpecDomainError> {
        let raw = raw.into();
        let normalized = normalized.into();
        let trimmed_normalized = normalized.trim();

        if raw.trim().is_empty() {
            return Err(SpecDomainError::MissingMarkdownBlockText);
        }

        if trimmed_normalized.is_empty() {
            return Err(SpecDomainError::MissingNormalizedMarkdownBlockText);
        }

        Ok(Self { raw, normalized })
    }

    pub fn raw(&self) -> &str {
        &self.raw
    }

    pub fn normalized(&self) -> &str {
        &self.normalized
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct MarkdownBlockHash {
    value: String,
}

impl MarkdownBlockHash {
    pub fn new(value: impl Into<String>) -> Result<Self, SpecDomainError> {
        let value = value.into();
        let trimmed = value.trim();

        if trimmed.is_empty() {
            return Err(SpecDomainError::MissingMarkdownBlockHash);
        }

        Ok(Self {
            value: trimmed.to_string(),
        })
    }

    pub fn as_str(&self) -> &str {
        &self.value
    }
}

impl fmt::Display for MarkdownBlockHash {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct MarkdownBlockSourceRange {
    start_byte_offset: usize,
    end_byte_offset: usize,
}

impl MarkdownBlockSourceRange {
    pub fn new(start_byte_offset: usize, end_byte_offset: usize) -> Result<Self, SpecDomainError> {
        if end_byte_offset < start_byte_offset {
            return Err(SpecDomainError::InvalidMarkdownBlockSourceRange {
                start_byte_offset,
                end_byte_offset,
            });
        }

        Ok(Self {
            start_byte_offset,
            end_byte_offset,
        })
    }

    pub fn start_byte_offset(self) -> usize {
        self.start_byte_offset
    }

    pub fn end_byte_offset(self) -> usize {
        self.end_byte_offset
    }

    pub fn len(self) -> usize {
        self.end_byte_offset - self.start_byte_offset
    }

    pub fn is_empty(self) -> bool {
        self.len() == 0
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MarkdownBlock {
    block_type: MarkdownBlockType,
    index: MarkdownBlockIndex,
    text: MarkdownBlockText,
    text_hash: MarkdownBlockHash,
    source_range: Option<MarkdownBlockSourceRange>,
}

impl MarkdownBlock {
    pub fn new(
        block_type: MarkdownBlockType,
        index: MarkdownBlockIndex,
        text: MarkdownBlockText,
        text_hash: MarkdownBlockHash,
        source_range: Option<MarkdownBlockSourceRange>,
    ) -> Self {
        Self {
            block_type,
            index,
            text,
            text_hash,
            source_range,
        }
    }

    pub fn block_type(&self) -> MarkdownBlockType {
        self.block_type
    }

    pub fn index(&self) -> MarkdownBlockIndex {
        self.index
    }

    pub fn text(&self) -> &MarkdownBlockText {
        &self.text
    }

    pub fn text_hash(&self) -> &MarkdownBlockHash {
        &self.text_hash
    }

    pub fn source_range(&self) -> Option<MarkdownBlockSourceRange> {
        self.source_range
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn markdown_block_type_lists_supported_types_in_stable_order() {
        assert_eq!(
            &[
                MarkdownBlockType::Paragraph,
                MarkdownBlockType::Heading,
                MarkdownBlockType::ListItem,
                MarkdownBlockType::CodeBlock,
                MarkdownBlockType::BlockQuote,
                MarkdownBlockType::Table,
                MarkdownBlockType::ThematicBreak,
                MarkdownBlockType::Html,
                MarkdownBlockType::Other,
            ],
            MarkdownBlockType::supported_types()
        );
        assert_eq!("code_block", MarkdownBlockType::CodeBlock.as_str());
        assert_eq!("code_block", MarkdownBlockType::CodeBlock.to_string());
    }

    #[test]
    fn markdown_block_index_keeps_zero_based_position() {
        let index = MarkdownBlockIndex::new(3);

        assert_eq!(3, index.value());
    }

    #[test]
    fn markdown_block_text_preserves_raw_and_normalized_representation() {
        let text = MarkdownBlockText::new("  **Selected** text  ", " selected text ")
            .expect("block text should be valid");

        assert_eq!("  **Selected** text  ", text.raw());
        assert_eq!(" selected text ", text.normalized());
    }

    #[test]
    fn markdown_block_text_rejects_empty_raw_text() {
        let result = MarkdownBlockText::new("   ", "selected text");

        assert_eq!(Err(SpecDomainError::MissingMarkdownBlockText), result);
    }

    #[test]
    fn markdown_block_text_rejects_empty_normalized_text() {
        let result = MarkdownBlockText::new("Selected text", "   ");

        assert_eq!(
            Err(SpecDomainError::MissingNormalizedMarkdownBlockText),
            result
        );
    }

    #[test]
    fn markdown_block_hash_accepts_and_trims_non_empty_value() {
        let hash = MarkdownBlockHash::new("  sha256:d4b1ea57  ").expect("hash should be valid");

        assert_eq!("sha256:d4b1ea57", hash.as_str());
        assert_eq!("sha256:d4b1ea57", hash.to_string());
    }

    #[test]
    fn markdown_block_hash_rejects_empty_value() {
        let result = MarkdownBlockHash::new("   ");

        assert_eq!(Err(SpecDomainError::MissingMarkdownBlockHash), result);
    }

    #[test]
    fn markdown_block_source_range_keeps_byte_offsets() {
        let range = MarkdownBlockSourceRange::new(4, 17).expect("range should be valid");

        assert_eq!(4, range.start_byte_offset());
        assert_eq!(17, range.end_byte_offset());
        assert_eq!(13, range.len());
        assert!(!range.is_empty());
    }

    #[test]
    fn markdown_block_source_range_accepts_empty_range() {
        let range = MarkdownBlockSourceRange::new(4, 4).expect("range should be valid");

        assert!(range.is_empty());
    }

    #[test]
    fn markdown_block_source_range_rejects_end_before_start() {
        let result = MarkdownBlockSourceRange::new(17, 4);

        assert_eq!(
            Err(SpecDomainError::InvalidMarkdownBlockSourceRange {
                start_byte_offset: 17,
                end_byte_offset: 4,
            }),
            result
        );
    }

    #[test]
    fn markdown_block_keeps_parser_independent_block_metadata() {
        let source_range = MarkdownBlockSourceRange::new(10, 30).expect("range should be valid");
        let text =
            MarkdownBlockText::new("## Overview", "overview").expect("block text should be valid");
        let text_hash = MarkdownBlockHash::new("sha256:d4b1ea57").expect("hash should be valid");
        let block = MarkdownBlock::new(
            MarkdownBlockType::Heading,
            MarkdownBlockIndex::new(1),
            text,
            text_hash,
            Some(source_range),
        );

        assert_eq!(MarkdownBlockType::Heading, block.block_type());
        assert_eq!(1, block.index().value());
        assert_eq!("## Overview", block.text().raw());
        assert_eq!("overview", block.text().normalized());
        assert_eq!("sha256:d4b1ea57", block.text_hash().as_str());
        assert_eq!(Some(source_range), block.source_range());
    }

    #[test]
    fn markdown_block_source_range_is_optional() {
        let text = MarkdownBlockText::new("Paragraph text", "paragraph text")
            .expect("block text should be valid");
        let block = MarkdownBlock::new(
            MarkdownBlockType::Paragraph,
            MarkdownBlockIndex::new(0),
            text,
            MarkdownBlockHash::new("sha256:a5dd5c34").expect("hash should be valid"),
            None,
        );

        assert_eq!(None, block.source_range());
    }
}
