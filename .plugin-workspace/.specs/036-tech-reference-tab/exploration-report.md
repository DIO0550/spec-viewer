# Exploration Report: Tech Reference Tab

## 1. アーキテクチャ概要

`spec-viewer` のドキュメント表示は、Rust/Tauri 側で spec tree と論理ファイル一覧を作り、React 側がその `SpecNode.files` をタブとして表示する構成。

- フロントエンド: `App.tsx` が `useWorkspace`、`useSpecs`、`useComments`、`useSpecFileWatcher` を束ね、`AppShell` に `SpecTree`、`SpecTabs`、`MarkdownViewer`、`CommentSidebar` を渡す。
- タブ: `SpecTabs` は固定タブではなく、バックエンドから返る `spec.files` の順序をそのまま描画する。
- ファイル読込: `useSpecs` が `list_specs` と `read_spec_file` IPC を呼び、選択 spec/file の `SpecDocumentState` を管理する。
- バックエンド: `WorkspaceConfig` の logical file mapping を元に `FilesystemSpecTreeScanner` が各 spec のファイル状態を返し、`FilesystemMarkdownReader` が Markdown/HTML を読み込む。
- 表示: `MarkdownViewer` は `document.format === "html"` なら sandbox iframe、Markdown なら `react-markdown` + comment anchor metadata で表示する。

現在の plugin workspace のデフォルトタブ順は `Implementation`, `Tasks`, `Exploration`, `Hearing`。`tech-reference` を「常時3番目」にするなら、Rust domain の default key order が主な設計ポイントになる。

## 2. 関連コード分析

### タブ構成

`SpecTabs` は `spec.files.map` の順序でタブを描画するため、3番目への挿入は基本的にバックエンドの `SpecNode.files` 順序で制御する。

```tsx
// spec-viewer/src/features/specs/components/SpecTabs.tsx:75
return (
  <div className="spec-tabs" role="tablist" aria-label={`${spec.label} files`}>
    {spec.files.map((file, index) => {
      const isSelected = selectedFileKey === file.key;
      const title = `${file.fileName} from ${sourceLabel}`;
      return (
        <button key={file.key} role="tab" aria-selected={isSelected}>
          <span className="spec-tabs__label">{file.label}</span>
          <span className={`file-status file-status--${file.status}`}>
            {file.status}
          </span>
        </button>
      );
    })}
  </div>
);
```

`useSpecs` は spec 選択時に `nextSpec.files[0]` をデフォルト選択し、再読み込み時は既存 fileKey が残っていれば保持する。tech reference を追加しても初期選択は先頭タブのまま。

```ts
// spec-viewer/src/features/specs/hooks/useSpecs.ts:370
const nextSpec =
  tree === null || specId === null ? null : findSpecNode(tree.specs, specId);
const defaultFileKey = nextSpec?.files[0]?.key ?? null;
setSelectedFileKey(defaultFileKey);
```

### 論理ファイルキー

Rust 側の `SpecFileKey` は現在6種のみ。`tech-reference` 用のキーは未定義。

```rust
// spec-viewer/src-tauri/src/domain/spec/mod.rs:40
pub enum SpecFileKey {
    Exploration,
    Hearing,
    Impl,
    Tasks,
    Requirements,
    Design,
}
```

TypeScript 側の union も同じく `techReference` / `tech-reference` 相当を持っていない。

```ts
// spec-viewer/src/features/specs/types/spec.ts:1
export type SpecFileKey =
  | "exploration"
  | "hearing"
  | "impl"
  | "tasks"
  | "requirements"
  | "design";
```

### デフォルトタブ順

plugin workspace のデフォルトは Rust domain で決まる。

```rust
// spec-viewer/src-tauri/src/domain/spec/mod.rs:49
impl SpecFileKey {
    pub const DEFAULT_KEYS: [Self; 4] =
        [Self::Impl, Self::Tasks, Self::Exploration, Self::Hearing];
}
```

`WorkspaceConfig::plugin_workspace_default()` はこの配列をそのまま mapping に変換する。

```rust
// spec-viewer/src-tauri/src/domain/workspace/config.rs:120
pub fn plugin_workspace_default() -> Self {
    Self::from_default_keys(
        SpecFileKey::default_keys(),
        plugin_workspace_default_file_name,
    )
}
```

