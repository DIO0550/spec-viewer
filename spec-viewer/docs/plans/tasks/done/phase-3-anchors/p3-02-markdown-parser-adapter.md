# P3.2 Markdown Parser Adapter

## Tasks

- [x] Add `infrastructure/markdown/parser.rs`.
- [x] Parse headings.
- [x] Parse paragraphs.
- [x] Parse list items.
- [x] Parse code blocks.
- [x] Parse tables where practical.
- [x] Preserve deterministic block order.
- [x] Return domain `MarkdownBlock` values.
- [x] Add parser fixtures for common Markdown.

## Done When

- Parser tests prove common Markdown turns into stable block sequences.

## Completion Note

Added a pulldown-cmark-backed Markdown parser adapter that returns stable domain `MarkdownBlock` sequences for headings, paragraphs, list items, code blocks, blockquotes, HTML blocks, and tables while preserving byte source ranges. Parser tests cover common Markdown fixtures, deterministic ordering, source ranges, and nested paragraph suppression.

Implementation commit: `3f22589254cf674495ab71340ec0267aac5f0f64`.
