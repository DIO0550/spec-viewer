# P3.7 Fuzzy Matching

## Tasks

- [x] Define minimum snippet length.
- [x] Define case sensitivity policy.
- [x] Define whitespace-insensitive matching.
- [x] Handle multiple snippet matches deterministically.
- [x] Mark ambiguous matches as low confidence or orphaned.
- [x] Add tests for duplicate text.

## Done When

- Snippet fallback behaves predictably and avoids surprising attachments.

## Completion Note

Implemented fuzzy anchor matching in the comment resolution use case with an 8-character minimum snippet length, case-insensitive and whitespace-insensitive comparison, scored fuzzy candidates, nearest-index tie breaking, same-type filtering, and orphaning for ambiguous duplicate matches. Added Rust unit coverage for typo, reworded/moved, low-score, tie-breaker, duplicate, block type, and short-snippet behavior. Implementation commit: `664b7ef`.