ここに `TechReference` を追加し、配列を `[Impl, Tasks, TechReference, Exploration, Hearing]` にすれば3番目常設タブになる。`.spec-skill` 互換ワークスペースにも常設するかは判断が必要。

### ファイル存在判定と HTML fallback

spec tree scan は設定された fileName から存在状態と format を解決する。設定が `.md` の場合のみ `.html` fallback を見る。

```rust
// spec-viewer/src-tauri/src/infrastructure/filesystem/mod.rs:724
fn resolve_spec_file_for_scan(path: &Path) -> Result<ScannedSpecFile, SpecTreeScanError> {
    let preferred_format = SpecDocumentFormat::from_file_name(&display_path(path));

    if spec_file_status(path)? == SpecFileStatus::Present {
        return Ok(ScannedSpecFile {
            status: SpecFileStatus::Present,
            format: preferred_format,
        });
    }

    let Some(html_fallback_path) = html_fallback_path(path) else {
        return Ok(ScannedSpecFile {
            status: SpecFileStatus::Missing,
            format: preferred_format,
        });
    };
```

reader 側も同じく、設定 `.md` が存在すれば Markdown を優先し、なければ `.html` を読む。これは今回の「`tech-reference.html` 優先、なければ `tech-reference.md`」とは逆。

```rust
// spec-viewer/src-tauri/src/infrastructure/markdown/mod.rs:236
let preferred_format = SpecDocumentFormat::from_file_name(mapping.file_name());

if preferred_format == SpecDocumentFormat::Html || file_exists(&preferred_path)? {
    return Ok(ResolvedSpecDocumentPath {
        preferred_path: preferred_path.clone(),
        path: preferred_path,
        format: preferred_format,
    });
}
```

つまり単に `tech-reference.md` を default mapping に足すと、両方ある場合に Markdown が表示されてしまう。単に `tech-reference.html` を mapping にすると、HTML がない場合に Markdown fallback しない。tech reference だけ特別な候補解決、または mapping の候補リスト化が必要。

### 既存 HTML/Markdown 表示

`MarkdownViewer` は HTML を既に扱える。HTML の場合はコメント選択と文書検索が実質無効化される。

```tsx
// spec-viewer/src/features/specs/components/MarkdownViewer.tsx:535
{state.document.format === "html" ? (
  <HtmlDocument contents={contents} />
) : (
  <MarkdownDocument
    contents={contents}
    blocks={state.document.blocks}
    renderedRootRef={renderedRootRef}
```

```tsx
// spec-viewer/src/features/specs/components/MarkdownViewer.tsx:897
function HtmlDocument({ contents }: HtmlDocumentProps) {
  return (
    <iframe
      className="html-rendered"
      title={uiText.markdown.renderedHtmlDocument}
      sandbox=""
      srcDoc={contents}
    />
  );
}
```

`App.tsx` でも HTML 表示時は comments の file scope を `null` にしている。

```tsx
// spec-viewer/src/app/App.tsx:137
const comments = useComments({
  workspacePath: workspace.workspace?.root ?? null,
  specId: specs.selectedSpecId,
  fileKey:
    isHtmlDocument || !isDocumentReadable ? null : specs.selectedFileKey,
```

### Tauri IPC/DTO

`read_spec_file` は文字列 fileKey を Rust `SpecFileKey` に変換してから cached reader を呼ぶ。新しい logical key を追加する場合、Rust `FromStr` と TypeScript union、各 DTO/テストの整合が必要。

```rust
// spec-viewer/src-tauri/src/presentation/commands/specs.rs:235
pub fn read_spec_file(
    state: State<'_, CommandState>,
    request: ReadSpecFileRequest,
) -> CommandResult<ReadSpecFileResponse> {
    let key = SpecFileKey::from_str(&request.file_key).map_err(|_| {
        CommandError::invalid_request(format!("unsupported file key: {}", request.file_key))
    })?;
```

## 3. 技術的制約・リスク

- 現行 fallback は `.md -> .html` で、今回要件の `.html -> .md` と逆。既存挙動を壊さないため、全ファイル共通で優先順位を反転するのは危険。
- `WorkspaceFileMapping` は単一 `file_name` のみ。`tech-reference.html` と `tech-reference.md` の候補セットを自然に表現できない。
- `SpecFileKey` は Rust/TS/コメント/レビュー実行/IPC/watch で広く使われる。追加漏れは型エラーまたは runtime invalid request になる。
- HTML は sandbox iframe 表示でコメント・検索が無効。`tech-reference.md` fallback の場合は Markdown としてコメント可能になるが、HTML の場合はコメント不可という差が残る。
- watcher は現在 resolved path と fallback preferred path を監視できるが、HTML優先・Markdown fallback の両候補監視は解決ロジックの設計に依存する。
- config override は既存キーを置換、未知キーを末尾追加する設計。デフォルトで3番目に出すなら default key order に入れる必要がある。

