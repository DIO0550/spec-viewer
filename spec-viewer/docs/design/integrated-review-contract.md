# Specs / Diff 統合レビュー Phase 1 contract

Status: Accepted / implemented. Product decision の正本は
[Issue #191 ADR](https://github.com/DIO0550/spec-viewer/issues/191) です。この文書は
ADR を現行 frontend / backend / IPC / persistence へ対応付ける開発者向け index です。

ユーザー操作は [統合レビュー利用ガイド](../integrated-review-guide.md)、repository
adapter の詳細は [Repository diff backend contract](./repository-diff-contract.md)、
comment の schema と復旧は [Diff comments](../diff-comments.md) を参照してください。

## Domain boundary と依存方向

```text
┌──────────────────────── Specs domain ──────────────────────────┐
│ SpecSource / SpecNode / SpecFileKey / SpecArtifact             │
│ SpecProgress / presentDocumentCount / Archive                  │
│ SpecComment / MarkdownBlockAnchor / Spec comment JSON v2       │
└────────────────────────────┬────────────────────────────────────┘
                             │ presentation adapter
┌────────────────────────────┴────────────────────────────────────┐
│ Review shell / ReviewComment / filter / selection / jump       │
│ session-global ReviewMode + worktree-local navigation          │
└────────────────────────────┬────────────────────────────────────┘
                             │ presentation adapter
┌────────────────────────────┴────────────────────────────────────┐
│ Repository Diff domain                                         │
│ RepositoryId / CommitSha / SnapshotId / BaseResolution         │
│ RepositorySnapshot / DiffFile / DiffLineAnchor / DiffComment   │
│ DiffAnchorResolution / Diff comment JSON v1                    │
└─────────────────────────────────────────────────────────────────┘

presentation DTO -> app use case -> domain
app use case -> infrastructure adapter -> domain
domain -> no Tauri / filesystem path / serde JSON detail
```

Spec と Diff は `ReviewComment` presentation を共有しますが、anchor、domain model、
command、store は union 化しません。Spec v2 の export / MCP / unknown-field compatibility
を Diff v1 が変更しないことが rollback boundary です。

Rust の配置は次の責務を持ちます。

- `domain/workspace`: workspace / worktree identity と selection source
- `domain/spec`: Spec tree、logical file、artifact、progress
- `domain/comment`: Spec Markdown anchor と Diff line anchor / comment
- `domain/repository`: repository identity、base、snapshot、tree、file review
- `app/use_cases`: scan、comparison、anchor resolution、comment mutation の orchestration
- `infrastructure/filesystem|git|persistence`: filesystem / Git / JSON adapter
- `presentation/commands`: Tauri DTO、camelCase wire field、stable error code

`ReviewMode`、`RepositoryDiffFilter`、open tab、expanded directory は frontend-only です。

## State ownership

| State | Scope | Default | Persistence |
| --- | --- | --- | --- |
| `ReviewMode = "specs" | "diff"` | session-global | `specs` | なし |
| selected Spec / artifact | worktree + Specs | 最初の有効 selection | なし |
| `RepositoryDiffFilter = "changed" | "all"` | worktree + Diff | `changed` | なし |
| selected / open Diff file、view mode、jump | worktree + Diff | 未選択 / `unified` | なし |
| expanded Spec / Diff directory | worktree + mode | contract に従う | なし |
| Spec comment | Spec logical file | JSON v2 | 永続 |
| Diff comment document | repository + worktree | revision `"0"` | JSON v1 |

worktree 切替では global mode を維持し、mode 内 navigation を worktree key で復元します。
repository request は workspace、worktree、base override、cycle、generation を identity と
し、detail / ignored page は snapshot と個別 generation も比較します。一致しない async
response は state へ反映しません。

## Repository comparison contract

```text
base    = merge-base(resolved base ref, worktree HEAD)
current = committed + index + working tree + untracked の canonical snapshot
Changed = base と current の logical changed entries
All     = current tracked/untracked/ignored/generated + base-only deleted
exclude = .git metadata only
```

Changed / All は同じ `currentSnapshotId` を共有します。All の ignored directory は
`Deferred` node と opaque `nodeId` で返し、展開時に cursor 付きで最大200 immediate
entry ずつ取得します。rename / copy は old/new path を持つ1 logical entry です。

base ref の優先順位は次です。

1. validated explicit override
2. `branch.<current>.gh-merge-base`
3. current branch remote HEAD
4. `origin/HEAD`
5. one unambiguous other remote HEAD
6. local `main`
7. local `master`
8. `needsSelection`

`invalidOverride` は silent fallback しません。`unbornHead`、`detachedHead`、
`shallowHistory`、`noCommonAncestor` も typed outcome とし、架空の比較結果を生成しません。

## Specs projection contract

### Progress の authoritative table

`list_specs` と `load_spec_bundle` の backend scan が進捗の正本です。tasks が present
なら tasks の結果だけを overall に採用し、missing のときだけ configured non-task
artifact を集約します。

| Input | `SpecProgress` |
| --- | --- |
| tasks read / parse error | `unknown` |
| tasks present and empty | `notStarted` |
| tasks non-empty, checkbox total `N = 0` | `inProgress` |
| tasks checkbox `N > 0, C = 0` | `notStarted` |
| tasks checkbox `0 < C < N` | `inProgress` |
| tasks checkbox `C = N` | `completed` |
| tasks missing, present configured non-task に read / parse error | `unknown` |
| tasks missing, present configured non-task が0件 | `notStarted` |
| tasks missing, configured non-task がすべて present regular file かつ non-empty | `completed` |
| tasks missing,それ以外で present が1件以上 | `inProgress` |

Markdown task marker の parse は `tasks.md` だけに限定します。frontend が各 file を
N+1 IPC で読んで再計算してはいけません。`unknown` は色以外の text / ARIA label と
artifact error で表示し、他の状態へ丸めません。

### Count と Archive

- Spec row: configured mapping 内で `Present` の regular file 数。empty を含み、missing、
  direct / unmapped Markdown、`.comments`、review output は除外
- category / Archive row: descendant Spec 数
- worktree badge in Specs: non-archive Spec 数
- worktree badge in Diff: changed logical `DiffFileEntry` 数。rename / copy は各1、
  ignored-only / unchanged は除外

`.archive` だけを hidden scan の例外とし、各 source group の active category 後の末尾に
1つ投影します。default collapsed、Archive 内 action なし、成功後は移動先 category を
展開して返却された exact destination を focus します。

## IPC contract map

wire field は camelCase、request / response decoder は unknown field と不正な union を
拒否します。

| Area | Command | Request の主 identity | Response / mutation |
| --- | --- | --- | --- |
| Specs | `list_specs` | `workspacePath` | tree、`presentDocumentCount`、progress、Archive metadata |
| Specs | `load_spec_bundle` | `workspacePath`, `specId` | artifact identity / contents / blocks / progress / per-artifact error |
| Specs | `archive_spec` | `workspacePath`, `specId` | exact destination / source group / archived relative id |
| Repository | `load_repository_diff` | `worktreeId`, optional `baseOverride` | base union、repository/worktree/snapshot identity、Changed / All root |
| Repository | `traverse_repository_ignored` | worktree + snapshot + node + cursor | bounded lazy page |
| Repository | `load_repository_file` | worktree + snapshot + path | old/new content、structured diff、submodule metadata |
| Diff comment | `load_diff_comments` | complete `DiffReviewIdentity` | stored document + runtime resolution |
| Diff comment | `save_diff_comment` | identity + `expectedRevision` + target | exhaustive CAS outcome |
| Diff comment | `update_diff_comment` | identity + revision + comment id | body / resolved / reply / delete CAS outcome |

重要な frontend DTO は次の discriminated union です。

```ts
type BaseResolution =
  | { state: "resolved"; source: BaseResolutionSource; branchRef: string;
      mergeBaseSha: string; headSha: string }
  | { state: "needsSelection"; reason: BaseResolutionFailure;
      candidates: readonly string[] }
  | { state: "invalidOverride"; reason: "missingRef" | "invalidRef";
      overrideRef: string };

type DiffReviewIdentity = {
  repositoryId: string;
  worktreeId: string;
  baseSha: string;
  currentSnapshotId: string;
};

type DiffLineAnchor =
  | (DiffAnchorCommon & { side: "base"; oldPath: string; newPath?: string })
  | (DiffAnchorCommon & { side: "current"; newPath: string; oldPath?: string });
```

`DiffReviewIdentity` の4値は load / save / update の runtime scope です。JSON document
envelope は repository / worktree の2値を持ち、各 immutable anchor が historical
base / snapshot を含みます。

## Diff anchor と runtime resolution

保存 anchor は repository / worktree / base / snapshot、side、old/new path、1-based
line と optional `endLine`、`sha256:` line hash、snippet、最大3行ずつの context を持ちます。

- `side = "base"`: `oldPath` 必須
- `side = "current"`: `newPath` 必須
- added file: current side のみ
- deleted file: base side のみ
- rename / copy: 両 path を保持し、base は old、current は new を side path とする
- `endLine` は `line` 以上。同じ値なら保存時に省略

stored anchor は resolution のたびに書き換えません。

```text
stored identity + side/path/line/hash 一致 -> exact      -> jump 可
rename map + unique context               -> relocated  -> jump 可
候補なし / 複数 / deleted / binary       -> stale      -> jump 不可
IO / permission / budget / cancellation   -> unavailable-> jump 不可
```

`selectionPath` は tree / tab を開き、`sidePath` は base / current の意味的な行を示します。
stale / unavailable でも stored comment は返し、runtime `anchorResolution` と warning は
JSON に永続化しません。

## Persistence と CAS

| Store | Physical location | Version / concurrency |
| --- | --- | --- |
| Spec comment | `<spec-folder>/.comments/<logical-file>.json` | JSON v2。既存 compatibility を維持 |
| Diff comment | `<git-common-dir>/spec-viewer/diff-comments/df1_<sha256(worktreeId)>.v1.json` | strict JSON v1、document revision CAS |

Diff store は canonical Git common dir boundary を検証し、symlink / reparse escape を拒否
します。mutation は cross-process lock の内側で current revision を読み、
`expectedRevision === current` のときだけ backend が次 revision を決めます。private temp
file の write + fsync 後に atomic replace します。directory sync が確定できない場合は
mutation 自体を retryable failure に戻さず、`committed` + `durability: "uncertain"` を
返します。

revision は canonical decimal u64 string です。missing document は `"0"`、first save は
`"1"`。negative、leading zero、non-digit、u64 超過は `invalidRevision`、不一致は latest
document 付き `conflict`、最大値からの mutation は無書込の `revisionOverflow` です。

worktree document は worktree 削除時に自動削除しません。orphaned review history の
明示 cleanup / export は後続 scope です。crash 後の古い temp file だけは24時間以上経過
したものを bounded cleanup します。

## Error と復旧 contract

| Area | Stable state / code | Contract |
| --- | --- | --- |
| Base | `needsSelection`, `invalidOverride`, `unbornHead`, `shallowHistory`, `detachedHead`, `noCommonAncestor` | action を提示し、比較を捏造しない |
| Repository | `notRepository`, `bareRepository`, `worktreeUnavailable`, `commonDirBoundaryEscape` | typed unavailable / failure |
| Consistency | `staleBase`, `staleSnapshot`, `staleCursor`, `invalidCursor` | overview または lazy page を再取得 |
| Content | `binary`, `largeFile`, `diffLimit`, `missingSide`, `unsupportedEntryKind` | interactive row を作らず理由を表示 |
| Comment request | `invalidRequest`, `invalidRevision`, `identityMismatch`, `pathBoundary`, `schema` | strict reject、scope を跨がない |
| Comment mutation | `conflict`, `revisionOverflow`, `storeBusy`, `io`, `permission`, `invalidStore` | draft retention と retry / write-block を outcome ごとに固定 |

absolute path と raw control character を user-facing diagnostic に含めません。manual store
recovery は backup、strict version / identity / revision / anchor の維持、validated reload を
必須とします。

## Phase 1 scope boundary

Phase 1 に含むもの:

- session-global Specs / Diff と worktree-local navigation
- Specs progress / count / Archive / Markdown tab
- repository Changed / All、ignored lazy traversal、3 Diff view
- Spec section / Diff line comment、filter、search、jump、resolve / reopen、reply / delete
- base / snapshot / anchor / CAS の typed error と復旧

含まないもの:

- editor、stage / unstage、commit、discard
- Repository Diff の arbitrary two-revision comparison、submodule recursive diff
- mode / filter / selection の cross-session persistence
- repository base override の入力 UI
- orphaned Diff document cleanup / export UI
- stale anchor の曖昧な自動移動

## Test fixture と traceability

正本の確認 matrix は `src/tests/acceptance/review-phase-1.generated.json`、visual tuple は
`src/tests/acceptance/review-vrt-cases.json` です。

- domain: progress 完全表、count、base priority、side/path invariant、exact / relocated /
  stale
- persistence: Spec v2 golden regression、Diff v1 round-trip、revision canonicality / conflict /
  overflow、scope mismatch、lock / temp / atomic replace、worktree isolation
- repository fixture: committed / staged / unstaged / untracked、ignored / generated、rename /
  delete / binary / large、unborn / shallow / detached、Unicode / non-UTF-8、boundary escape
- IPC / UI: strict union decoder、generation token、Archive reveal、Changed / All、3 view、
  comment filter / jump / conflict / stale
- Storybook / Playwright / native / VRT: 実行手順は
  [Review Phase 1 regression suite](../testing/review-phase-1-regression.md)
