# Frontend architecture guidelines

This document defines the ownership and dependency rules for the frontend under
`src/`. It is the shared baseline for the migration work tracked by Epic #104.

## Dependency direction

```text
app composition -> feature public APIs
presentation -> application -> domain
infrastructure -> application ports + domain
shared kernel -> no feature
domain -> no outer layer
```

The application layer declares the ports required by a use case. Infrastructure
implements those ports. App composition creates adapters and passes them into
application or presentation code. A domain module never reaches outward to obtain
an adapter by itself.

## Layer ownership

| Layer | Owns | Must not own |
| --- | --- | --- |
| Domain | Entities, value objects, aggregates, policies, invariants, domain errors | React state, Tauri DTOs, storage, localized copy, DOM processing |
| Application | Use-case orchestration, input/output models, ports, stale-result policy | JSX, browser/Tauri calls, persistence details |
| Infrastructure | Tauri IPC adapters, runtime DTO decoding, storage repositories | Business eligibility and state-transition rules |
| Presentation | React components, hooks, view state, event adaptation | Domain invariants and direct cross-feature wiring |
| App composition | Adapter construction, dependency injection, cross-feature UI composition | Reusable domain behavior |
| Shared Kernel | Stable domain vocabulary genuinely shared by multiple features | Feature-specific workflows, adapters, hooks, components |

### Domain examples

Good:

```ts
import { WorkspacePath } from "@/shared/domain/workspacePath";
import type { SpecFileKey } from "../specFile";
```

Bad:

```ts
import { invoke } from "@tauri-apps/api/core";
import { listSpecs } from "@/shared/api/tauri";
import { useSpecs } from "@/features/specs/hooks/useSpecs";
```

The first pair uses domain vocabulary. The second group makes domain behavior
depend on a runtime adapter or React lifecycle.

### Application examples

Good:

```ts
import type { SpecRepository } from "../ports/specRepository";
import { SpecTree } from "../domain/specTree";
```

Bad:

```ts
import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
```

Application use cases orchestrate domain objects through declared ports. They do
not select a concrete transport or depend on component lifecycle.

### Infrastructure examples

Good:

```ts
import type { SpecRepository } from "../../application/ports/specRepository";
import { invokeTauriCommand } from "@/shared/api/tauri/invokeTauriCommand";
```

Bad:

```ts
export const canArchive = (node) => node.children.length === 0;
```

An adapter may translate DTOs and implement a port. Archive eligibility belongs to
a domain policy rather than an IPC or storage adapter.

### Presentation examples

Good:

```ts
import { useOpenWorkspace } from "../../application/useOpenWorkspace";
import type { WorkspaceViewState } from "./workspaceViewState";
```

Bad:

```ts
import { CommentListState } from "@/features/comments/domain/commentListState";
import { invoke } from "@tauri-apps/api/core";
```

Presentation adapts user events and renders use-case state. It neither deep-imports
another feature nor calls a transport directly.

### App composition examples

Good:

```ts
import { CommentsFeature } from "@/features/comments";
import { SpecsFeature } from "@/features/specs";
```

Bad:

```ts
import { CommentScope } from "@/features/comments/domain/commentScope";
```

Composition may connect multiple feature public APIs and inject adapters. It does
not reach into feature internals or reimplement their policies.

### Shared Kernel examples

Good:

```ts
export { WorkspacePath } from "./domain/workspacePath";
```

Bad:

```ts
export type { Comment } from "@/features/comments/types/comment";
```

Shared Kernel vocabulary is pure and feature-independent. Re-exporting a feature
type from shared reverses the dependency direction.

## Feature boundaries

Each feature exposes its supported API from `src/features/<feature>/index.ts`.
Consumers outside that feature import only the feature root:

```ts
import { SpecTree } from "@/features/specs";
```

An aggregate `@/features` barrel is prohibited because it hides feature ownership.