## 4. 変更影響範囲

想定変更箇所:

- `spec-viewer/src-tauri/src/domain/spec/mod.rs`
  - `SpecFileKey::TechReference` 追加、`as_str`、`display_label`、`FromStr`、default key order 更新。
- `spec-viewer/src-tauri/src/domain/workspace/config.rs`
  - `plugin_workspace_default_file_name` に `tech-reference.html` または専用解決を前提にした名前を追加。
  - default order test 更新。
- `spec-viewer/src/features/specs/types/spec.ts`
  - `SpecFileKey` union に新キー追加。
- `spec-viewer/src-tauri/src/infrastructure/filesystem/mod.rs`
  - scan 時の tech reference 用 HTML優先/MD fallback 判定。
- `spec-viewer/src-tauri/src/infrastructure/markdown/mod.rs`
  - read 時の tech reference 用 HTML優先/MD fallback 判定。
- `spec-viewer/src-tauri/src/app/services/file_watching.rs`
  - HTML優先/MD fallback 時に両候補を監視する必要があるか確認・調整。
- `spec-viewer/src-tauri/src/presentation/commands/specs.rs`
  - DTO変換は `SpecFileKey` 側の追加に追従。必要ならテスト追加。
- `spec-viewer/src/app/App.tsx`
  - 基本的には不要。既存 `SpecTabs`/`MarkdownViewer` 再利用で足りる見込み。
- `spec-viewer/src/features/specs/components/SpecTabs.tsx`
  - 基本的には不要。ラベル・status表示は既存で足りる。
- コメント/レビュー実行系
  - `SpecFileKey` 型追加に追従。HTML時の comments 無効化は既存方針を継続するなら変更不要。

## 5. テストインフラストラクチャ

- フロント: Vitest + happy-dom。`spec-viewer/vite.config.ts` の `test.include` は `src/**/*.{test,spec}.{ts,tsx}`。
- フロント主要テスト:
  - `useSpecs.state.test.tsx`: 初期選択、missing状態、reload時 selection preserve。
  - `AppShell.state.test.tsx`: `SpecTabs` の選択状態と keyboard navigation。
  - `MarkdownViewer.rendering.test.tsx`: ready/missing/loading/error/empty 表示。
  - `tauri.integration.test.ts`: IPC wrapper payload。
- Storybook:
  - `MarkdownViewer.stories.tsx` あり。HTML用 story は現状見当たらないため追加候補。
- Rust:
  - `cargo test --manifest-path spec-viewer/src-tauri/Cargo.toml` で domain/config/filesystem/markdown/watch/presentation の単体テスト。
  - 既に HTML fallback 関連テストがある:
    - `FilesystemMarkdownReader` は `.md` absent -> `.html` fallback、両方存在 -> Markdown優先を検証。
    - `FilesystemSpecTreeScanner` は HTML fallback を present/html として検出。
    - `file_watching` は HTML fallback と preferred Markdown path の両方を watch target に入れることを検証。

## 6. 追加調査が必要な項目

- 実際の spec workspace で `tech-reference.html` / `.md` が spec ディレクトリ直下に置かれる前提でよいか。
- `.spec-skill` 互換ワークスペースにも tech reference タブを常設するか。
- HTML 版 tech reference にコメント・検索が不要でよいか。既存仕様ではHTMLは iframe で検索 disabled、comments disabled。
- `tech-reference` を workspace config / spec override で別ファイル名に上書き可能にするか。その場合でも `.html` 優先 + `.md` fallback を維持する仕様が必要。
- タブ表示名は `Tech Reference` でよいか。

## 7. ユーザー判断が必要な論点

1. 3番目とは、現在の plugin workspace 順序 `Implementation`, `Tasks`, `Exploration`, `Hearing` に対して `Implementation`, `Tasks`, `Tech Reference`, `Exploration`, `Hearing` へ挿入する理解でよいか。
   - 回答: その順で固定。
2. `.spec-skill` 互換ワークスペースにも常設するか、`.plugin-workspace` / plugin worktree のみでよいか。
   - 回答: plugin workspaceのみ。
