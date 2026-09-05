//! Markdown parser adapter backed by pulldown-cmark.

use std::ops::Range;

use pulldown_cmark::{Event, Options, Parser, Tag, TagEnd};
use thiserror::Error;

use crate::domain::spec::{
    MarkdownBlock, MarkdownBlockHash, MarkdownBlockIndex, MarkdownBlockSourceRange,
    MarkdownBlockText, MarkdownBlockType, SpecDomainError, TaskCounts,
};
use crate::infrastructure::markdown::hash::hash_normalized_block_text;
use crate::infrastructure::markdown::normalizer::normalize_markdown_block_text;

#[derive(Debug, Clone, Copy, Default)]
pub struct PulldownMarkdownParser;

impl PulldownMarkdownParser {
    pub fn new() -> Self {
        Self
    }

    pub fn parse(&self, contents: &str) -> Result<Vec<MarkdownBlock>, MarkdownParseError> {
        parse_markdown_blocks(contents)
    }
}

pub fn parse_markdown_blocks(contents: &str) -> Result<Vec<MarkdownBlock>, MarkdownParseError> {
    let parser = Parser::new_ext(contents, parser_options()).into_offset_iter();
    let mut block_stack = Vec::<OpenMarkdownBlock>::new();
    let mut blocks = Vec::<PendingMarkdownBlock>::new();
    let mut suppress_paragraph_depth = 0usize;

    for (event, range) in parser {
        match event {
            Event::Start(tag) => {
                let block_type = block_type_for_start_tag(&tag);

                if let Some(block_type) = block_type {
                    let should_capture =
                        block_type != MarkdownBlockType::Paragraph || suppress_paragraph_depth == 0;

                    if should_capture {
                        block_stack.push(OpenMarkdownBlock::new(block_type, range.clone()));
                    }
                }

                if suppresses_nested_paragraphs(&tag) {
                    suppress_paragraph_depth += 1;
                }

                include_event_range(&mut block_stack, range);
            }
            Event::End(tag_end) => {
                include_event_range(&mut block_stack, range);

                if suppresses_nested_paragraphs_end(&tag_end) {
                    suppress_paragraph_depth = suppress_paragraph_depth.saturating_sub(1);
                }

                if let Some(block_type) = block_type_for_end_tag(&tag_end) {
                    close_latest_block(block_type, &mut block_stack, &mut blocks, contents);
                }
            }
            Event::Text(_)
            | Event::Code(_)
            | Event::Html(_)
            | Event::InlineHtml(_)
            | Event::InlineMath(_)
            | Event::DisplayMath(_)
            | Event::SoftBreak
            | Event::HardBreak
            | Event::Rule
            | Event::TaskListMarker(_) => {
                include_event_range(&mut block_stack, range);
            }
            Event::FootnoteReference(_) => {
                include_event_range(&mut block_stack, range);
            }
        }
    }

    blocks.sort_by_key(|block| block.start_byte_offset);

    blocks
        .into_iter()
        .enumerate()
        .map(|(index, pending)| pending.into_domain_block(index))
        .collect()
}
pub fn count_task_markers(contents: &str) -> Result<TaskCounts, MarkdownParseError> {
    let (completed, total) = Parser::new_ext(contents, parser_options())
        .filter_map(|event| match event {
            Event::TaskListMarker(checked) => Some(checked),
            _ => None,
        })
        .fold((0usize, 0usize), |(completed, total), checked| {
            (completed + usize::from(checked), total + 1)
        });

    Ok(TaskCounts::new(completed, total)?)
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum MarkdownParseError {
    #[error("parsed markdown block is invalid")]
    InvalidBlock { source: SpecDomainError },
}

impl From<SpecDomainError> for MarkdownParseError {
    fn from(source: SpecDomainError) -> Self {
        Self::InvalidBlock { source }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct OpenMarkdownBlock {
    block_type: MarkdownBlockType,
    start_byte_offset: usize,
    end_byte_offset: usize,
}

impl OpenMarkdownBlock {
    fn new(block_type: MarkdownBlockType, range: Range<usize>) -> Self {
        Self {
            block_type,
            start_byte_offset: range.start,
            end_byte_offset: range.end,
        }
    }

    fn include_range(&mut self, range: &Range<usize>) {
        self.start_byte_offset = self.start_byte_offset.min(range.start);
        self.end_byte_offset = self.end_byte_offset.max(range.end);
    }

    fn into_pending(self, contents: &str) -> Option<PendingMarkdownBlock> {
        let raw = contents
            .get(self.start_byte_offset..self.end_byte_offset)?
            .trim()
            .to_string();

        if raw.is_empty() {
            return None;
        }

        Some(PendingMarkdownBlock {
            block_type: self.block_type,
            start_byte_offset: self.start_byte_offset,
            end_byte_offset: self.end_byte_offset,
            raw,
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct PendingMarkdownBlock {
    block_type: MarkdownBlockType,
    start_byte_offset: usize,
    end_byte_offset: usize,
    raw: String,
}

impl PendingMarkdownBlock {
    fn into_domain_block(self, index: usize) -> Result<MarkdownBlock, MarkdownParseError> {
        let normalized = normalize_markdown_block_text(self.block_type, &self.raw);
        let text_hash = MarkdownBlockHash::new(hash_normalized_block_text(&normalized))?;
        let text = MarkdownBlockText::new(self.raw.clone(), normalized)?;
        let source_range =
            MarkdownBlockSourceRange::new(self.start_byte_offset, self.end_byte_offset)?;

        Ok(MarkdownBlock::new(
            self.block_type,
            MarkdownBlockIndex::new(index),
            text,
            text_hash,
            Some(source_range),
        ))
    }
}

fn parser_options() -> Options {
    let mut options = Options::empty();
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_TASKLISTS);
    options
}

fn block_type_for_start_tag(tag: &Tag<'_>) -> Option<MarkdownBlockType> {
    match tag {
        Tag::Paragraph => Some(MarkdownBlockType::Paragraph),
        Tag::Heading { .. } => Some(MarkdownBlockType::Heading),
        Tag::Item => Some(MarkdownBlockType::ListItem),
        Tag::CodeBlock(_) => Some(MarkdownBlockType::CodeBlock),
        Tag::BlockQuote(_) => Some(MarkdownBlockType::BlockQuote),
        Tag::Table(_) => Some(MarkdownBlockType::Table),
        Tag::HtmlBlock => Some(MarkdownBlockType::Html),
        _ => None,
    }
}

fn block_type_for_end_tag(tag_end: &TagEnd) -> Option<MarkdownBlockType> {
    match tag_end {
        TagEnd::Paragraph => Some(MarkdownBlockType::Paragraph),
        TagEnd::Heading(_) => Some(MarkdownBlockType::Heading),
        TagEnd::Item => Some(MarkdownBlockType::ListItem),
        TagEnd::CodeBlock => Some(MarkdownBlockType::CodeBlock),
        TagEnd::BlockQuote(_) => Some(MarkdownBlockType::BlockQuote),
        TagEnd::Table => Some(MarkdownBlockType::Table),
        TagEnd::HtmlBlock => Some(MarkdownBlockType::Html),
        _ => None,
    }
}

fn suppresses_nested_paragraphs(tag: &Tag<'_>) -> bool {
    matches!(tag, Tag::Item | Tag::BlockQuote(_) | Tag::Table(_))
}

fn suppresses_nested_paragraphs_end(tag_end: &TagEnd) -> bool {
    matches!(
        tag_end,
        TagEnd::Item | TagEnd::BlockQuote(_) | TagEnd::Table
    )
}

fn include_event_range(block_stack: &mut [OpenMarkdownBlock], range: Range<usize>) {
    if let Some(block) = block_stack.last_mut() {
        block.include_range(&range);
    }
}

fn close_latest_block(
    block_type: MarkdownBlockType,
    block_stack: &mut Vec<OpenMarkdownBlock>,
    blocks: &mut Vec<PendingMarkdownBlock>,
    contents: &str,
) {
    let Some(position) = block_stack
        .iter()
        .rposition(|block| block.block_type == block_type)
    else {
        return;
    };

    let open_block = block_stack.remove(position);

    if let Some(pending_block) = open_block.into_pending(contents) {
        blocks.push(pending_block);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn counts_task_markers_from_markdown_events() {
        let cases = [
            ("empty", "", (0, 0)),
            (
                "nested and uppercase checked marker",
                "- [ ] parent\n  - [X] child",
                (1, 2),
            ),
            (
                "code fence markers are ignored",
                "~~~markdown\n- [x] example\n~~~\n\n- [ ] real",
                (0, 1),
            ),
        ];

        for (case_name, markdown, expected) in cases {
            let counts = count_task_markers(markdown).expect("task markers should parse");

            assert_eq!(
                expected,
                (counts.completed(), counts.total()),
                "case failed: {case_name}",
            );
        }
    }

    #[test]
    fn parses_common_markdown_blocks_in_stable_order() {
        let markdown = [
            "# Overview",
            "",
            "Intro paragraph with **strong** text.",
            "",
            "- First item",
            "- [x] Checked item",
            "",
            "> Quoted paragraph",
            "",
            "```rust",
            "fn main() {}",
            "```",
            "",
            "| Name | Value |",
            "| --- | --- |",
            "| Alpha | 1 |",
        ]
        .join("\n");

        let blocks = parse_markdown_blocks(&markdown).expect("markdown should parse");

        assert_eq!(
            vec![
                MarkdownBlockType::Heading,
                MarkdownBlockType::Paragraph,
                MarkdownBlockType::ListItem,
                MarkdownBlockType::ListItem,
                MarkdownBlockType::BlockQuote,
                MarkdownBlockType::CodeBlock,
                MarkdownBlockType::Table,
            ],
            block_types(&blocks)
        );
        assert_eq!(
            vec![
                "# Overview",
                "Intro paragraph with **strong** text.",
                "- First item",
                "- [x] Checked item",
                "> Quoted paragraph",
                "```rust\nfn main() {}\n```",
                "| Name | Value |\n| --- | --- |\n| Alpha | 1 |",
            ],
            raw_texts(&blocks)
        );
        assert_eq!(
            (0..blocks.len()).collect::<Vec<_>>(),
            blocks
                .iter()
                .map(|block| block.index().value())
                .collect::<Vec<_>>()
        );
    }

    #[test]
    fn parses_empty_markdown_without_blocks() {
        let blocks = parse_markdown_blocks("").expect("empty markdown should parse");

        assert!(blocks.is_empty());
    }

    #[test]
    fn parses_heading_only_markdown_as_heading_blocks() {
        let markdown = "# Overview\n\n## Acceptance\n\n### Notes";

        let blocks = parse_markdown_blocks(markdown).expect("headings should parse");

        assert_eq!(
            vec![
                MarkdownBlockType::Heading,
                MarkdownBlockType::Heading,
                MarkdownBlockType::Heading,
            ],
            block_types(&blocks)
        );
        assert_eq!(
            vec!["Overview", "Acceptance", "Notes"],
            blocks
                .iter()
                .map(|block| block.text().normalized())
                .collect::<Vec<_>>()
        );
    }

    #[test]
    fn parses_identical_headings_with_distinct_indexes_and_matching_hashes() {
        let markdown = "# Overview\n\n## Overview";

        let blocks = parse_markdown_blocks(markdown).expect("headings should parse");

        assert_eq!(vec![0, 1], block_indexes(&blocks));
        assert_eq!("Overview", blocks[0].text().normalized());
        assert_eq!(blocks[0].text_hash(), blocks[1].text_hash());
    }

    #[test]
    fn keeps_source_ranges_for_each_parsed_block() {
        let markdown = "# Title\n\nParagraph";

        let blocks = parse_markdown_blocks(markdown).expect("markdown should parse");

        assert_eq!(
            Some(MarkdownBlockSourceRange::new(0, 8).expect("range should be valid")),
            blocks[0].source_range()
        );
        assert_eq!(
            Some(MarkdownBlockSourceRange::new(9, 18).expect("range should be valid")),
            blocks[1].source_range()
        );
    }

    #[test]
    fn does_not_emit_nested_paragraphs_inside_list_items_or_blockquotes() {
        let markdown = "- list paragraph\n\n> quote paragraph";

        let blocks = parse_markdown_blocks(markdown).expect("markdown should parse");

        assert_eq!(
            vec![MarkdownBlockType::ListItem, MarkdownBlockType::BlockQuote],
            block_types(&blocks)
        );
        assert_eq!(
            vec!["- list paragraph", "> quote paragraph"],
            raw_texts(&blocks)
        );
    }

    fn block_types(blocks: &[MarkdownBlock]) -> Vec<MarkdownBlockType> {
        blocks.iter().map(|block| block.block_type()).collect()
    }

    fn raw_texts(blocks: &[MarkdownBlock]) -> Vec<&str> {
        blocks.iter().map(|block| block.text().raw()).collect()
    }

    fn block_indexes(blocks: &[MarkdownBlock]) -> Vec<usize> {
        blocks.iter().map(|block| block.index().value()).collect()
    }

    #[test]
    fn parses_blocks_with_normalized_text() {
        let markdown = [
            "## Overview",
            "",
            "Intro paragraph with **strong** text.",
            "",
            "- [x] Checked item",
            "",
            "```rust",
            "fn main() {}",
            "```",
        ]
        .join("\n");

        let blocks = parse_markdown_blocks(&markdown).expect("markdown should parse");

        assert_eq!("Overview", blocks[0].text().normalized());
        assert_eq!(
            "Intro paragraph with strong text.",
            blocks[1].text().normalized()
        );
        assert_eq!("Checked item", blocks[2].text().normalized());
        assert_eq!("fn main() {}", blocks[3].text().normalized());
    }

    #[test]
    fn parses_blocks_with_hashes_from_normalized_text() {
        let markdown = "### Overview ###\n\nOverview";

        let blocks = parse_markdown_blocks(markdown).expect("markdown should parse");

        assert_eq!("Overview", blocks[0].text().normalized());
        assert_eq!("Overview", blocks[1].text().normalized());
        assert_eq!("sha256:d4b1ea57", blocks[0].text_hash().as_str());
        assert_eq!(blocks[0].text_hash(), blocks[1].text_hash());
    }
}