An import into another feature's `domain/`, `types/`, `hooks/`, `components/`,
`infra/`, or `lib/` directory is a deep import and is prohibited. Internal modules
inside the same feature may import one another while that feature is being migrated.
App composition is the owner of cross-feature wiring; a feature must not absorb a
second feature's presentation workflow merely for convenience.

`src/shared/` never imports `src/features/`. A type needed on both sides must move
to an approved Shared Kernel location or belong to the feature adapter that uses it.

## Shared Kernel admission

A type or policy belongs in `shared/domain/` only when all of these are true:

1. At least two features use the same domain meaning, not merely the same shape.
2. The name is part of the product's stable ubiquitous language.
3. It has no React, DOM, Tauri, storage, localization, or feature dependency.
4. One migration Issue owns its public API and removal plan if the concept changes.

Generic helpers without domain meaning belong in `shared/lib/`. Shared UI belongs
in `shared/ui/`; neither location is automatically part of the Shared Kernel.

### Approved Shared Kernel registry

Issue #106 admits the following narrow leaves. Consumers import the exact leaf;
`shared/domain` does not expose an aggregate barrel.

| Public leaf | Vocabulary | Canonical owner | Why the meaning is shared |
| --- | --- | --- | --- |
| `shared/domain/specFileKey` | `SpecFileKey` | Shared Kernel / #106 | Specs, comments, and review runs identify the same logical planning document. |
| `shared/domain/specId` | `SpecId` | Shared Kernel / #106 | Selection, comment, watch, and review targets refer to the same spec identity. |
| `shared/domain/commentId` | `CommentId` | Shared Kernel / #106 | Comments own the aggregate, while review bundles preserve those same comment identities. |
| `shared/domain/isoDateTime` | `IsoDateTimeString` | Shared Kernel / #106 | Comment and review records exchange the same persisted timestamp vocabulary. Runtime decoding is enforced by #110; aggregate validation remains owned by #120. |
| `shared/domain/specViewSelection` | `SpecViewSelection`, `SelectionIdentity`, `SpecViewFileTarget`, `SpecViewReviewTarget` | Shared Kernel / #106, behavior from #128 | App composition, specs watching, comments, and review runs must share one selection transition and stale-result identity rule. |

`WorkspacePath` remains the pre-existing Shared Kernel path identity used by the
selection aggregate. The registry does not admit similarly shaped feature DTOs.
The following projections remain with their feature owner:

| Projection | Owner and public boundary | Why it is not Shared Kernel |
| --- | --- | --- |
| `CommentScope` | comments / `@/features/comments` | It projects a selected file into comment-list and mutation inputs. |
| `ExportCommentsTarget` | comments / `@/features/comments` | It is a comments export transport shape and includes workspace export. |
| `UserReviewTarget` | review-runs / `@/features/review-runs` | It is a review command projection. Its transport DTO is separated by #110; validated domain identities remain owned by #111. |
| Watch command and subscriber types | specs / `@/features/specs` | They are specs application ports implemented by the Tauri adapter, not domain vocabulary. |
| `ThemeMode` | preferences / `@/features/preferences` | It is a preferences-owned policy exposed for UI composition. |

### Issue #106 acceptance boundary

Issue #106 removes all 42 waivers it owns: 30 cross-feature deep imports, nine
domain dependency violations, and three package-cycle edges. It adds no replacement
waiver.

The literal repository-wide cross-feature deep-import count is not yet zero.
`features/specs/components/MarkdownViewer/index.tsx` retains five exact deep-import
waivers owned by #108. Moving comment composition out of MarkdownViewer belongs to
#108. The package-cycle edge previously owned by #108 became stale when #107 removed
the reverse `shared -> features/*` dependencies, so #107 removes that exact cycle
waiver without hiding the five remaining deep imports. The #104 ledger must not
claim repository-wide zero until #108 removes them.

### Issue #107 acceptance boundary

