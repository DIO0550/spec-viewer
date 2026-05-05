# Phase 3 tasks: anchors and robustness

## Goal

Keep comments attached to useful Markdown locations even after Markdown files are regenerated or lightly edited.

## Anchor Strategy

Resolve comments in this order:

1. `blockType` + `blockIndex`
2. `textHash`
3. `textSnippet` partial/fuzzy match
4. Mark as orphaned

## Rust Tasks

- [ ] Add `comment/anchor.rs`.
- [ ] Parse Markdown blocks with `pulldown-cmark`.
- [ ] Normalize block text for hashing.
- [ ] Generate `sha256` prefix hashes for blocks.
- [ ] Return block metadata to the frontend where needed.
- [ ] Implement anchor resolution for all comments in a file.
- [ ] Mark unresolved anchors as orphaned without deleting them.
- [ ] Add a file watch strategy using Tauri plugin support or `notify`.
- [ ] Re-resolve comments after Markdown file changes.

## TypeScript Tasks

- [ ] Add anchor state to `Comment` view model.
- [ ] Highlight resolved comment ranges or whole blocks.
- [ ] Show orphaned comments in a dedicated sidebar section.
- [ ] Add "jump to comment" behavior.
- [ ] Add "orphaned" badges and disabled jump state.

## Edge Cases

- [ ] Empty Markdown file.
- [ ] Duplicate paragraph text.
- [ ] Multiple identical headings.
- [ ] Deleted block with still-valid snippet elsewhere.
- [ ] File renamed through config while comments remain keyed by logical file.

## Tests

- [ ] Rust tests for block parsing order.
- [ ] Rust tests for hash fallback.
- [ ] Rust tests for snippet fallback.
- [ ] Rust tests for orphan detection.
- [ ] React tests for orphaned sidebar display.

## Detailed Task Breakdown

### P3.1 Markdown Block Domain

- [ ] Add `MarkdownBlock` domain type.
- [ ] Add `MarkdownBlockId` or index type.
- [ ] Add `MarkdownBlockText` value object.
- [ ] Add optional block source range if available.
- [ ] Add normalized text representation.
- [ ] Add supported block type list.

### P3.2 Markdown Parser Adapter

- [ ] Add `infrastructure/markdown/parser.rs`.
- [ ] Parse headings.
- [ ] Parse paragraphs.
- [ ] Parse list items.
- [ ] Parse code blocks.
- [ ] Parse tables where practical.
- [ ] Preserve deterministic block order.
- [ ] Return domain `MarkdownBlock` values.
- [ ] Add parser fixtures for common Markdown.

### P3.3 Text Normalization

- [ ] Define whitespace normalization rules.
- [ ] Define punctuation handling rules.
- [ ] Normalize Markdown formatting away where appropriate.
- [ ] Keep code block text stable.
- [ ] Add tests for headings, paragraphs, lists, and code blocks.

### P3.4 Hashing

- [ ] Add `infrastructure/markdown/hash.rs`.
- [ ] Generate SHA-256 hash for normalized block text.
- [ ] Store prefix length policy.
- [ ] Add `TextHash` construction helper.
- [ ] Add tests for stable hash output.
- [ ] Add tests for changed text producing changed hash.

### P3.5 Anchor Creation Support

- [ ] Return block metadata with Markdown read response.
- [ ] Include block type.
- [ ] Include block index.
- [ ] Include text hash.
- [ ] Include text snippet.
- [ ] Include optional source/char range support.
- [ ] Update frontend anchor creation to use backend metadata when possible.

### P3.6 Anchor Resolution Use Case

- [ ] Add `resolve_comment_anchors` use case.
- [ ] Match by `blockType` and `blockIndex`.
- [ ] Validate matched block hash when available.
- [ ] Fall back to full-document hash lookup.
- [ ] Fall back to snippet lookup.
- [ ] Return resolved block target or orphaned state.
- [ ] Preserve original anchor data.

### P3.7 Fuzzy Matching

- [ ] Define minimum snippet length.
- [ ] Define case sensitivity policy.
- [ ] Define whitespace-insensitive matching.
- [ ] Handle multiple snippet matches deterministically.
- [ ] Mark ambiguous matches as low confidence or orphaned.
- [ ] Add tests for duplicate text.

### P3.8 Orphan Handling

- [ ] Add `AnchorResolutionStatus` domain type.
- [ ] Add `resolved`, `moved`, `fuzzy`, and `orphaned` states if useful.
- [ ] Include resolution status in comment response DTOs.
- [ ] Show orphaned comments in sidebar.
- [ ] Disable jump action for orphaned comments.
- [ ] Preserve orphaned comments in JSON.

### P3.9 Frontend Highlight Reconciliation

- [ ] Reconcile resolved anchors with rendered block data attributes.
- [ ] Highlight exact block when range is unavailable.
- [ ] Highlight selected range when range is reliable.
- [ ] Handle moved/fuzzy comments with distinct style.
- [ ] Keep resolved comments visually subdued.
- [ ] Add active comment scroll behavior.

### P3.10 File Watching Strategy

- [ ] Decide between Tauri fs plugin watch and `notify`.
- [ ] Add backend watcher or frontend-triggered reload.
- [ ] Watch current Markdown file.
- [ ] Watch config file where practical.
- [ ] Debounce rapid file changes.
- [ ] Re-read Markdown after change.
- [ ] Re-resolve comments after change.
- [ ] Surface reload errors in UI.

### P3.11 Refresh UI

- [ ] Add refresh button to toolbar.
- [ ] Add manual reload command.
- [ ] Show stale/loading state during reload.
- [ ] Preserve selected spec and tab during reload.
- [ ] Preserve active comment where possible.

### P3.12 Edge Case Coverage

- [ ] Empty Markdown file.
- [ ] Markdown with only headings.
- [ ] Duplicate paragraph text.
- [ ] Multiple identical headings.
- [ ] Deleted block with snippet elsewhere.
- [ ] Renamed file through config.
- [ ] Deleted active Markdown file.
- [ ] Malformed comment JSON during resolution.
