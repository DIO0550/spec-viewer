# Repository diff backend contract

Issue #201 adds an additive repository-wide comparison backend. Existing Spec and
comment commands are unchanged.

## Comparison model

- The left side is the merge-base of the resolved base ref and HEAD.
- The right side combines committed, index, working-tree, and untracked state.
- currentSnapshotId uses rs1_ plus 64 lowercase hex characters and is shared by views.
- Invalid explicit overrides never fall back to inferred candidates.
- Priority is explicit, gh-merge-base, current remote HEAD, origin HEAD, one
  unambiguous other remote HEAD, main, then master.

worktreeId is interpreted as the selected worktree root only at the infrastructure
boundary. Domain code keeps it opaque.

## Commands

All fields use camelCase.

| Command | Request | Result |
| --- | --- | --- |
| load_repository_diff | worktreeId, optional baseOverride | base, IDs, changedTree, allRoot, warnings |
| traverse_repository_ignored | worktreeId, currentSnapshotId, nodeId, cursor | up to 200 entries |
| load_repository_file | worktreeId, currentSnapshotId, path | bounded old/new text, structured hunks, symlink/submodule metadata |

Consumers reload overview after staleBase or staleSnapshot. Errors retain stable codes.

## Fixed safety policy

| Limit | Value |
| --- | ---: |
| metadata/content timeout | 15 / 30 seconds |
| stdout/stderr | 32 MiB / 1 MiB |
| content per side | 1 MiB |
| patch | 2 MiB |
| ignored page | 200 |
| binary probe | NUL in first 8 KiB |
| rename/copy | 50%, candidate limit 1000 |

Git is launched directly with argument arrays. Timeout or output-cap detection kills and
reaps the child and joins both bounded readers; partial output is never parsed. Paths are strict UTF-8 repository-relative identities.

Snapshot SHA-256 input is version-framed and includes repository/worktree identity,
HEAD, index records, sorted tracked current bytes, symlink targets, parent-visible
submodule state, and sorted untracked paths/content. It excludes rename/copy
classification, display values, timestamps, locale, and enumeration order.

Changed and All are returned as sorted hierarchical nodes. Normal directories have
Loaded children; ignored directory roots have Deferred children with an opaque node ID.
The ic1 cursor binds snapshot ID, node ID, the complete immediate-listing fingerprint,
and the next sorted offset. File review preserves full-content availability independently
from structured-diff omission at the 2 MiB / 20,000-line limits.


## Snapshot and consistency details

The canonical snapshot stream starts with `spec-viewer.repository-snapshot\0`, a
version byte, length-framed repository and canonical per-worktree Git identities, HEAD,
index stage records, sorted tracked current records, and sorted untracked records. Entry
kind tags distinguish missing, symlink, regular file, submodule, and unsupported entries.
Regular contents are hashed in 64 KiB chunks, including binary and large files. The
implementation rechecks HEAD, index, tracked paths, and untracked paths, and retries once
when a read race is observed. A second race returns `entryChangedDuringRead`.

The overview rechecks both merge-base and current snapshot before publication. File
review uses the resolved base and logical Changed records bound to the same snapshot, so
an explicit base override is preserved for old content. File and submodule responses
recheck the snapshot before returning.

## Tree and content contract

- Changed keeps rename/copy as one logical entry. Deleted entries use the base path; all
  other entries use the current path.
- All is current tracked/untracked/ignored files unioned with base-only deleted entries.
  Git metadata is never returned. Root ignored files are loaded nodes; ignored directories
  are deferred nodes.
- A lazy page returns the same `nodeId`, typed immediate child nodes, and at most 200
  entries. Nested ignored directories receive another deferred node ID.
- Cursor validation distinguishes `staleSnapshot`, `staleCursor`, and `invalidCursor`.
  The listing fingerprint contains every immediate child path, kind, size, and nanosecond
  mtime availability. This is an optimistic listing token; same-size changes inside a
  filesystem mtime resolution window are not a content transaction.
