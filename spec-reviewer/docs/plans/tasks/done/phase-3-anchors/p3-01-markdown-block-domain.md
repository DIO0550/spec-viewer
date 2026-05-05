# P3.1 Markdown Block Domain

## Tasks

- [x] Add `MarkdownBlock` domain type.
- [x] Add `MarkdownBlockId` or index type.
- [x] Add `MarkdownBlockText` value object.
- [x] Add optional block source range if available.
- [x] Add normalized text representation.
- [x] Add supported block type list.

## Done When

- Anchor resolution can work with parsed Markdown blocks independent of parser implementation details.

## Completion Note

Added parser-independent Markdown block domain primitives under `domain/spec`, including stable block types, block index, raw/normalized block text, optional byte source ranges, and focused unit tests.

Implementation commit: `a82afde80a94044935c84cb885a9ab419dd3769d`.
