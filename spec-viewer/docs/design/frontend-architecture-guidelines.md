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
| `shared/domain/isoDateTime` | `IsoDateTimeString` | Shared Kernel / #106 | Comment and review records exchange the same persisted timestamp vocabulary. Runtime decoding remains owned by #110 and aggregate validation by #120. |
| `shared/domain/specViewSelection` | `SpecViewSelection`, `SelectionIdentity`, `SpecViewFileTarget`, `SpecViewReviewTarget` | Shared Kernel / #106, behavior from #128 | App composition, specs watching, comments, and review runs must share one selection transition and stale-result identity rule. |

`WorkspacePath` remains the pre-existing Shared Kernel path identity used by the
selection aggregate. The registry does not admit similarly shaped feature DTOs.
The following projections remain with their feature owner:

| Projection | Owner and public boundary | Why it is not Shared Kernel |
| --- | --- | --- |
| `CommentScope` | comments / `@/features/comments` | It projects a selected file into comment-list and mutation inputs. |
| `ExportCommentsTarget` | comments / `@/features/comments` | It is a comments export transport shape and includes workspace export. |
| `UserReviewTarget` | review-runs / `@/features/review-runs` | It is a review command projection. Its raw DTO-compatible `specId` remains until #110 separates DTO decoding from domain identities. |
| Watch command and subscriber types | specs / `@/features/specs` | They are specs infrastructure ports, not domain vocabulary. |
| `ThemeMode` | preferences / `@/features/preferences` | It is a preferences-owned policy exposed for UI composition. |

### Issue #106 acceptance boundary

Issue #106 removes all 42 waivers it owns: 30 cross-feature deep imports, nine
domain dependency violations, and three package-cycle edges. It adds no replacement
waiver.

The literal repository-wide cross-feature deep-import count is not yet zero.
`features/specs/components/MarkdownViewer/index.tsx` retains five exact deep-import
waivers and the `features/specs -> features/comments` cycle waiver owned by #108.
Those six entries predate #106 and remain visible in `waivers.json`; moving comment
composition out of MarkdownViewer belongs to #108. The #104 ledger must therefore
not claim repository-wide zero until #108 removes them.

### PR #28 supersede map

[PR #28](https://github.com/DIO0550/spec-viewer/pull/28) is conflicting and is not
merged or cherry-picked. Its useful boundary intent is reapplied against the current
architecture in small, issue-owned changes:

| PR #28 work | Current owner / replacement |
| --- | --- |
| `a72ad162` shared timestamp and file-key types | #106 uses the approved `shared/domain/isoDateTime` and `shared/domain/specFileKey` leaves rather than a miscellaneous `shared/types` barrel. |
| `e5633e5` specs/comments import changes | #106 assigns canonical owners and exposes comments/specs non-domain APIs from each feature root. |
| `c238816` review-runs import changes | #106 uses exact Shared Kernel leaves and keeps `UserReviewTarget` as a review-owned projection instead of deriving it from a comments DTO. |
| MarkdownViewer/comments integration follow-up | #108 owns the app-composition extraction and its six exact waivers. |
| `shared/api/tauri` reverse-dependency follow-up | #107 owns feature-specific Tauri adapters and its existing exact waivers. |
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