- Regular content is preflighted and bounded to 1 MiB per side. Binary classification is
  orthogonal to added/modified/deleted/renamed/copied/typeChanged/untracked.
- Structured hunks are all-or-nothing: collection stops at 2 MiB + 1 byte and parsing
  omits the whole result above 20,000 hunk lines. Full old/new content remains independent.
- Symlinks return only the target text and are never followed. Submodules return base,
  index, and worktree OIDs plus commit/tracked/untracked/uninitialized flags without
  recursively exposing submodule paths. Mode-only changes retain old/new mode and empty
  hunks.
- Canonical parent checks reject intermediate symlink escapes before reading content.

## Frontend viewer projection contract

The Spec decoder and repository adapter expose the same source-independent `FileDiff`
shape to `DiffViewer`. The generic identity is `sourceId` plus logical `path`; Spec
uses `spec:<specId>` and repository uses `repository:<worktreeId>`. Wire-only fields
remain at their source boundary.

`availability` is derived before rendering and is one of `ready`, `empty`, `omitted`,
or `missing`. `Unified` and `Split` are the public viewer modes and map to the
existing `inline` and `sideBySide` row projections. Added/untracked old-only and
deleted new-only text files remain renderable with a semantic blank counterpart cell;
binary, unsupported, oversized, and unexpected missing-side reviews render a status
message instead of an interactive grid.

## Issue #195 frontend tree contract

Issue #195 consumes the repository-wide overview from #201 and the snapshot-bound
IPC/decoder contract from #202 while preserving the domain separation established
by #191.

- Changed and All are Diff-local filters inside the existing Diff mode. Changed
  projects changedTree; All projects allRoot and may append lazy ignored pages.
- The summary is derived locally: Changed uses overview.changed.length, All uses
  overview.allPaths.length, changedPaths and status counts use overview.changed,
  and ignoredDirectoryCount uses overview.ignoredDirectories.length. Lazy page
  entries never inflate the logical total, and no commit/staged/unstaged buckets are
  added.
- Navigation state is in-memory for the App session and keyed by workspace,
  worktree, and Diff. An unvisited repository starts at Changed with no selection or
  expansion; revisits restore filter, selected path, and expanded directories.
  Reconcile prunes paths that disappeared while retaining deferred/loading/failed
  directory expansion for retry.
- File detail and ignored traversal keep the overview currentSnapshotId.
  Overview, detail, and page responses are accepted only when their complete request
  identity and generation still match. Ignored page requests coalesce by
  worktree/snapshot/node/cursor, serialize per node, run at most two nodes at once,
  and retain a FIFO pending queue capped at 32.
- The RepositoryDiffTree exposes normal, loading, empty, error, stale, binary,
  deleted, unchanged, ignored, and submodule-safe states through controlled ARIA
  tree rows. The existing generic ChangesNavigation remains the Spec branch.
- No new Tauri command, filter argument, summary DTO field, or stage bucket is
  introduced; projection and session behavior remain on the frontend boundary.


## Typed outcomes

| Category | Stable outcomes |
| --- | --- |
| Base | resolved, needsSelection/notFound, ambiguousRemoteHead, detachedHead, shallowHistory, unbornHead, noCommonAncestor, invalidOverride/invalidRef, invalidOverride/missingRef |
| Repository | notRepository, bareRepository, worktreeUnavailable, commonDirBoundaryEscape |
| Process | gitUnavailable, gitTimedOut, gitOutputLimitExceeded, gitFailed |
| Path/read | unsupportedPathEncoding, invalidRepositoryPath, permissionDenied, entryChangedDuringRead |
| Consistency | staleBase, staleSnapshot, staleCursor, invalidCursor |
| Content | binary, largeFile, diffLimit, missingSide, unsupportedEntryKind |

Diagnostics expose operation names and sanitized bounded text only. Absolute filesystem
paths and raw control characters are not included in command error messages.

## ADR #191 compatibility