Issue #107 leaves `shared/api/tauri` with the generic
`invokeTauriCommand` transport kernel and transport-level
error compatibility only. Command names, request/response contracts, codecs,
command-specific errors, concrete gateways, dialogs, drag-and-drop, file-watch
subscriptions, and recent-workspace storage belong to comments, specs, workspace,
or review-runs.

Feature hooks and test doubles type their dependencies through feature-owned
application ports. The sole production import of `@tauri-apps/api/core` is
`shared/api/tauri/invokeTauriCommand.ts`; the architecture checker rejects any
other production dependency on that raw transport module.

### Issue #109 acceptance boundary

Issue #109 leaves comments, specs, workspace, and review-runs domain errors with
domain reasons only. Domain reasons do not reuse backend wire-code literals and
contain no command name, localized/display message, raw payload, or Tauri command
error type.

Each feature has one Tauri error mapper that selects the command-specific parser,
maps the parsed command code to a domain reason, and builds the application error
used by hooks and presenters. Application errors retain the existing display
`code` and `message`; the underlying command error is their `cause`. The
command error keeps the rejected transport payload in its own `cause`, so
diagnostic data remains at the infrastructure boundary.

The backend migration in #77 is not required for this frontend boundary. Until it
lands, the existing command names and known wire `code` / `message` payloads
remain compatibility contracts covered by wrapper and mapper tests. Unknown and
non-domain wire codes continue to use the established unknown display behavior.

All 16 `domain-forbidden-dependency` waivers owned by #109 are removed. The five
MarkdownViewer deep-import waivers owned by #108 remain exact and visible.
Waivers owned by #118 and #120 remain unchanged; generic domain state
containers accept application errors without absorbing their display or transport
shape.

### Issue #110 acceptance boundary

All Tauri command successes enter the frontend as `unknown`. The shared runtime
codec reports the first invalid field with its command, path, expected shape, and
actual runtime kind. Each workspace, spec, watch, comment, and review-run adapter
defines its own wire DTO and converts it through a feature-owned anti-corruption
layer before returning domain or application values.

Request encoders perform the reverse conversion from domain-facing requests to
wire DTOs. Command names and serialized request/response fields remain unchanged.
Watch and workspace drag/drop event payloads use the same runtime-decoding rule.
Review lifecycle restoration rejects contradictory `status` / `archivedAt`
combinations before a `UserReview` reaches application state.

The three `domain-forbidden-dependency` waivers owned by #110 are removed. Review
list problems and workspace mode now live in review-run domain vocabulary. Waivers
owned by #108, #118, and #120 remain exact and unchanged.

### Issue #111 validated identity boundary

`SpecId`, `CommentId`, `UserReviewId`, and `IsoDateTime` are validated value
objects inside domain and application APIs. `parse` accepts values that may be
newly issued, while `fromDto` restores persisted or wire values. Both return a
typed result; neither constructor exposes an unchecked brand cast. `toString` is
reserved for DOM and display leaves, and `toDto` is reserved for serialization.

The restore policy mirrors backend persistence behavior while issuance remains strict:

| Value object | Newly issued / parsed form | Restored legacy form |
| --- | --- | --- |
| `SpecId` | non-empty, normalized, safe relative path components without `:` | the same safe path form; there is no unsafe legacy escape hatch |
| `CommentId` | `cmt_` plus 32 lowercase hexadecimal characters, without implicit trim | any existing non-empty identifier; outer whitespace is normalized only while restoring |
| `UserReviewId` | `urv_` plus 32 lowercase hexadecimal characters, without implicit trim | the timestamp-based `...-spec` or `...-file-<key>` review folder names emitted before v1 IDs, also without implicit trim |
| `IsoDateTime` | a calendar-valid RFC 3339 date-time | the same RFC 3339 form; invalid persisted timestamps are rejected |

The cross-runtime golden cases live in
`src-tauri/tests/fixtures/identity-value-object-contracts.json`. Frontend value
object tests import that file directly, and its accepted and rejected examples
mirror the backend identity, UUID-generation, review-folder, and timestamp
contracts introduced by #54, #55, #56, and #59. A format change must update this
single fixture together with both runtime contracts; it must not silently widen
`fromDto`.

