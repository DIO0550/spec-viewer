# P1.3 Spec File Domain

## Goal

Model logical spec files and spec tree nodes for both the design-preferred workspace and compatibility mode.

## Tasks

- [x] Add `SpecFileKey` value object or enum.
- [x] Add default keys for `exploration`, `hearing`, `impl`, and `tasks`.
- [x] Add compatibility keys for `requirements`, `design`, and `tasks`.
- [x] Add display labels for each logical key.
- [x] Add `SpecFile` domain type.
- [x] Add `SpecNode` domain type for tree-compatible spec folders.

## Done When

- UI-facing labels can be produced without hard-coding tab names in React.
- Missing file state can be represented per logical key.

## Completion Note

Implemented spec file keys, UI-facing labels, per-file missing status, spec files, tree-compatible spec nodes, typed errors, and unit tests.
Commit: f571657da9dc3c8199f3a0e3f7f195c95b33b090.
