# Frontend shared vocabulary and public APIs

[Issue #106](https://github.com/DIO0550/spec-viewer/issues/106) implements the
ownership rules in [frontend architecture guidelines](./frontend-architecture-guidelines.md).
The registry in `scripts/architecture/policy.json` is the executable approval list.

## Shared Kernel registry

Only the following stable vocabulary and existing pure type operations are approved.
Ownership means responsibility for semantics and compatibility, not the current file location.

| Type | Public entry | Owner | Why shared |
| --- | --- | --- | --- |
| `SpecFileKey` | `@/shared/kernel/specFileKey` | Shared Kernel, jointly maintained by Specs, Comments and Diff | The same nine configured logical document keys identify spec selections, comment anchors and spec diffs. A key is independent of rendering, command payloads and feature state. |
| `IsoDateTimeString` | `@/shared/kernel/isoDateTimeString` | Shared Kernel, jointly maintained by Comments and DiffComments | Creation/update instants have the same meaning in spec comments, diff comments and replies. The alias stays string-compatible; each boundary retains its existing decoding/validation. This is not a new RFC3339 validator or brand. |
| `WorkspacePath` | `@/domains/workspacePath` | Shared workspace identity; Workspace maintains conversion semantics | Comments, Specs and composition refer to the same workspace root. The existing brand/conversions remain unchanged; validation hardening belongs to #112. |
| `Brand` | `@/types/utilityTypes` | Shared type utilities | Workspace and Preferences distinguish domain values without runtime properties or a dependency on another feature. |
| `ArrayValueOf`, `ValueOf` | `@/types/utilityTypes` | Shared type utilities | Existing pure type projections, with no feature, UI or transport semantics. They remain under the original #105 approval. |

`SpecFileKey` remains re-exported by the Specs root/domain APIs and its legacy internal
spec type module. `IsoDateTimeString` is re-exported by Comments and DiffComments;
the old Comments domain export remains compatible. There is one definition of each
alias, and `src/tests/sharedKernel.contracts.test.ts` checks exact type compatibility.
`DiffCommentRevision` stays in the DiffComments root API.
No new generic `Id`, catch-all shared DTO module, or runtime timestamp behavior is added.

## Owner-feature domain APIs

Domain consumers use the explicitly certified `domain/index.ts` entry, never the
root barrel containing React components and Tauri adapters. UI/composition consumers
may use the feature root. Same-feature code can still use its own internal modules.

| Vocabulary | Owner / approved entry | Why it stays there |
| --- | --- | --- |
| `SpecId`, `SelectionIdentity`, `SpecViewSelection`, spec review/file targets | Specs: `@/features/specs/domain` | Selection validity and identity are Specs rules. Comments consumes the canonical selection contract. |
| `FileDiff`, `Hunk`, `StructuredDiff`, file review/projection types | Diff: `@/features/diff/domain` | RepositoryDiff reuses Diff semantics without owning them or importing viewer UI. |
| `NavigationHistory`, `NavigationHistoryKey`, `ViewMode`, `Workspace`, `WorkspaceKind` | Workspace: `@/features/workspace/domain` | Navigation is scoped by workspace/worktree/mode. `ViewMode` now lives in domain; its old `types/viewMode` entry re-exports it. |
| `DiffReviewIdentity` | DiffComments: `@/features/diffComments/domain` | Snapshot-bound review identity belongs to DiffComments. The #107 approval remains unchanged. |
| `CommentId`, comment state/filter/scope | Comments: `@/features/comments` | These are comment-specific concepts; their consumers are currently UI/composition, so no extra domain entry is required. |

Feature-specific request/response types and export DTOs stay with their owner feature.
`ExportCommentsTarget` is a Comments export contract, not a source for another domain's
review target. DOM projections, watch subscriptions and UI components are exposed from
feature root APIs, not the Shared Kernel or certified domain entries.

## Migration and regression boundary

The #106 migration removes all 51 production `feature-public-api` violations, including
composition and `src/utils/recentWorkspaces`. It deletes 80 resolved exception entries.
The checker regression inspects raw violations before exceptions, so a new exception
cannot silently restore a production deep import. Certified domain API closures and
Kernel purity are also checked, together with cycles that cross a feature boundary or
enter a Kernel. Type-only dependencies count for these boundary/cycle checks.

The remaining 59 pre-existing exceptions are 47 non-production feature-boundary edges,
10 non-production shared-to-feature edges, and two Specs domain-to-legacy-type edges
tracked by #110. Tests/Storybook fixtures are not promoted into production APIs just
to remove their exceptions.

This migration does not claim the entire repository has no import cycles: existing
feature-local root-barrel cycles in error handling predate it. Removing those by
importing concrete infra from hooks would undo #107's dependency direction; error
model cleanup remains separate (#109). The new Kernel/domain APIs introduce no cycles,
and no production cycle crosses feature ownership boundaries.

## Relationship to PR #28

[PR #28](https://github.com/DIO0550/spec-viewer/pull/28) was closed without merging on
2026-09-22. This change supersedes its valid shared-vocabulary and public-API intent,
reapplied narrowly to current main after #107 / PR #260. Its repository-wide formatting,
JSDoc and unrelated UI/test changes are deliberately not reapplied.

The original #106 report referred to `review-runs` and a target derived with
`Extract<ExportCommentsTarget, ...>`. That feature is no longer present on the current
base. It is not restored; the live review target is owned by Specs selection semantics.
The current timestamp consumers are Comments and DiffComments.
