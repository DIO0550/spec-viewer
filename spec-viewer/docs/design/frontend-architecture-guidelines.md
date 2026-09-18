# Frontend architecture guidelines

[Issue #105](https://github.com/DIO0550/spec-viewer/issues/105) / [Epic #104](https://github.com/DIO0550/spec-viewer/issues/104)

このガイドは frontend の配置、依存方向、公開入口を定義する。
Specs/Diff 固有の意味・契約は [integrated-review-contract.md](./integrated-review-contract.md)
を正本とし、ここでは横断する構造規則を定める。既存コードの違反は移行負債であり、規約の良い例ではない。

## 層の責務と依存方向

```text
app composition → feature 公開 API → presentation → application → domain
                                  → infra ───────→ application の port
                                                           domain → Shared Kernel
```

| 層 | 責務 | 許可する依存 | 禁止する依存 |
| --- | --- | --- | --- |
| domain | entity、value object、不変条件、policy、query | 同 feature domain、認定 domain API、認定 Kernel、認定 pure external | UI、React/Tauri、application、infra、API、hooks、components、未認定共通コード |
| application | use case、port、非同期操作と stale result 制御 | 同 feature application/domain、Kernel、他 feature 公開 API | 同 feature infra/presentation、app、React/Tauri 直参照 |
| infra | IPC・storage の adapter、DTO の runtime decode、domain への変換 | 同 feature infra/application/domain、共通 adapter、Kernel、他 feature 公開 API | 同 feature presentation、app |
| presentation | component、hook、presenter、描画と UI 操作 | 同 feature presentation/application/domain、共通 UI、他 feature 公開 API | 同 feature infra への直参照、app |
| app composition | 依存注入、adapter と port の接続、画面全体の構成 | feature 公開 API、共通コード | feature 内部への deep import |
| shared / legacy 共通 | feature を所有しない共通機能 | 他の共通コード | features への依存（移行例外のみ） |
| Shared Kernel | 複数 feature が共有する安定した意味 | 同モジュール内部、認定 Kernel、認定 pure external | feature、UI、transport、未認定共通コード |

application の port を infra が実装し、composition が公開 API を通じて注入する。
application が具体的な adapter を import して生成しない。公開 API 経由で渡す型も、利用者の層の純粋性を守る。

### 実際の配置との対応

- `src/features/<name>/domain|application|infra|presentation/` は上表の層。
- 既存 `components/`、`hooks/`、`presenters/` は presentation。
- feature 内の `lib/`、`types/`、その他は legacy。名前だけで純粋性を認定しない。横断公開 API 規則を適用し、domain からは参照しない。
- `src/App.tsx`、`src/main.tsx`、`src/app/**` は composition。
- `src/shared/` と既存 `src/lib/`、`src/hooks/`、`src/components/`、`src/types/`、`src/domains/` は共通領域。`lib/api/tauri` は transport であり、domain の共通ライブラリではない。
- feature 外のその他の src からも、feature は公開 API 経由で利用する。

### 各層の良い例・悪い例

次は配置を説明する例であり、存在しない API の追加指示ではない。

| import 元 | 良い例 | 悪い例 |
| --- | --- | --- |
| domain | `comments/domain/comment → comments/domain/commentBody` | `comments/domain/commentError → lib/api/tauri` |
| application | `comments/application/save → comments/domain/comment` | `comments/application/save → comments/infra/tauriGateway` |
| infra | `comments/infra/tauriGateway → comments/application/commentPort` | `comments/infra/tauriGateway → comments/components/CommentCard` |
| presentation | `comments/hooks/useComments → comments/application/save` | `comments/hooks/useComments → comments/infra/tauriGateway` |
| composition | `app/App → features/comments/index.ts` | `app/App → features/comments/hooks/useComments` |
| shared | `shared/format → types/utilityTypes` | `shared/api → features/comments/domain/comment` |
| Kernel | `domains/id/index → domains/id/validate` | `domains/id/index → features/workspace/domain/workspace` |

```ts
// 良い: domain 自身の失敗を表現し、infra が transport error から変換する。
export type SaveCommentFailure = { type: "notFound" } | { type: "conflict" };
```

```ts
// 悪い: domain のエラーを transport の DTO に結び付ける。
import type { SaveCommandError } from "@/lib/api/tauri";
export type SaveCommentFailure = SaveCommandError;
```

### domain に置かないもの

| 内容 | 悪い配置・例 | 配置先 |
| --- | --- | --- |
| React state | domain で `useState` / `useEffect` | presentation の hook。業務状態遷移は domain/application へ分離 |
| Tauri DTO | domain が IPC response 型・command error を所有 | infra が decode し domain 値へ変換 |
| storage | domain が `localStorage.getItem` を呼ぶ | application の port と infra adapter |
| localized copy | domain が「保存に失敗しました」を返す | domain の結果コードから presentation で表示文言を選ぶ |
| DOM 処理 | domain が `document.querySelector` を呼ぶ | presentation。ブラウザ資源の adapter は infra |

## feature 公開 API と deep import

外部に公開する標準入口は `src/features/<name>/index.ts`。
純粋な domain API は `src/features/<name>/domain/index.ts` を作り、
[policy.json](../../scripts/architecture/policy.json) に理由・認定 Issue を登録する。
同 feature の内部参照は許可し、別 feature や composition から内部へ直接 import しない。

公開 barrel の中身が UI を export していれば domain 用 API としては使えない。
検査は type-only、export-from、import 型、literal dynamic import、require/import-equals も含む。
相対指定と `@` alias は実際の参照先に正規化する。非リテラル import/require は静的に確定できないため失敗する。

## Shared Kernel の認定

認定は次の全条件をレビューし、具体的な `index.ts` 入口単位で行う。

1. 二つ以上の独立した feature などに利用されている。
2. 特定 feature の内部都合ではなく、安定した共通の意味を持つ。
3. React、Tauri、UI、通信・保存形式から独立している。
4. 入口から辿る依存も純粋である。
5. policy に非空の理由と正整数の認定 Issue を記録する。

登録可能な場所は `src/domains/`、`src/types/`、`src/shared/kernel/`。
フォルダ全体の自動認定や、包含関係にあるモジュールの二重認定はしない。
モジュール外からは登録入口だけを利用し、その内部ファイルへ直接参照しない。
外部パッケージの純粋性は package/subpath の完全一致で認定する。React、Tauri、Node 組込は認定できない。

初期認定は WorkspacePath（comments/specs と composition の共通語彙）と utilityTypes
（workspace/preferences などが使う純粋な型演算）。SidebarWidth は sidebar 表示に固有で、独立した複数 feature 利用がないため認定しない。
WorkspacePath の値検証強化は #112 の担当であり、認定は値検証の十分性を保証しない。

## 自動検査

`spec-viewer/` で実行する。

```bash
pnpm test:architecture
pnpm lint:architecture
```

CI の frontend-unit で既存 oxlint / typecheck / Vitest に加えて両方を実行する。

| rule ID | 検査 |
| --- | --- |
| `domain-dependency` | domain 起点の全到達先が許可された純粋領域か |
| `kernel-dependency` | Kernel 起点の全到達先が純粋か |
| `kernel-public-api` | Kernel の外部から登録入口以外への直接参照 |
| `shared-to-feature` | 共通領域から feature への直接参照 |
| `feature-public-api` | 別 feature / feature 外からの内部参照 |
| `layer-direction` | 同 feature 内の逆依存と feature → app、application → React/Tauri |
| `production-to-test` | production から test/spec/stories/__tests__/src/tests への参照 |

src 以下の `.ts`、`.tsx`、`.mts`、`.cts`（宣言ファイルを含む）を tsconfig include と独立に走査する。
テスト・stories も横断境界の検査対象。テスト自身は domain/Kernel 純粋性の起点にせず、テスト framework を使用できる。
production からテストへ到達した場合は除外しない。

barrel は export 全体を辿る。循環は訪問済み集合で停止する。
閉包違反は起点と禁止先ごとに一件へまとめ、最短の参照経路も表示する。
不正設定、構文エラー、解決不能な参照、範囲外 symlink、空 src は非ゼロ終了し、例外で抑止できない。
CSS/画像、`?raw` / `?url` は存在確認して asset と扱い、domain / Kernel からは禁止する。

### 検査の限界

- import に現れない DOM グローバル・storage 操作・文言の意味は人がレビューする。
- external package 内部は走査せず、登録時の純粋性審査を信頼する。
- 例外は `rule/from/to` の到達関係単位。既存と同じ関係の symbol 数や経路の増加は検出しない。
- ファイルが正しい層に属するか、port/adapter の意味が適切かはガイドとレビューで確認する。

## 移行例外の運用

[exceptions.json](../../scripts/architecture/exceptions.json) は恒久的な許可ではなく削除対象の負債一覧。
各 entry は `rule`、src 相対の `from`、解決済み `to`、非空 `reason`、正整数 `issue` を持つ。
外部参照先は `npm:<specifier>` または `node:<name>`。パスは POSIX の完全一致。
glob、件数だけの baseline、重複、未知キー、不正な型を拒否する。

1. CI 導入時の既存辺を個別に確認し、理由と解消先 Issue を登録する。
2. 新しい違反は原則として依存を修正する。例外の追加にはレビューで移行理由を説明する。
3. 後続 Issue で違反を修正したら、対応する例外も同じ変更で削除する。
4. 不要な例外が残ると検査に失敗する。`from` と `to` が現在の依存グラフに存在し、対応する違反だけがなくなった場合は `stale-exception` となる。ファイル削除や外部 module への全 import の削除などで `from` または `to` がグラフから消えた場合は、例外設定の検証で `invalid-config` となる。どちらの場合も不要になった例外を削除する。

検査コマンドは policy / exceptions / src を書き換えない。baseline を自動更新する機能は提供しない。

## Epic 子 Issue の適用規則と移行担当

各子 Issue はこのガイドの該当節を実装・レビューの基準にする。
この表は担当の対応表であり、各 Issue 本文からのリンク反映は別途確認する。

| Issue / 移行担当 | 対象 | 適用規則・節 |
| --- | --- | --- |
| #105 | ガイド・CI・移行台帳 | 全節、自動検査・移行例外 |
| #106 | Shared Kernel・公開 API | Shared Kernel の認定、feature 公開 API |
| #107 | IPC wrapper の feature infra 移動 | shared-to-feature、infra |
| #109 | domain error の transport 分離 | domain-dependency、domain に置かないもの |
| #110 | runtime decode・DTO/domain 分離 | infra、domain に置かないもの |
| #111 | identity/timestamp | domain、Kernel 認定 |
| #112 | WorkspacePath | domain、Kernel 認定 |
| #113 | Workspace aggregate | domain |
| #114 | workspace open/recent/drop | application、layer-direction |
| #115 | RecentWorkspaces | domain、application port / infra adapter |
| #116 | specs use cases | application、layer-direction |
| #117 | SpecTree query | domain、feature 公開 API |
| #118 | SpecDocument policy | domain |
| #119 | FileWatchScope/RefreshPlan | domain/application と infra の分離 |
| #120 | Comment aggregate | domain |
| #121 | CommentBody | domain |
| #122 | CommentAnchor/CharRange/BlockIdentity | domain、Kernel 認定 |
| #123 | anchor fingerprint 契約 | domain と infra 変換 |
| #124 | anchor reconciliation/highlight | domain と presentation の分離 |
| #125 | comments use cases | application、layer-direction |
| #126 | export/output/MCP policy | domain |
| #127 | export/LLM/MCP use cases | application、infra |
| #89 | CommentSidebar query | domain と presentation の分離 |
| #108 | MarkdownViewer composition | feature-public-api、shared-to-feature |
| #128 | Selection/ReviewTarget | Kernel、feature 公開 API |
| #129 | UserReview lifecycle | domain |
| #130 | review use cases | application、layer-direction |
