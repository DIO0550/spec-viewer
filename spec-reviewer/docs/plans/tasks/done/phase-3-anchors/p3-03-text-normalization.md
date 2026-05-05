# P3.3 Text Normalization

## Tasks

- [x] Define whitespace normalization rules.
- [x] Define punctuation handling rules.
- [x] Normalize Markdown formatting away where appropriate.
- [x] Keep code block text stable.
- [x] Add tests for headings, paragraphs, lists, and code blocks.

## Done When

- Equivalent block text produces equivalent normalized text.

## Completion Note

Implemented Markdown block text normalization for parser-produced block metadata, including whitespace and line-ending normalization, Markdown artifact removal, typographic punctuation normalization, code fence removal with stable code text preservation, and focused Rust coverage for headings, paragraphs, lists, code blocks, punctuation, Unicode, and case sensitivity. Verified with `cargo fmt` and `cargo test`. Implementation commit: `bddf03e1f2ac6b9aa919168d05db284a0a99ab01`.
