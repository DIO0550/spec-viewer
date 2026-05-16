# P2.3 Comment Repository Contract

## Tasks

- [x] Define repository trait for comment persistence behavior.
- [x] Add `list` method signature.
- [x] Add `add` method signature.
- [x] Add `update` method signature.
- [x] Add `delete` method signature.
- [x] Add `replace_all` only if needed for resolution updates.
- [x] Keep storage path details out of the trait API.

## Done When

- Use cases can depend on the repository contract instead of JSON files directly.

## Completion Note

Implemented a domain-only comment repository contract with comment scope, list query filters, repository errors, and a spec id value object. Omitted `replace_all` because resolution changes can be represented through the `update` contract. Verified with `cargo fmt` and `cargo test`.
Commit: c2b1486b1e8defdcb97df4b763bf804d79bbb4c5
