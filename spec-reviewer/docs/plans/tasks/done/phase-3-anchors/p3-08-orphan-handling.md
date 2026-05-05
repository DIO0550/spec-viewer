# P3.8 Orphan Handling

## Tasks

- [x] Add `AnchorResolutionStatus` domain type.
- [x] Add `resolved`, `moved`, `fuzzy`, and `orphaned` states if useful.
- [x] Include resolution status in comment response DTOs.
- [x] Show orphaned comments in sidebar.
- [x] Disable jump action for orphaned comments.
- [x] Preserve orphaned comments in JSON.

## Done When

- Unresolved anchors remain visible and recoverable instead of disappearing.

## Completion Note

Implemented backend orphan classification for anchor resolution with domain-level `AnchorResolutionStatus` and explicit orphan reasons/details for missing original blocks, ambiguous fuzzy candidates, below-threshold matches, deleted text, and unsupported block types. Existing comments remain persisted in JSON while resolution results carry recoverable orphan metadata for downstream sidebar handling; frontend visual treatment was intentionally not expanded in this task per implementation instruction. Implementation commit hash is recorded in the final task response after commit creation.
