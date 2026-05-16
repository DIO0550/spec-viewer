# P3.6 Anchor Resolution Use Case

## Tasks

- [x] Add `resolve_comment_anchors` use case.
- [x] Match by `blockType` and `blockIndex`.
- [x] Validate matched block hash when available.
- [x] Fall back to full-document hash lookup.
- [x] Fall back to snippet lookup.
- [x] Return resolved block target or orphaned state.
- [x] Preserve original anchor data.

## Done When

- Existing comments can be resolved against current Markdown content.

## Completion Note

Implemented comment anchor resolution in the app use case layer with exact index/hash matching, moved-block hash lookup, stale snippet matching, index fallback, and missing/orphaned results. Added pure unit coverage for the expected resolution outcomes. Implementation commit hash is recorded in the final task response after commit creation.
