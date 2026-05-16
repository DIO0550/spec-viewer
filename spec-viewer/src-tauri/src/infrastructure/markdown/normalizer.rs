//! Markdown block text normalization rules for stable anchor matching.

use pulldown_cmark::{Event, Options, Parser, Tag, TagEnd};

use crate::domain::spec::MarkdownBlockType;

pub fn normalize_markdown_block_text(block_type: MarkdownBlockType, raw: &str) -> String {
    match block_type {
        MarkdownBlockType::CodeBlock => normalize_code_block_text(raw),
        _ => normalize_prose_block_text(raw),
    }
}

fn normalize_prose_block_text(raw: &str) -> String {
    let markdown = normalize_line_endings(raw);
    let plain_text = collect_plain_text(&markdown);
    let source = if plain_text.trim().is_empty() {
        markdown.as_str()
    } else {
        plain_text.as_str()
    };
    let normalized_punctuation = normalize_punctuation(source);

    collapse_whitespace(&normalized_punctuation)
}

fn normalize_code_block_text(raw: &str) -> String {
    let markdown = normalize_line_endings(raw);
    let code_text = collect_code_block_text(&markdown);
    let source = if code_text.is_empty() {
        markdown.as_str()
    } else {
        code_text.as_str()
    };

    trim_outer_line_endings(source)
}

fn parser_options() -> Options {
    let mut options = Options::empty();
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_TASKLISTS);
    options
}

fn normalize_line_endings(value: &str) -> String {
    value.replace("\r\n", "\n").replace('\r', "\n")
}

fn collect_plain_text(markdown: &str) -> String {
    let mut text = String::new();

    for event in Parser::new_ext(markdown, parser_options()) {
        match event {
            Event::Text(value)
            | Event::Code(value)
            | Event::Html(value)
            | Event::InlineHtml(value)
            | Event::InlineMath(value)
            | Event::DisplayMath(value)
            | Event::FootnoteReference(value) => {
                text.push_str(value.as_ref());
            }
            Event::SoftBreak | Event::HardBreak | Event::Rule => {
                text.push(' ');
            }
            Event::TaskListMarker(_) | Event::Start(_) | Event::End(_) => {}
        }
    }

    text
}

fn collect_code_block_text(markdown: &str) -> String {
    let mut text = String::new();
    let mut in_code_block = false;

    for event in Parser::new_ext(markdown, parser_options()) {
        match event {
            Event::Start(Tag::CodeBlock(_)) => {
                in_code_block = true;
            }
            Event::End(TagEnd::CodeBlock) => {
                in_code_block = false;
            }
            Event::Text(value) if in_code_block => {
                text.push_str(value.as_ref());
            }
            Event::SoftBreak | Event::HardBreak if in_code_block => {
                text.push('\n');
            }
            _ => {}
        }
    }

    text
}

fn normalize_punctuation(value: &str) -> String {
    let mut normalized = String::new();

    for character in value.chars() {
        match character {
            '\u{2018}' | '\u{2019}' | '\u{201A}' | '\u{201B}' => normalized.push('\''),
            '\u{201C}' | '\u{201D}' | '\u{201E}' | '\u{201F}' => normalized.push('"'),
            '\u{2010}' | '\u{2011}' | '\u{2012}' | '\u{2013}' | '\u{2014}' | '\u{2212}' => {
                normalized.push('-')
            }
            '\u{2026}' => normalized.push_str("..."),
            _ => normalized.push(character),
        }
    }

    normalized
}

fn collapse_whitespace(value: &str) -> String {
    let mut normalized = String::new();
    let mut previous_was_whitespace = true;

    for character in value.chars() {
        if character.is_whitespace() {
            previous_was_whitespace = true;
        } else {
            if !normalized.is_empty() && previous_was_whitespace {
                normalized.push(' ');
            }

            normalized.push(character);
            previous_was_whitespace = false;
        }
    }

    normalized
}

fn trim_outer_line_endings(value: &str) -> String {
    value.trim_matches('\n').to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn heading_markers_do_not_affect_normalized_text() {
        assert_eq!(
            normalize_markdown_block_text(MarkdownBlockType::Heading, "# Overview"),
            normalize_markdown_block_text(MarkdownBlockType::Heading, "Overview")
        );
        assert_eq!(
            "Overview",
            normalize_markdown_block_text(MarkdownBlockType::Heading, "### Overview ###")
        );
    }

    #[test]
    fn paragraph_normalization_collapses_whitespace_and_line_endings() {
        assert_eq!(
            "Intro paragraph with strong text.",
            normalize_markdown_block_text(
                MarkdownBlockType::Paragraph,
                " Intro\r\nparagraph\twith **strong**\ntext. "
            )
        );
    }

    #[test]
    fn punctuation_normalization_keeps_meaningful_marks_but_unifies_typographic_variants() {
        assert_eq!(
            "\"Resume\" - done... Wait, really?",
            normalize_markdown_block_text(
                MarkdownBlockType::Paragraph,
                "\u{201C}Resume\u{201D} \u{2014} done\u{2026} Wait, really?"
            )
        );
    }

    #[test]
    fn list_markers_and_task_markers_do_not_affect_normalized_text() {
        assert_eq!(
            normalize_markdown_block_text(MarkdownBlockType::ListItem, "- [x] Finish task"),
            normalize_markdown_block_text(MarkdownBlockType::ListItem, "1. Finish task")
        );
        assert_eq!(
            "Finish task",
            normalize_markdown_block_text(MarkdownBlockType::ListItem, "- [ ] Finish task")
        );
    }

    #[test]
    fn code_block_normalization_removes_fences_and_preserves_code_text() {
        let first = "```rust\r\nfn main() {\r\n    println!(\"Hi\");\r\n}\r\n```";
        let second = "```\nfn main() {\n    println!(\"Hi\");\n}\n```";

        assert_eq!(
            "fn main() {\n    println!(\"Hi\");\n}",
            normalize_markdown_block_text(MarkdownBlockType::CodeBlock, first)
        );
        assert_eq!(
            normalize_markdown_block_text(MarkdownBlockType::CodeBlock, first),
            normalize_markdown_block_text(MarkdownBlockType::CodeBlock, second)
        );
    }

    #[test]
    fn code_block_normalization_preserves_case_punctuation_and_indentation() {
        assert_eq!(
            "    Let API_URL = \"https://example.test\";",
            normalize_markdown_block_text(
                MarkdownBlockType::CodeBlock,
                "```ts\n    Let API_URL = \"https://example.test\";\n```"
            )
        );
    }

    #[test]
    fn prose_normalization_is_case_sensitive_and_keeps_non_punctuation_unicode() {
        assert_ne!(
            normalize_markdown_block_text(MarkdownBlockType::Paragraph, "API resume"),
            normalize_markdown_block_text(MarkdownBlockType::Paragraph, "api resume")
        );
        assert_eq!(
            "R\u{00E9}sum\u{00E9} caf\u{00E9}",
            normalize_markdown_block_text(
                MarkdownBlockType::Paragraph,
                "R\u{00E9}sum\u{00E9} caf\u{00E9}"
            )
        );
    }
}
