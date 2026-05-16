# P3.9 Frontend Highlight Reconciliation

## Tasks

- [x] Reconcile resolved anchors with rendered block data attributes.
- [x] Highlight exact block when range is unavailable.
- [x] Highlight selected range when range is reliable.
- [x] Handle moved/fuzzy comments with distinct style.
- [x] Keep resolved comments visually subdued.
- [x] Add active comment scroll behavior.

## Done When

- Comment highlights reflect backend resolution status.

## Completion Note

Implemented frontend highlight reconciliation for exact, moved, fuzzy, orphaned, and stale anchors. The existing list comments command now returns anchor resolution metadata for the active Markdown file, and the UI displays range highlights, target block highlights, and sidebar status treatments from that metadata.

Implementation commit: recorded in the final P3.9 commit.