| ADR requirement | Implementation evidence |
| --- | --- |
| Validated explicit override, then gh/current remote/origin/other/main/master | `inferred_base_priority_preserves_source_and_remote_ambiguity` |
| Invalid or missing override never silently falls back | `validates_override_before_calling_port`, `base_resolution_keeps_missing_detached_unborn_and_disconnected_states` |
| Multiple other remote HEADs are ambiguous | `inferred_base_priority_preserves_source_and_remote_ambiguity` |
| Unborn, detached, shallow, deleted/disconnected base are explicit | `base_resolution_keeps_missing_detached_unborn_and_disconnected_states`, `shallow_history_without_merge_base_is_explicit_state` |
| Workspace and repository concepts remain separate domain modules | `domain/workspace/mod.rs`, `domain/repository/mod.rs` |
| Canonical common-dir handles linked/bare/deleted/escape variants | `repository_variants_keep_identity_and_typed_errors` |
| Opaque current snapshot covers committed/index/worktree/untracked | `overview_unifies_committed_staged_unstaged_and_untracked_changes` |

## Issue #201 traceability

| Acceptance area | Representative evidence |
| --- | --- |
| Committed, staged, unstaged, and untracked in one result | `overview_unifies_committed_staged_unstaged_and_untracked_changes` |
| Changed/All, ignored/generated, Git metadata exclusion, recursive lazy pages | `overview_unifies_committed_staged_unstaged_and_untracked_changes` |
| Added/modified/deleted/rename/copy/type/mode | `changed_records_cover_rename_copy_delete_type_and_mode` |
| Correct explicit-base old/new content | `file_review_reuses_the_explicit_base_bound_to_snapshot` |
| Binary and large omission with independent full content | `file_review_reports_binary_and_large_omissions_independently` |
| Structured diff limits | `structured_diff_is_atomic_at_byte_and_line_limits` |
| Symlink boundary and non-UTF-8 rejection | `intermediate_symlink_escape_is_rejected_before_content_read`, `non_utf8_repository_path_returns_typed_encoding_error` |
| Submodule summary without recursive diff | `submodule_review_reports_parent_visible_oids_and_dirty_flags` |
| Timeout/output cap lifecycle | `timeout_returns_typed_error_after_killing_and_reaping_child`, `stdout_cap_returns_typed_error_without_partial_output` |
| camelCase DTO and node/cursor contract | `lazy_request_uses_current_snapshot_and_opaque_node_id_fields`, `tree_and_structured_diff_serialize_with_camel_case_contract` |

## Issue #198 Diff comment contract

Diff comments are an additive v1 store and command family. They do not reuse or migrate
the Spec comment v2 document, command DTOs, anchors, export payload, MCP surface, or
unknown-field preservation behavior. Existing Spec v2 golden read-update-write tests
remain the compatibility authority.

### Identity and presentation DTOs

Repository and Spec Diff overviews are sources of the complete `DiffReviewIdentity`:

```ts
type DiffReviewIdentity = {
  repositoryId: `rr1_${string}`;
  worktreeId: `rw1_${string}`;
  baseSha: string;
  currentSnapshotId: `rs1_${string}`;
};
```

All load/save/update requests carry all four values unchanged. The frontend session and
backend source lookup are keyed by all four. The persisted v1 document stores only
`repositoryId` and `worktreeId`; immutable anchors store the historical four-value
identity. `displayWorktreeLabel` is presentation-only and is neither a key nor persisted.
Responses crossing repository/worktree scope are rejected by the strict frontend decoder.

The commands are `load_diff_comments(identity)`,
`save_diff_comment(identity, expectedRevision, target, body)`, and
`update_diff_comment(identity, expectedRevision, commentId, body?, resolved?)`.
Revision is a canonical decimal unsigned-u64 string. Lines are safe positive integers no
greater than `u32::MAX`; `candidateCount` is a safe non-negative u32. Paths are
canonical repository-relative UTF-8 values. Exact decoders reject unknown/retired fields,
invalid canonical IDs/hashes/revisions, mismatched document scope, and inconsistent
outcome revisions/warnings.