3. HTML 表示時は既存通りコメント・文書検索なしでよいか。
   - 回答: 既存通りでよい。
4. config override で tech reference のファイル名を変更した場合、同名 stem の HTML/Markdown fallback を維持するか、`tech-reference.html/md` 固定の特殊タブにするか。
   - 回答: 同stemで両対応。

## 8. 逆引き検索の実施結果

実施した検索:

- `rg -n "SpecTabs|tab|tabs|activeTab|MarkdownViewer|html|markdown|read_spec|load|spec file|file tree|workspace" spec-viewer/src spec-viewer/src-tauri/src spec-viewer/package.json spec-viewer/vite.config.ts`
  - `SpecTabs.tsx`, `App.tsx`, `useSpecs.ts`, `MarkdownViewer.tsx`, `src-tauri/src/presentation/commands/specs.rs`, `infrastructure/markdown/mod.rs`, `infrastructure/filesystem/mod.rs` が主経路。
- `rg -n "tech-reference|design\\.html|requirements|tasks\\.md|implementation|logical|SpecFile|SpecDocument|read_spec_file|list_spec" spec-viewer/src spec-viewer/src-tauri/src spec-viewer/src-tauri/tests spec-viewer/docs`
  - `tech-reference` は既存コードには未検出。logical file は `SpecFileKey` と config mapping で管理。
- `rg -n "fn plan_file_watch|markdown_file_path|config|FileWatchScope|watch" ...`
  - watcher は `resolve_spec_document_path` の結果に依存し、fallback path も optional target として監視可能。

## 9. 探索メトリクス

- 読み取りファイル数: 22ファイル以上
- コードスニペット: 8件
- 主な探索対象:
  - `.plugin-workspace/.specs/036-tech-reference-tab/hearing-notes.md`
  - `spec-viewer/src/app/App.tsx`
  - `spec-viewer/src/features/specs/components/SpecTabs.tsx`
  - `spec-viewer/src/features/specs/components/MarkdownViewer.tsx`
  - `spec-viewer/src/features/specs/hooks/useSpecs.ts`
  - `spec-viewer/src/features/specs/hooks/useSpecFileWatcher.ts`
  - `spec-viewer/src/features/specs/types/spec.ts`
  - `spec-viewer/src/shared/api/tauri/tauri.ts`
  - `spec-viewer/src/shared/types/ipc.ts`
  - `spec-viewer/src/shared/lib/uiText.ts`
  - `spec-viewer/src/app/App.css`
  - `spec-viewer/src-tauri/src/domain/spec/mod.rs`
  - `spec-viewer/src-tauri/src/domain/workspace/config.rs`
  - `spec-viewer/src-tauri/src/infrastructure/filesystem/mod.rs`
  - `spec-viewer/src-tauri/src/infrastructure/markdown/mod.rs`
  - `spec-viewer/src-tauri/src/infrastructure/persistence/config.rs`
  - `spec-viewer/src-tauri/src/app/use_cases/mod.rs`
  - `spec-viewer/src-tauri/src/app/services/file_watching.rs`
  - `spec-viewer/src-tauri/src/presentation/commands/specs.rs`
  - `spec-viewer/src-tauri/src/presentation/commands/watch.rs`
  - `spec-viewer/src/features/specs/hooks/__tests__/useSpecs.state.test.tsx`
  - `spec-viewer/src/features/specs/components/__tests__/MarkdownViewer.rendering.test.tsx`
  - `spec-viewer/src/shared/ui/__tests__/AppShell.state.test.tsx`
  - `spec-viewer/src/shared/api/tauri/__tests__/tauri.integration.test.ts`
  - `spec-viewer/src/features/specs/components/MarkdownViewer.stories.tsx`
  - `spec-viewer/package.json`
  - `spec-viewer/vite.config.ts`

## 10. 実装設計への推奨メモ

最小変更で要件に寄せるなら、`SpecFileKey::TechReference` を追加し、plugin workspace default order の3番目へ入れる。その上で `tech-reference` key 専用に `tech-reference.html` を第1候補、`tech-reference.md` を第2候補として解決する関数を filesystem scan / markdown read / watch plan で共有するのが安全。

全既存ファイルの fallback 優先順位を変えるのは、既存テストの `prefers_markdown_over_html_fallback_when_both_exist` と衝突するため避けるべき。
