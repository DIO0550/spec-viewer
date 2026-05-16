# P3.4 Hashing

## Tasks

- [x] Add `infrastructure/markdown/hash.rs`.
- [x] Generate SHA-256 hash for normalized block text.
- [x] Store prefix length policy.
- [x] Add `TextHash` construction helper.
- [x] Add tests for stable hash output.
- [x] Add tests for changed text producing changed hash.

## Done When

- Block hash fallback is deterministic and covered by tests.

## Completion Note

Implemented stable `sha256:<8 hex>` hashes for normalized Markdown block text, attached hashes to parsed `MarkdownBlock` values, and covered deterministic, empty, changed, equivalent-normalized, and code/prose hash cases in Rust tests. Implementation commit hash is recorded in the final task response after commit creation.