Runtime resolution is exhaustive and never persisted:

```ts
type DiffAnchorResolution =
  | { status: "exact" | "relocated"; selectionPath: string;
      sidePath: string; side: "base" | "current"; line: number }
  | { status: "stale"; reason: StaleAnchorReason; candidateCount: number }
  | { status: "unavailable"; reason: UnavailableReason; canJump: false };
```

`selectionPath` chooses the logical tree/tab entry while `sidePath` labels and focuses
the semantic base/current line. Stale and unavailable cards remain visible and cannot
jump. Warning summaries are derived presentation data; each comment's resolution remains
authoritative.

### Mutation outcome union and commit point

Successful atomic replacement is the commit point. Every mutation returns exactly one
discriminated outcome:

```ts
type DiffCommentMutationOutcome =
  | { kind: "committed"; document: ResolvedDiffComments; revision: string;
      resolutionWarnings: ResolutionWarning[];
      durability: "durable" | "uncertain" }
  | { kind: "conflict"; latestDocument: ResolvedDiffComments;
      latestRevision: string; resolutionWarnings: ResolutionWarning[] }
  | { kind: "preCommitFailure"; code: "revisionOverflow";
      currentDocument: ResolvedDiffComments; currentRevision: string;
      retryable: false }
  | { kind: "preCommitFailure"; code: "storeBusy" | "io"; retryable: true }
  | { kind: "preCommitFailure"; code: "permission" | "invalidStore";
      retryable: false };
```

Committed closes the origin draft. `durability: "uncertain"` is already committed, shows
a reload warning, and never exposes mutation retry. Conflict installs the latest document
while preserving and focusing the draft. Transient pre-commit failures alone expose
retry. Permission and invalid-store establish a document-level write block across create,
update, resolve, reopen, and re-anchor; it survives cancel/new-draft transitions and clears
only after a successful validated reload. Overflow establishes the same block permanently
because reload derives it again from the maximum revision. All three retain copyable text.
Overflow also reconciles the returned current document.

### Resolver deadline and cancellation

A load groups anchors by candidate side/path/snapshot, loads each source once, and builds
one hash index per loaded side. The total resolver deadline is monotonic
`RESOLUTION_TOTAL_DEADLINE_MS = 200`. Deadline/cancellation is checked immediately before
and after every external source load and before each index build. Once a structural
ceiling, deadline, or cancellation is observed, no later external load starts. Every
stored comment is still returned: the deterministic remaining suffix is
`unavailable/budgetExceeded` or `unavailable/cancelled` with `canJump: false`.

The structural ceilings are 10,000 comments/unique anchors, 100 files for the nominal
fixture, 64 MiB total source, 2,000,000 logical lines, and 2,048 Git loads. They complement
the deadline; they do not authorize omission or a guessed target.

The feature is additive. It does not add stage, commit, discard, arbitrary two-revision
selection, or submodule-recursive diff behavior.

## Issue #196 file review workspace contract

- Tree selection opens a persistent ordered tab immediately. Existing tabs retain
  their order. Active close selects the right neighbor, then the left neighbor, then
  no selection.
- Every file tab exposes its A/M/D/R/C/T/U token and localized label. The active
  tab controls one repository-diff-panel; roving focus and close shortcuts remain
  local to the tab strip.
- The shared toolbar owns Specs/Diff on the left, active file and revision/line
  summary in the center, and controlled Unified/Split/Editor controls on the right.
  Editor displays current content read-only and has no save or mutation path.
- Open paths, active path, viewer mode, and per-path jump targets are keyed by
  workspace/worktree/Diff for the application session. The key intentionally omits
  snapshot ID. Refresh rebinds the active path through the existing snapshot-safe
  detail loader and reconciles tabs against all repository logical paths.
- Detail payloads, base resolution, and snapshot identity are never copied into tab
  state. Stale overview/detail responses continue to be rejected by the existing
  request identity and generation checks.
