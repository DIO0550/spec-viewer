# P3.5 Anchor Creation Support

## Tasks

- [x] Return block metadata with Markdown read response.
- [x] Include block type.
- [x] Include block index.
- [x] Include text hash.
- [x] Include text snippet.
- [x] Include optional source/char range support.
- [x] Update frontend anchor creation to use backend metadata when possible.

## Done When

- New comments can store enough anchor data for robust future resolution.

## Completion Note

Implemented Markdown read block metadata responses backed by parsed block hashes, added domain/app helpers for creating anchors from parsed Markdown block metadata, and updated frontend selection drafts to prefer backend `sha256:*` block hashes when available. Implementation commit hash is recorded in the final task response after commit creation.