Raw identity strings remain only in feature-owned IPC DTOs and explicit output,
DOM, or display projections. Codec restoration failures retain the command name,
the deepest JSON path, the `invalidResponse` reason, and the expected value-object
shape before application state can observe a value.

### PR #28 supersede map

[PR #28](https://github.com/DIO0550/spec-viewer/pull/28) is conflicting and is not
merged or cherry-picked. Its useful boundary intent is reapplied against the current
architecture in small, issue-owned changes:

| PR #28 work | Current owner / replacement |
| --- | --- |
| `a72ad162` shared timestamp and file-key types | #106 uses the approved `shared/domain/isoDateTime` and `shared/domain/specFileKey` leaves rather than a miscellaneous `shared/types` barrel. |
| `e5633e5` specs/comments import changes | #106 assigns canonical owners and exposes comments/specs non-domain APIs from each feature root. |
| `c238816` review-runs import changes | #106 uses exact Shared Kernel leaves and keeps `UserReviewTarget` as a review-owned projection instead of deriving it from a comments DTO. |
| MarkdownViewer/comments integration follow-up | #108 owns the app-composition extraction and its five remaining exact deep-import waivers. |
| `shared/api/tauri` reverse-dependency follow-up | #107 moves feature-specific adapters to their owners and removes all 32 waivers it owned. |
| Bulk test renames, lint formatting, accessibility changes, and JSDoc commits | Not reused by #106; they are unrelated to the ownership migration and would expand its behavioral surface. |

## Automated checks

Run the checks from `spec-viewer/`:

```bash
pnpm architecture:test
pnpm architecture:check
```

The checker uses the TypeScript parser and covers static imports, type-only imports,
re-exports, dynamic imports, import types, aliases, and relative paths. It checks
production `.ts` and `.tsx` modules for:

- internal imports from `features/*/domain` outside its own domain or the approved
  `shared/domain` kernel, plus React/JSX and Tauri dependencies; pure external
  libraries remain eligible domain implementation dependencies;
- `shared` dependencies on a feature;
- cross-feature deep imports that bypass a feature root API;
- raw `@tauri-apps/api/core` dependencies outside the canonical
  `shared/api/tauri/invokeTauriCommand.ts` transport kernel;
- package dependency edges that participate in a cycle.

Files in `__tests__/` or `testing/`, plus `*.test.*`, `*.spec.*`, and `*.stories.*`,
are test composition rather than production dependencies and are excluded. Their
code remains covered by typecheck, lint, and the applicable test runner.

Frontend CI runs both architecture commands before typecheck and the Vitest suite.

## Migration waivers

Existing violations are recorded in
`scripts/frontend-architecture/waivers.json` as an exact tuple of rule, source,
specifier, and owning Issue. Wildcards and ownerless waivers are not accepted.

The checker fails when:

- a new violation has no exact waiver;
- a waiver is duplicated or malformed;
- a violation is removed but its now-stale waiver remains.

When a migration Issue removes an edge, it must remove the matching waiver in the
same PR. A waiver is a deletion checklist, not a permanent exception.

## Epic #104 migration map

Every child Issue applies this guide and removes only the waivers or responsibilities
it owns.

| Issues | Boundary work |
| --- | --- |
| #106 | Shared Kernel ownership and feature public APIs |
| #107 | Feature-owned IPC infrastructure and removal of `shared -> features` |
| #108 | Markdown/comment composition at the app boundary |
| #109 | Domain errors independent of Tauri command errors |
| #110-#111 | Runtime DTO decoding and validated identity/value objects |
| #112-#119 | Workspace, spec tree, document, and watch domain/application boundaries |
| #89, #120-#127 | Comment, anchor, query, export, and feedback boundaries |
| #128-#130 | Selection and user-review domain/application boundaries |

The final #104 migration ledger verifies that every owned waiver was removed or has
an explicitly scheduled successor before the Epic closes.
