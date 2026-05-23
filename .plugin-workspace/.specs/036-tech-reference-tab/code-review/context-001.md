## 実装計画

# Tech Reference Tab Implementation Plan

## 設計方針

`spec-viewer` の既存タブ機構を維持し、Rust/Tauri 側の logical file mapping に `tech-reference` を追加する。React 側は `SpecNode.files` の順序を描画するだけなので、plugin workspace default のキー順を `Implementation`, `Tasks`, `Tech Reference`, `Exploration`, `Hearing` にすることで3番目へ常設する。

重要な制約として、既存の `.md -> .html` fallback は全体反転しない。`TechReference` 専用、またはキー別候補解決として `.html -> .md` を表現する。互換 workspace (`WorkspaceKind::SpecSkill`) の default は変更しない。

採用方針:

- `SpecFileKey::TechReference` を domain に追加する。
- plugin workspace default のみ `TechReference` を3番目に追加し、default file name は `tech-reference.html` にする。
- Rust infrastructure に logical key と configured file name から候補パスを作る helper を追加し、scan/read/watch で共有する。
- `TechReference` は configured file の stem を使い、常に `same-stem.html`, `same-stem.md` の順で解決する。config override が `foo.md` でも `foo.html` 優先、`foo.md` fallback とする。
- HTML 表示は既存 `MarkdownViewer` の sandbox iframe をそのまま使い、コメントと文書検索なしの既存仕様を維持する。

## システム図

### 状態マシン図

```
+--------------------+
| Workspace Loaded   |
| kind detected      |
+---------+----------+
          |
          v
+--------------------+       SpecSkill default
| Build Workspace    |------------------------------+
| Config Defaults    |                              |
+---------+----------+                              |
          | PluginWorkspace / PluginWorktree        |
          v                                         v
+-------------------------------+        +-------------------------+
| Default keys include           |        | Compatibility keys stay |
| Impl, Tasks, TechReference,    |        | Requirements, Design,   |
| Exploration, Hearing           |        | Tasks                   |
+---------------+---------------+        +------------+------------+
                |                                     |
                v                                     v
+-------------------------------+        +-------------------------+
| Scan Spec Directory            |        | Scan Spec Directory     |
| per configured mapping         |        | existing behavior       |
+---------------+---------------+        +-------------------------+
                |
                v
+-------------------------------+
| Resolve Candidates             |
| key == TechReference ?         |
+---------+---------------------+
          | yes                         no
          v                             v
+------------------------+     +----------------------------+
| html first, md second  |     | existing md first,         |
| same configured stem   |     | html fallback if md absent |
+-----------+------------+     +-------------+--------------+
            |                                |
            v                                v
+------------------------+     +----------------------------+
| HTML Present           |     | First existing candidate   |
| status=Present/html    |     | decides status/format      |
+-----------+------------+     +-------------+--------------+
            | no                             |
            v                                v
+------------------------+     +----------------------------+
| MD Present             |     | Missing uses configured    |
| status=Present/markdown|     | preferred format/path      |
+-----------+------------+     +----------------------------+
            | no
            v
+------------------------+
| Missing Tech Reference |
| status=Missing/html    |
+-----------+------------+
            |
            v
+------------------------+
| React SpecTabs renders |
| third tab permanently  |
+------------------------+
```

### データフロー図

```
+-------------------------------+
| WorkspaceConfig::default_for   |
| PluginWorkspace / Worktree     |
+---------------+---------------+
                |
                | files: [impl, tasks, techReference, exploration, hearing]
                v
+-------------------------------+      +-------------------------------+
| FilesystemSpecTreeScanner      |----->| spec_file_path_candidates()   |
| collect_spec_files()           |      | key-aware candidate ordering  |
+---------------+---------------+      +-------------------------------+
                |
                | SpecNode.files ordered by config
                v
+-------------------------------+
| Tauri command list_specs       |
| SpecFileDto                    |
+---------------+---------------+
                |
                v
+-------------------------------+      +-------------------------------+
| useSpecs                       |----->| read_spec_file(fileKey)       |
| selectedSpec/files/fileKey     |      | when Tech tab selected        |
+---------------+---------------+      +---------------+---------------+
                |                                      |
                v                                      v
+-------------------------------+      +-------------------------------+
| SpecTabs                       |      | FilesystemMarkdownReader      |
| renders file order             |      | resolve_spec_document_path()  |
+---------------+---------------+      +---------------+---------------+
                |                                      |
                v                                      v
+-------------------------------+      +-------------------------------+
| MarkdownViewer                 |<-----| MarkdownReadResult            |
| html => sandbox iframe         |      | format html/markdown/missing  |
| markdown => existing renderer  |      +-------------------------------+
+-------------------------------+

+-------------------------------+
| useSpecFileWatcher             |
+---------------+---------------+
                |
                v
+-------------------------------+      +-------------------------------+
| plan_file_watch()              |----->| resolved candidate paths      |
| required active path + optional|      | html and md for TechReference |
| alternate candidate paths      |      +-------------------------------+
+-------------------------------+
```

## フォルダ構造

### 現在実装済み

```text
spec-viewer/
├── src/
│   ├── app/App.tsx
│   └── features/specs/
│       ├── components/
│       │   ├── MarkdownViewer.tsx
│       │   ├── MarkdownViewer.stories.tsx
│       │   └── SpecTabs.tsx
│       ├── hooks/useSpecs.ts
│       └── types/spec.ts
└── src-tauri/src/
    ├── app/services/file_watching.rs
    ├── domain/
    │   ├── spec/mod.rs
    │   └── workspace/config.rs
    ├── infrastructure/
    │   ├── filesystem/mod.rs
    │   └── markdown/mod.rs
    └── presentation/commands/specs.rs
```

### 将来的な構造

```text
spec-viewer/
├── src/
│   ├── features/specs/
│   │   ├── components/
│   │   │   ├── MarkdownViewer.tsx
│   │   │   ├── MarkdownViewer.stories.tsx
│   │   │   └── SpecTabs.tsx
│   │   └── types/spec.ts
│   └── shared/types/ipc.ts
└── src-tauri/src/
    ├── app/services/file_watching.rs
    ├── domain/
    │   ├── spec/mod.rs
    │   └── workspace/config.rs
    └── infrastructure/
        ├── mod.rs
        ├── spec_file_resolution.rs
        ├── filesystem/mod.rs
        └── markdown/mod.rs
```

## 主要コンポーネントの設計

### 1. [NEW] Rust domain key

対象: `spec-viewer/src-tauri/src/domain/spec/mod.rs`

実装骨格:

```rust
use std::{fmt, str::FromStr};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum SpecFileKey {
    Exploration,
    Hearing,
    Impl,
    Tasks,
    TechReference,
    Requirements,
    Design,
}

impl SpecFileKey {
    pub const DEFAULT_KEYS: [Self; 5] = [
        Self::Impl,
        Self::Tasks,
        Self::TechReference,
        Self::Exploration,
        Self::Hearing,
    ];
    pub const COMPATIBILITY_KEYS: [Self; 3] = [
        Self::Requirements,
        Self::Design,
        Self::Tasks,
    ];

    pub fn as_str(self) -> &'static str;
    pub fn display_label(self) -> &'static str;
    pub fn default_keys() -> &'static [Self];
    pub fn compatibility_keys() -> &'static [Self];
}

impl FromStr for SpecFileKey {
    type Err = SpecDomainError;

    fn from_str(value: &str) -> Result<Self, Self::Err>;
}
```

`as_str` は `"tech-reference"`、`display_label` は `"Tech Reference"` とする。文字列は kebab-case に寄せ、TypeScript 側の `SpecFileKey` union も同じ値に揃える。

### 2. [MODIFY] plugin workspace default mapping

対象: `spec-viewer/src-tauri/src/domain/workspace/config.rs`

Before:

```rust
fn plugin_workspace_default_file_name(key: SpecFileKey) -> &'static str {
    match key {
        SpecFileKey::Exploration => "exploration-report.md",
        SpecFileKey::Hearing => "hearing-notes.md",
        SpecFileKey::Impl => "implementation-plan.md",
        SpecFileKey::Tasks => "tasks.md",
        SpecFileKey::Requirements => "requirements.md",
        SpecFileKey::Design => "design.md",
    }
}
```

After:

```rust
fn plugin_workspace_default_file_name(key: SpecFileKey) -> &'static str {
    match key {
        SpecFileKey::Exploration => "exploration-report.md",
        SpecFileKey::Hearing => "hearing-notes.md",
        SpecFileKey::Impl => "implementation-plan.md",
        SpecFileKey::Tasks => "tasks.md",
        SpecFileKey::TechReference => "tech-reference.html",
        SpecFileKey::Requirements => "requirements.md",
        SpecFileKey::Design => "design.md",
    }
}
```

`spec_skill_default_file_name` にも `SpecFileKey::TechReference` arm を追加して exhaustive match を満たすが、`COMPATIBILITY_KEYS` には追加しない。これにより互換 workspace の default タブ構成は変えない。

### 3. [NEW] key-aware document candidate resolver

対象: `spec-viewer/src-tauri/src/infrastructure/spec_file_resolution.rs`

実装骨格:

```rust
use std::path::{Path, PathBuf};

use crate::domain::spec::{SpecDocumentFormat, SpecFileKey};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpecFilePathCandidate {
    path: PathBuf,
    format: SpecDocumentFormat,
}

impl SpecFilePathCandidate {
    pub fn new(path: PathBuf, format: SpecDocumentFormat) -> Self;
    pub fn path(&self) -> &Path;
    pub fn format(&self) -> SpecDocumentFormat;
}

pub fn spec_file_path_candidates(
    key: SpecFileKey,
    configured_path: &Path,
) -> Vec<SpecFilePathCandidate> {
    if key == SpecFileKey::TechReference {
        return vec![
            SpecFilePathCandidate::new(
                configured_path.with_extension("html"),
                SpecDocumentFormat::Html,
            ),
            SpecFilePathCandidate::new(
                configured_path.with_extension("md"),
                SpecDocumentFormat::Markdown,
            ),
        ];
    }

    let preferred_format =
        SpecDocumentFormat::from_file_name(&configured_path.to_string_lossy());

    if preferred_format == SpecDocumentFormat::Markdown {
        return vec![
            SpecFilePathCandidate::new(configured_path.to_path_buf(), SpecDocumentFormat::Markdown),
            SpecFilePathCandidate::new(configured_path.with_extension("html"), SpecDocumentFormat::Html),
        ];
    }

    vec![SpecFilePathCandidate::new(
        configured_path.to_path_buf(),
        preferred_format,
    )]
}
```

補足:

- `TechReference` は configured path の拡張子に依存せず `with_extension("html")`, `with_extension("md")` の順にする。
- 既存の configured HTML ファイルは `.md` reverse fallback しない。
- 既存の configured Markdown ファイルは従来通り Markdown 優先、HTML fallback とする。
- `infrastructure/mod.rs` で `pub mod spec_file_resolution;` を追加する。

### 4. [MODIFY] spec tree scan

対象: `spec-viewer/src-tauri/src/infrastructure/filesystem/mod.rs`

Before:

```rust
let file_path = directory.join(mapping.file_name());
let resolved_file = resolve_spec_file_for_scan(&file_path)?;
```

After:

```rust
use crate::infrastructure::spec_file_resolution::spec_file_path_candidates;

let file_path = directory.join(mapping.file_name());
let resolved_file = resolve_spec_file_for_scan(mapping.key(), &file_path)?;
```

Before:

```rust
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

    let fallback_status = spec_file_status(&html_fallback_path)?;
    // ...
}
```

After:

```rust
fn resolve_spec_file_for_scan(
    key: SpecFileKey,
    configured_path: &Path,
) -> Result<ScannedSpecFile, SpecTreeScanError> {
    let candidates = spec_file_path_candidates(key, configured_path);
    let preferred_format = candidates
        .first()
        .map(SpecFilePathCandidate::format)
        .unwrap_or_else(|| SpecDocumentFormat::from_file_name(&display_path(configured_path)));

    for candidate in &candidates {
        if spec_file_status(candidate.path())? == SpecFileStatus::Present {
            return Ok(ScannedSpecFile {
                status: SpecFileStatus::Present,
                format: candidate.format(),
            });
        }
    }

    Ok(ScannedSpecFile {
        status: SpecFileStatus::Missing,
        format: preferred_format,
    })
}
```

`SpecFile.file_name` は configured mapping の file name を維持する。format は実際に選ばれた candidate の format を返す。

### 5. [MODIFY] Markdown/HTML read resolution

対象: `spec-viewer/src-tauri/src/infrastructure/markdown/mod.rs`

Before:

```rust
let preferred_path = spec_directory.join(mapping.file_name());
ensure_within_workspace(layout, &preferred_path)?;

let preferred_format = SpecDocumentFormat::from_file_name(mapping.file_name());

if preferred_format == SpecDocumentFormat::Html || file_exists(&preferred_path)? {
    return Ok(ResolvedSpecDocumentPath {
        preferred_path: preferred_path.clone(),
        path: preferred_path,
        format: preferred_format,
    });
}
```

After:

```rust
use crate::infrastructure::spec_file_resolution::{
    spec_file_path_candidates,
    SpecFilePathCandidate,
};

let configured_path = spec_directory.join(mapping.file_name());
let candidates = spec_file_path_candidates(key, &configured_path);

for candidate in &candidates {
    ensure_within_workspace(layout, candidate.path())?;
}

let preferred = candidates.first().ok_or(MarkdownReadError::MissingFileMapping { key })?;

for candidate in &candidates {
    if file_exists(candidate.path())? {
        return Ok(ResolvedSpecDocumentPath {
            preferred_path: preferred.path().to_path_buf(),
            path: candidate.path().to_path_buf(),
            format: candidate.format(),
            candidate_paths: candidates.iter().map(|candidate| candidate.path().to_path_buf()).collect(),
        });
    }
}

Ok(ResolvedSpecDocumentPath {
    preferred_path: preferred.path().to_path_buf(),
    path: preferred.path().to_path_buf(),
    format: preferred.format(),
    candidate_paths: candidates.iter().map(|candidate| candidate.path().to_path_buf()).collect(),
})
```

`ResolvedSpecDocumentPath` には watcher 用の候補一覧を追加する。

```rust
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedSpecDocumentPath {
    preferred_path: PathBuf,
    path: PathBuf,
    format: SpecDocumentFormat,
    candidate_paths: Vec<PathBuf>,
}

impl ResolvedSpecDocumentPath {
    pub fn candidate_paths(&self) -> &[PathBuf];
}
```

### 6. [MODIFY] file watcher candidate targets

対象: `spec-viewer/src-tauri/src/app/services/file_watching.rs`

Before:

```rust
let mut targets = vec![FileWatchTarget::required(
    FileWatchTargetKind::Markdown,
    resolved_document_path.path().to_path_buf(),
)];

if resolved_document_path.path() != resolved_document_path.preferred_path() {
    targets.push(FileWatchTarget::optional(
        FileWatchTargetKind::Markdown,
        resolved_document_path.preferred_path().to_path_buf(),
    ));
}
```

After:

```rust
let mut targets = vec![FileWatchTarget::required(
    FileWatchTargetKind::Markdown,
    resolved_document_path.path().to_path_buf(),
)];

for candidate_path in resolved_document_path.candidate_paths() {
    if candidate_path != resolved_document_path.path() {
        targets.push(FileWatchTarget::optional(
            FileWatchTargetKind::Markdown,
            candidate_path.to_path_buf(),
        ));
    }
}
```

これにより、Tech Reference が missing の状態でも `tech-reference.html` と `tech-reference.md` の作成を検知できる。既存 `.md -> .html` fallback の watch は維持される。

### 7. [MODIFY] TypeScript key union

対象: `spec-viewer/src/features/specs/types/spec.ts`

Before:

```ts
export type SpecFileKey =
  | "exploration"
  | "hearing"
  | "impl"
  | "tasks"
  | "requirements"
  | "design";
```

After:

```ts
export type SpecFileKey =
  | "exploration"
  | "hearing"
  | "impl"
  | "tasks"
  | "tech-reference"
  | "requirements"
  | "design";
```

React component の追加実装は原則不要。`SpecTabs` は `spec.files.map` の順序、`MarkdownViewer` は `document.format` の分岐を既に持つ。

## テスト戦略分析

今回の主な機能タイプは **State Management / Data Transformation / Async Operations / UI Component** の組み合わせとして扱う。

### State Management

- 対象: `useSpecs` の selected file 維持、タブ順、missing/ready/error state。
- 方針: 既存 `useSpecs.state.test.tsx` / `AppShell.state.test.tsx` に fixture を追加し、Tech Reference が3番目に表示されても初期選択や再読み込み保持が崩れないことを確認する。

### Data Transformation

- 対象: `SpecFileKey` 追加、workspace default mapping、candidate path generation、scan result format。
- 方針: Rust 側は TDD 寄り。最初に candidate resolver と default config の失敗テストを追加し、その後実装する。
- 特に `Tasks` など既存キーの Markdown 優先挙動を regression test として残す。

### Async Operations

- 対象: Tauri `read_spec_file`、filesystem read、watch target generation。
- 方針: `FilesystemMarkdownReader` と `plan_file_watch` の単体テストで、HTML/MD 両方存在、HTMLのみ、MDのみ、両方なし、config override を検証する。
- IPC wrapper は TypeScript union 追従が主。必要なら `tauri.integration.test.ts` に `fileKey: "tech-reference"` の payload test を追加する。

### UI Component

- 対象: `SpecTabs` と `MarkdownViewer`。
- 方針: React 側は既存テスト追加方針。`SpecTabs` は backend-provided order をそのまま表示するため、5ファイル fixture の順序確認を追加する。HTML iframe 表示は既存テストを活かし、Tech Reference 用 Storybook story を追加して visual check しやすくする。

### Rust TDD の順序

1. RED: `SpecFileKey::from_str("tech-reference")`、label、plugin default order、compat default 不変のテストを追加する。
2. GREEN: enum/key/default mapping を追加する。
3. RED: `spec_file_path_candidates` の TechReference HTML優先、override stem fallback、既存 Tasks markdown優先のテストを追加する。
4. GREEN: candidate resolver を実装し、scan/read/watch に接続する。
5. REFACTOR: `html_fallback_path` の重複や旧 helper を削除または private helper に整理する。

## 実装状態

### 実装済み

- `MarkdownViewer` は `document.format === "html"` で sandbox iframe 表示できる。
- HTML 表示時はコメント scope と文書検索が既存ロジックで無効化される。
- `SpecTabs` は `SpecNode.files` の順序通りにタブを描画する。
- plugin workspace default は Rust domain/config で一元管理されている。

### 未実装

- `SpecFileKey::TechReference`。
- plugin workspace default の3番目タブ追加。
- Tech Reference 専用 `.html -> .md` candidate resolution。
- config override 時の same stem fallback。
- scan/read/watch の候補解決共有。
- TypeScript union の新キー追従。
- Rust/React/Storybook/Playwright 検証。

## 移行計画

1. **Phase 1: Domain and Config**
   - `SpecFileKey` と plugin workspace default mapping を追加する。
   - compatibility default は変更しない。

2. **Phase 2: Candidate Resolution**
   - `infrastructure/spec_file_resolution.rs` を追加し、key-aware candidate order を実装する。
   - scan/read/watch へ接続する。

3. **Phase 3: Frontend Type Follow-up**
   - TypeScript の `SpecFileKey` union を更新する。
   - 既存 components は必要最小限の test/story 追加に留める。

4. **Phase 4: Tests and Verification**
   - Rust TDD サイクルで fallback と default order を固める。
   - React test、Storybook、playwright-cli で UI 表示を確認する。

## 技術的な詳細

### エラーハンドリング

- 両候補が存在しない場合、Tech Reference は `Missing` とし、format は優先候補の `Html` とする。既存 missing UI を使う。
- path escape は全 candidate に `ensure_within_workspace` を適用する。
- metadata/read error は既存 `MarkdownReadError` / `SpecTreeScanError` に乗せる。
- config override で unsafe filename が指定された場合は既存 validation のエラーを使う。

### パフォーマンス考慮

- 追加される filesystem metadata check は Tech Reference で最大2候補。既存 scan/read と同程度のコスト。
- React 側は新規 state を増やさず、既存 tab array の要素が1つ増えるだけにする。
- watch target は candidate path を optional に追加するが、親ディレクトリ単位の non-recursive watch は既存設計を維持する。

## Definition of Done

- plugin workspace / plugin worktree default のタブ順が `Implementation`, `Tasks`, `Tech Reference`, `Exploration`, `Hearing` になる。
- `.spec-skill` compatibility workspace の default タブ順は変更されない。
- `tech-reference.html` と `tech-reference.md` が両方存在する場合、HTML が表示される。
- `tech-reference.html` がなく `tech-reference.md` が存在する場合、Markdown が表示される。
- 両方ない場合でも `Tech Reference` タブは表示され、既存 missing/empty state に沿う。
- config override で `guide.md` または `guide.html` を指定した場合、`guide.html` 優先、`guide.md` fallback になる。
- 既存キーの `.md -> .html` fallback と Markdown 優先挙動が壊れていない。
- HTML 表示は既存 sandbox iframe 仕様のまま、コメントと文書検索なし。
- Rust test、frontend test、Storybook + playwright-cli の UI確認が完了している。

## 参考資料

- `.plugin-workspace/.specs/036-tech-reference-tab/hearing-notes.md`
- `.plugin-workspace/.specs/036-tech-reference-tab/exploration-report.md`


## 実装タスク一覧

# Tech Reference Tab Tasks

## Research & Planning

- [x] 要件を確認する
  - `Tech Reference` は plugin workspace タブ3番目に常設する。
  - `tech-reference.html` 優先、なければ `tech-reference.md` を表示する。
  - config override は same stem で `.html` 優先 + `.md` fallback とする。
  - HTML 表示は既存 iframe 仕様を維持し、コメントと文書検索は不要。
- [x] 探索結果を反映する
  - `SpecTabs` は backend の `SpecNode.files` 順序をそのまま描画する。
  - `MarkdownViewer` は HTML iframe 表示を既に持つ。
  - 既存 fallback は `.md -> .html` なので全体反転しない。
- [x] 実装方針を確定する
  - `SpecFileKey::TechReference` を追加する。
  - plugin workspace default のみ3番目へ追加する。
  - key-aware candidate resolver を Rust infrastructure に追加する。

## Implementation

- [x] `spec-viewer/src-tauri/src/domain/spec/mod.rs` を更新する
  - [x] `SpecFileKey::TechReference` を enum に追加する。
  - [x] `DEFAULT_KEYS` を `[Impl, Tasks, TechReference, Exploration, Hearing]` に変更する。
  - [x] `COMPATIBILITY_KEYS` は `[Requirements, Design, Tasks]` のまま維持する。
  - [x] `as_str()` に `"tech-reference"` を追加する。
  - [x] `display_label()` に `"Tech Reference"` を追加する。
  - [x] `FromStr` に `"tech-reference"` を追加する。

- [x] `spec-viewer/src-tauri/src/domain/workspace/config.rs` を更新する
  - [x] `plugin_workspace_default_file_name()` に `TechReference => "tech-reference.html"` を追加する。
  - [x] `spec_skill_default_file_name()` に exhaustive match 用の `TechReference` arm を追加する。
  - [x] plugin workspace default の順序 test を更新する。
  - [x] spec skill default の順序 test が変わらないことを確認する。

- [x] `spec-viewer/src-tauri/src/infrastructure/spec_file_resolution.rs` を追加する
  - [x] `SpecFilePathCandidate` 型を定義する。
  - [x] `SpecFilePathCandidate::new(path, format)` を実装する。
  - [x] `SpecFilePathCandidate::path()` を実装する。
  - [x] `SpecFilePathCandidate::format()` を実装する。
  - [x] `spec_file_path_candidates(key, configured_path)` を実装する。
  - [x] `TechReference` は `configured_path.with_extension("html")`, `configured_path.with_extension("md")` の順にする。
  - [x] 既存 Markdown key は configured `.md` 優先 + `.html` fallback にする。
  - [x] 既存 configured `.html` key は reverse fallback しない。
  - [x] `spec-viewer/src-tauri/src/infrastructure/mod.rs` に module export を追加する。

- [x] `spec-viewer/src-tauri/src/infrastructure/filesystem/mod.rs` を更新する
  - [x] `spec_file_path_candidates` を import する。
  - [x] `collect_spec_files()` から `resolve_spec_file_for_scan(mapping.key(), &file_path)` を呼ぶ。
  - [x] `resolve_spec_file_for_scan()` の引数を `SpecFileKey` と configured path に変更する。
  - [x] candidate を順番に metadata check し、最初に存在した candidate の `status` と `format` を返す。
  - [x] どれも存在しない場合は最初の candidate の format で `Missing` を返す。
  - [x] 旧 `html_fallback_path()` が不要になった場合は削除する。

- [x] `spec-viewer/src-tauri/src/infrastructure/markdown/mod.rs` を更新する
  - [x] `spec_file_path_candidates` を import する。
  - [x] `ResolvedSpecDocumentPath` に `candidate_paths: Vec<PathBuf>` を追加する。
  - [x] `ResolvedSpecDocumentPath::candidate_paths()` を追加する。
  - [x] `resolve_spec_document_path()` で全 candidate に `ensure_within_workspace()` を適用する。
  - [x] candidate を順番に `file_exists()` で確認し、最初に存在した path/format を返す。
  - [x] どれも存在しない場合は最初の candidate を missing 用 path/format として返す。
  - [x] 既存 `markdown_file_path()` の戻り値が selected path を返すことを維持する。
  - [x] 旧 `html_fallback_path()` が不要になった場合は削除する。

- [x] `spec-viewer/src-tauri/src/app/services/file_watching.rs` を更新する
  - [x] required target は resolved active path のままにする。
  - [x] `resolved_document_path.candidate_paths()` の active path 以外を optional Markdown target として追加する。
  - [x] config と spec override config の watch target は既存通り維持する。

- [x] `spec-viewer/src-tauri/src/presentation/commands/specs.rs` を確認する
  - [x] `SpecFileKey::from_str()` 追加だけで `read_spec_file` が `tech-reference` を受けられることを確認する。
  - [x] DTO 変換で label/fileName/status/format が既存通り返ることを確認する。

- [x] `spec-viewer/src/features/specs/types/spec.ts` を更新する
  - [x] `SpecFileKey` union に `"tech-reference"` を追加する。

- [x] React component 変更の要否を確認する
  - [x] `SpecTabs.tsx` は backend order を描画するだけなので原則変更しない。
  - [x] `MarkdownViewer.tsx` は HTML iframe 分岐を既に持つため原則変更しない。
  - [x] UI text 追加が必要な場合のみ `uiText` を最小更新する。

- [x] Storybook を追加または更新する
  - [x] `spec-viewer/src/features/specs/components/MarkdownViewer.stories.tsx` に HTML Tech Reference 相当の story を追加する。
  - [x] 必要なら `spec-viewer/src/shared/ui/AppShell.stories.tsx` に5タブ構成の story を追加する。

## Test

- [x] Rust RED: domain/config の失敗テストを先に追加する
  - [x] `SpecFileKey::default_keys()` が TechReference を3番目に含むこと。
  - [x] `SpecFileKey::compatibility_keys()` が TechReference を含まないこと。
  - [x] `SpecFileKey::from_str("tech-reference")` が成功すること。
  - [x] `TechReference.as_str()` と `display_label()` が期待値を返すこと。
  - [x] plugin workspace default が `tech-reference.html` を含むこと。
  - [x] spec skill default が従来の3件から変わらないこと。

- [x] Rust GREEN: domain/config 実装で RED を通す
  - [x] enum/key/default mapping を実装する。
  - [x] exhaustive match の漏れを解消する。

- [x] Rust REFACTOR: domain/config を整理する
  - [x] default order の期待値を読みやすく保つ。
  - [x] 互換 workspace 不変の test 名を明確にする。

- [x] Rust RED: candidate resolver の失敗テストを追加する
  - [x] TechReference + `tech-reference.html` は `[tech-reference.html, tech-reference.md]`。
  - [x] TechReference + override `guide.md` は `[guide.html, guide.md]`。
  - [x] Tasks + `tasks.md` は `[tasks.md, tasks.html]`。
  - [x] Tasks + `preview.html` は `[preview.html]`。

- [x] Rust GREEN: candidate resolver を実装する
  - [x] key-aware candidate order を実装する。
  - [x] filesystem/markdown/watch へ接続する。

- [x] Rust REFACTOR: fallback 旧実装を整理する
  - [x] 重複 helper を削除または candidate resolver に集約する。
  - [x] scan/read/watch の命名を揃える。

- [x] Rust integration/unit tests を追加する
  - [x] `FilesystemMarkdownReader` は TechReference で HTML/MD 両方存在時に HTML を読む。
  - [x] `FilesystemMarkdownReader` は TechReference で HTML なし MD あり時に Markdown を読む。
  - [x] `FilesystemMarkdownReader` は TechReference で両方なし時に Missing/html を返す。
  - [x] `FilesystemMarkdownReader` は TechReference override `guide.md` で `guide.html` を優先する。
  - [x] 既存 Tasks は両方存在時に Markdown を優先し続ける。
  - [x] `FilesystemSpecTreeScanner` は TechReference の status/format を candidate に従って返す。
  - [x] `plan_file_watch` は TechReference missing 時も HTML と MD の両 candidate を target に含む。
  - [x] `plan_file_watch` は TechReference MD fallback active 時に HTML preferred path も監視する。

- [x] Frontend tests を追加する
  - [x] `SpecFileKey` union 追加後に TypeScript 型チェックが通ること。
  - [x] `AppShell.state.test.tsx` または `SpecTabs` 経路で5タブ fixture の3番目が `Tech Reference` であること。
  - [x] `useSpecs.state.test.tsx` で5タブ構成でも初期選択と selected file preserve が既存通りであること。
  - [x] 既存 `MarkdownViewer` HTML iframe test が通ること。
  - [x] 必要なら `tauri.integration.test.ts` に `fileKey: "tech-reference"` の payload test を追加する。

## Verification

- [x] Rust test を実行する
  - [x] `cargo test --manifest-path spec-viewer/src-tauri/Cargo.toml`

- [x] Frontend test を実行する
  - [x] `cd spec-viewer`
  - [x] `npm test -- --run`
  - [x] `npm run typecheck`
  - [x] `npm run lint`

- [x] Storybook で UI を確認する
  - [x] `cd spec-viewer`
  - [x] `npm run storybook`
  - [x] Tech Reference HTML story を開き、iframe 表示が崩れていないことを確認する。
  - [x] 5タブ story を開き、`Implementation`, `Tasks`, `Tech Reference`, `Exploration`, `Hearing` の順で表示されることを確認する。

- [x] playwright-cli で Storybook を確認する
  - [x] Storybook の Tech Reference HTML story を playwright-cli で開く。
  - [x] デスクトップ幅で3番目タブと iframe の表示をスクリーンショット確認する。
  - [x] モバイル相当幅でタブ列が破綻しないことをスクリーンショット確認する。
  - [x] HTML iframe 表示時に文書検索 UI とコメント追加導線が出ないことを確認する。

- [x] 手動シナリオを確認する
  - [x] `tech-reference.html` のみ存在する spec を開く。
  - [x] `tech-reference.md` のみ存在する spec を開く。
  - [x] 両方存在する spec を開き HTML が優先されることを確認する。
  - [x] 両方存在しない spec で `Tech Reference` タブが missing 状態を表示することを確認する。
  - [x] spec override で `guide.md` を指定し、`guide.html` 優先 + `guide.md` fallback になることを確認する。
  - [x] `.spec-skill` compatibility workspace で Tech Reference が default に出ないことを確認する。


## 変更されたファイル

.plugin-workspace/.specs/036-tech-reference-tab/tasks.md
spec-viewer/src-tauri/src/app/services/file_watching.rs
spec-viewer/src-tauri/src/domain/spec/mod.rs
spec-viewer/src-tauri/src/domain/workspace/config.rs
spec-viewer/src-tauri/src/infrastructure/filesystem/mod.rs
spec-viewer/src-tauri/src/infrastructure/markdown/mod.rs
spec-viewer/src-tauri/src/infrastructure/mod.rs
spec-viewer/src-tauri/src/infrastructure/persistence/config.rs
spec-viewer/src-tauri/src/infrastructure/spec_file_resolution.rs
spec-viewer/src/features/specs/components/MarkdownViewer.stories.tsx
spec-viewer/src/features/specs/components/MarkdownViewer.tsx
spec-viewer/src/features/specs/components/__tests__/MarkdownViewer.rendering.test.tsx
spec-viewer/src/features/specs/hooks/__tests__/useSpecs.state.test.tsx
spec-viewer/src/features/specs/types/spec.ts
spec-viewer/src/shared/ui/__tests__/AppShell.state.test.tsx


## 変更内容

```diff
diff --git a/spec-viewer/src-tauri/src/app/services/file_watching.rs b/spec-viewer/src-tauri/src/app/services/file_watching.rs
index 8040190..1c87be4 100644
--- a/spec-viewer/src-tauri/src/app/services/file_watching.rs
+++ b/spec-viewer/src-tauri/src/app/services/file_watching.rs
@@ -173,11 +173,13 @@ pub fn plan_file_watch(
         resolved_document_path.path().to_path_buf(),
     )];
 
-    if resolved_document_path.path() != resolved_document_path.preferred_path() {
-        targets.push(FileWatchTarget::optional(
-            FileWatchTargetKind::Markdown,
-            resolved_document_path.preferred_path().to_path_buf(),
-        ));
+    for candidate_path in resolved_document_path.candidate_paths() {
+        if candidate_path != resolved_document_path.path() {
+            targets.push(FileWatchTarget::optional(
+                FileWatchTargetKind::Markdown,
+                candidate_path.to_path_buf(),
+            ));
+        }
     }
 
     targets.extend([
@@ -615,6 +617,10 @@ mod tests {
             fs::write(path, contents).expect("test file should be written");
         }
 
+        fn create_dir(&self, path: &str) {
+            fs::create_dir_all(self.root.join(path)).expect("test directory should be created");
+        }
+
         fn workspace(&self) -> LoadWorkspaceResult {
             let root = WorkspaceRoot::new(self.root.to_string_lossy())
                 .expect("test workspace root should be valid");
@@ -686,6 +692,58 @@ mod tests {
         assert!(markdown_targets[1].ends_with("auth/tasks.md"));
     }
 
+    #[test]
+    fn plan_file_watch_tracks_both_missing_tech_reference_candidates() {
+        let workspace = TestWorkspace::new("tech-reference-missing");
+        workspace.create_dir(".plugin-workspace/.specs/auth");
+        let loaded_workspace = workspace.workspace();
+
+        let plan = plan_file_watch(
+            &loaded_workspace,
+            loaded_workspace.config(),
+            "auth",
+            SpecFileKey::TechReference,
+        )
+        .expect("watch plan should be created");
+
+        let markdown_targets: Vec<&Path> = plan
+            .targets()
+            .iter()
+            .filter(|target| target.kind() == FileWatchTargetKind::Markdown)
+            .map(FileWatchTarget::path)
+            .collect();
+
+        assert_eq!(2, markdown_targets.len());
+        assert!(markdown_targets[0].ends_with("auth/tech-reference.html"));
+        assert!(markdown_targets[1].ends_with("auth/tech-reference.md"));
+    }
+
+    #[test]
+    fn plan_file_watch_tracks_preferred_html_when_tech_reference_markdown_is_active() {
+        let workspace = TestWorkspace::new("tech-reference-markdown-fallback");
+        workspace.write_file(".plugin-workspace/.specs/auth/tech-reference.md", "# Tech");
+        let loaded_workspace = workspace.workspace();
+
+        let plan = plan_file_watch(
+            &loaded_workspace,
+            loaded_workspace.config(),
+            "auth",
+            SpecFileKey::TechReference,
+        )
+        .expect("watch plan should be created");
+
+        let markdown_targets: Vec<&Path> = plan
+            .targets()
+            .iter()
+            .filter(|target| target.kind() == FileWatchTargetKind::Markdown)
+            .map(FileWatchTarget::path)
+            .collect();
+
+        assert_eq!(2, markdown_targets.len());
+        assert!(markdown_targets[0].ends_with("auth/tech-reference.md"));
+        assert!(markdown_targets[1].ends_with("auth/tech-reference.html"));
+    }
+
     #[test]
     fn select_watch_parent_paths_skips_optional_missing_parent() {
         let targets = vec![
diff --git a/spec-viewer/src-tauri/src/domain/spec/mod.rs b/spec-viewer/src-tauri/src/domain/spec/mod.rs
index b03da07..8f28dfc 100644
--- a/spec-viewer/src-tauri/src/domain/spec/mod.rs
+++ b/spec-viewer/src-tauri/src/domain/spec/mod.rs
@@ -42,12 +42,19 @@ pub enum SpecFileKey {
     Hearing,
     Impl,
     Tasks,
+    TechReference,
     Requirements,
     Design,
 }
 
 impl SpecFileKey {
-    pub const DEFAULT_KEYS: [Self; 4] = [Self::Impl, Self::Tasks, Self::Exploration, Self::Hearing];
+    pub const DEFAULT_KEYS: [Self; 5] = [
+        Self::Impl,
+        Self::Tasks,
+        Self::TechReference,
+        Self::Exploration,
+        Self::Hearing,
+    ];
     pub const COMPATIBILITY_KEYS: [Self; 3] = [Self::Requirements, Self::Design, Self::Tasks];
 
     pub fn as_str(self) -> &'static str {
@@ -56,6 +63,7 @@ impl SpecFileKey {
             Self::Hearing => "hearing",
             Self::Impl => "impl",
             Self::Tasks => "tasks",
+            Self::TechReference => "tech-reference",
             Self::Requirements => "requirements",
             Self::Design => "design",
         }
@@ -67,6 +75,7 @@ impl SpecFileKey {
             Self::Hearing => "Hearing",
             Self::Impl => "Implementation",
             Self::Tasks => "Tasks",
+            Self::TechReference => "Tech Reference",
             Self::Requirements => "Requirements",
             Self::Design => "Design",
         }
@@ -96,6 +105,7 @@ impl FromStr for SpecFileKey {
             "hearing" => Ok(Self::Hearing),
             "impl" => Ok(Self::Impl),
             "tasks" => Ok(Self::Tasks),
+            "tech-reference" => Ok(Self::TechReference),
             "requirements" => Ok(Self::Requirements),
             "design" => Ok(Self::Design),
             _ => Err(SpecDomainError::UnsupportedFileKey {
@@ -581,6 +591,7 @@ mod tests {
             &[
                 SpecFileKey::Impl,
                 SpecFileKey::Tasks,
+                SpecFileKey::TechReference,
                 SpecFileKey::Exploration,
                 SpecFileKey::Hearing,
             ],
@@ -606,6 +617,11 @@ mod tests {
         assert_eq!("Exploration", SpecFileKey::Exploration.display_label());
         assert_eq!("impl", SpecFileKey::Impl.as_str());
         assert_eq!("Implementation", SpecFileKey::Impl.display_label());
+        assert_eq!("tech-reference", SpecFileKey::TechReference.as_str());
+        assert_eq!(
+            "Tech Reference",
+            SpecFileKey::TechReference.display_label()
+        );
     }
 
     #[test]
@@ -615,6 +631,10 @@ mod tests {
             SpecFileKey::from_str("requirements")
         );
         assert_eq!(Ok(SpecFileKey::Design), SpecFileKey::from_str("design"));
+        assert_eq!(
+            Ok(SpecFileKey::TechReference),
+            SpecFileKey::from_str("tech-reference")
+        );
     }
 
     #[test]
diff --git a/spec-viewer/src-tauri/src/domain/workspace/config.rs b/spec-viewer/src-tauri/src/domain/workspace/config.rs
index 582f108..cd445a9 100644
--- a/spec-viewer/src-tauri/src/domain/workspace/config.rs
+++ b/spec-viewer/src-tauri/src/domain/workspace/config.rs
@@ -240,6 +240,7 @@ fn plugin_workspace_default_file_name(key: SpecFileKey) -> &'static str {
         SpecFileKey::Hearing => "hearing-notes.md",
         SpecFileKey::Impl => "implementation-plan.md",
         SpecFileKey::Tasks => "tasks.md",
+        SpecFileKey::TechReference => "tech-reference.html",
         SpecFileKey::Requirements => "requirements.md",
         SpecFileKey::Design => "design.md",
     }
@@ -275,6 +276,7 @@ fn spec_skill_default_file_name(key: SpecFileKey) -> &'static str {
         SpecFileKey::Requirements => "requirements.md",
         SpecFileKey::Design => "design.md",
         SpecFileKey::Tasks => "tasks.md",
+        SpecFileKey::TechReference => "tech-reference.html",
         SpecFileKey::Exploration => "exploration-report.md",
         SpecFileKey::Hearing => "hearing-notes.md",
         SpecFileKey::Impl => "implementation-plan.md",
@@ -330,6 +332,7 @@ mod tests {
             vec![
                 (SpecFileKey::Impl, "implementation-plan.md"),
                 (SpecFileKey::Tasks, "tasks.md"),
+                (SpecFileKey::TechReference, "tech-reference.html"),
                 (SpecFileKey::Exploration, "exploration-report.md"),
                 (SpecFileKey::Hearing, "hearing-notes.md"),
             ],
@@ -407,6 +410,7 @@ mod tests {
             vec![
                 (SpecFileKey::Impl, "implementation-plan.md"),
                 (SpecFileKey::Tasks, "tasks.md"),
+                (SpecFileKey::TechReference, "tech-reference.html"),
                 (SpecFileKey::Exploration, "exploration-report.md"),
                 (SpecFileKey::Hearing, "interview.md"),
                 (SpecFileKey::Design, "design.md"),
diff --git a/spec-viewer/src-tauri/src/infrastructure/filesystem/mod.rs b/spec-viewer/src-tauri/src/infrastructure/filesystem/mod.rs
index e5ba123..1c1a5da 100644
--- a/spec-viewer/src-tauri/src/infrastructure/filesystem/mod.rs
+++ b/spec-viewer/src-tauri/src/infrastructure/filesystem/mod.rs
@@ -8,12 +8,17 @@ use std::{
 use thiserror::Error;
 
 use crate::domain::{
-    spec::{SpecDocumentFormat, SpecDomainError, SpecFile, SpecFileStatus, SpecNode},
+    spec::{
+        SpecDocumentFormat, SpecDomainError, SpecFile, SpecFileKey, SpecFileStatus, SpecNode,
+    },
     workspace::{
         WorkspaceConfig, WorkspaceDomainError, WorkspaceKind, WorkspaceLayout, WorkspaceRoot,
     },
 };
 use crate::infrastructure::persistence::config::{ConfigLoadError, WorkspaceConfigLoader};
+use crate::infrastructure::spec_file_resolution::{
+    spec_file_path_candidates, SpecFilePathCandidate,
+};
 
 const PLUGIN_WORKSPACE_SPECS_DIR: &str = ".plugin-workspace/.specs";
 const PLUGIN_WORKSPACE_DIRECTORY: &str = ".plugin-workspace";
@@ -698,7 +703,7 @@ fn scan_spec_files(
         .iter()
         .map(|mapping| {
             let file_path = directory.join(mapping.file_name());
-            let resolved_file = resolve_spec_file_for_scan(&file_path)?;
+            let resolved_file = resolve_spec_file_for_scan(mapping.key(), &file_path)?;
 
             SpecFile::with_resolved_format(
                 mapping.key(),
@@ -721,30 +726,23 @@ struct ScannedSpecFile {
     format: SpecDocumentFormat,
 }
 
-fn resolve_spec_file_for_scan(path: &Path) -> Result<ScannedSpecFile, SpecTreeScanError> {
-    let preferred_format = SpecDocumentFormat::from_file_name(&display_path(path));
-
-    if spec_file_status(path)? == SpecFileStatus::Present {
-        return Ok(ScannedSpecFile {
-            status: SpecFileStatus::Present,
-            format: preferred_format,
-        });
-    }
-
-    let Some(html_fallback_path) = html_fallback_path(path) else {
-        return Ok(ScannedSpecFile {
-            status: SpecFileStatus::Missing,
-            format: preferred_format,
-        });
-    };
-
-    let fallback_status = spec_file_status(&html_fallback_path)?;
-
-    if fallback_status == SpecFileStatus::Present {
-        return Ok(ScannedSpecFile {
-            status: SpecFileStatus::Present,
-            format: SpecDocumentFormat::Html,
-        });
+fn resolve_spec_file_for_scan(
+    key: SpecFileKey,
+    configured_path: &Path,
+) -> Result<ScannedSpecFile, SpecTreeScanError> {
+    let candidates = spec_file_path_candidates(key, configured_path);
+    let preferred_format = candidates
+        .first()
+        .map(SpecFilePathCandidate::format)
+        .unwrap_or_else(|| SpecDocumentFormat::from_file_name(&display_path(configured_path)));
+
+    for candidate in &candidates {
+        if spec_file_status(candidate.path())? == SpecFileStatus::Present {
+            return Ok(ScannedSpecFile {
+                status: SpecFileStatus::Present,
+                format: candidate.format(),
+            });
+        }
     }
 
     Ok(ScannedSpecFile {
@@ -753,18 +751,6 @@ fn resolve_spec_file_for_scan(path: &Path) -> Result<ScannedSpecFile, SpecTreeSc
     })
 }
 
-fn html_fallback_path(path: &Path) -> Option<PathBuf> {
-    if !path
-        .extension()
-        .and_then(|extension| extension.to_str())
-        .is_some_and(|extension| extension.eq_ignore_ascii_case("md"))
-    {
-        return None;
-    }
-
-    Some(path.with_extension("html"))
-}
-
 fn config_for_spec_directory(
     directory: &Path,
     config: &WorkspaceConfig,
@@ -878,7 +864,7 @@ mod tests {
 
     use super::*;
     use crate::domain::{
-        spec::{SpecFileKey, SpecFileStatus},
+        spec::{SpecDocumentFormat, SpecFileKey, SpecFileStatus},
         workspace::{WorkspaceFileMapping, WorkspaceRoot},
     };
 
@@ -1112,6 +1098,47 @@ mod tests {
         );
     }
 
+    #[test]
+    fn spec_tree_scanner_reports_tech_reference_html_when_both_candidates_exist() {
+        let workspace = TestWorkspace::new("tech-reference-html-first");
+        workspace.create_dir(PLUGIN_WORKSPACE_SPECS_DIR);
+        workspace.write_file(".plugin-workspace/.specs/auth/tech-reference.html", "<h1>Tech</h1>");
+        workspace.write_file(".plugin-workspace/.specs/auth/tech-reference.md", "# Tech");
+        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);
+        let config = WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace);
+
+        let tree = FilesystemSpecTreeScanner::new()
+            .scan(&layout, &config)
+            .expect("spec tree should be scanned");
+
+        let auth = &tree[0].children()[0];
+        let tech_reference = auth
+            .file_for_key(SpecFileKey::TechReference)
+            .expect("tech reference file should be configured");
+        assert_eq!(SpecFileStatus::Present, tech_reference.status());
+        assert_eq!(SpecDocumentFormat::Html, tech_reference.format());
+        assert_eq!("tech-reference.html", tech_reference.file_name());
+    }
+
+    #[test]
+    fn spec_tree_scanner_reports_missing_tech_reference_as_html() {
+        let workspace = TestWorkspace::new("tech-reference-missing");
+        workspace.create_dir(".plugin-workspace/.specs/auth");
+        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);
+        let config = WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace);
+
+        let tree = FilesystemSpecTreeScanner::new()
+            .scan(&layout, &config)
+            .expect("spec tree should be scanned");
+
+        let auth = &tree[0].children()[0];
+        let tech_reference = auth
+            .file_for_key(SpecFileKey::TechReference)
+            .expect("tech reference file should be configured");
+        assert_eq!(SpecFileStatus::Missing, tech_reference.status());
+        assert_eq!(SpecDocumentFormat::Html, tech_reference.format());
+    }
+
     #[test]
     fn spec_tree_scanner_ignores_hidden_directories() {
         let workspace = TestWorkspace::new("hidden");
@@ -1325,6 +1352,7 @@ mod tests {
             vec![
                 (SpecFileKey::Impl, SpecFileStatus::Present),
                 (SpecFileKey::Tasks, SpecFileStatus::Present),
+                (SpecFileKey::TechReference, SpecFileStatus::Missing),
                 (SpecFileKey::Exploration, SpecFileStatus::Present),
                 (SpecFileKey::Hearing, SpecFileStatus::Present),
             ],
@@ -1373,6 +1401,7 @@ mod tests {
             vec![
                 (SpecFileKey::Impl, SpecFileStatus::Present),
                 (SpecFileKey::Tasks, SpecFileStatus::Present),
+                (SpecFileKey::TechReference, SpecFileStatus::Missing),
                 (SpecFileKey::Exploration, SpecFileStatus::Present),
                 (SpecFileKey::Hearing, SpecFileStatus::Present),
             ],
@@ -1422,6 +1451,7 @@ mod tests {
             vec![
                 (SpecFileKey::Impl, SpecFileStatus::Present),
                 (SpecFileKey::Tasks, SpecFileStatus::Present),
+                (SpecFileKey::TechReference, SpecFileStatus::Missing),
                 (SpecFileKey::Exploration, SpecFileStatus::Present),
                 (SpecFileKey::Hearing, SpecFileStatus::Present),
             ],
diff --git a/spec-viewer/src-tauri/src/infrastructure/markdown/mod.rs b/spec-viewer/src-tauri/src/infrastructure/markdown/mod.rs
index 5960234..8e73ea7 100644
--- a/spec-viewer/src-tauri/src/infrastructure/markdown/mod.rs
+++ b/spec-viewer/src-tauri/src/infrastructure/markdown/mod.rs
@@ -17,7 +17,10 @@ use crate::{
         spec::{MarkdownBlock, SpecDocumentFormat, SpecFileKey},
         workspace::{WorkspaceConfig, WorkspaceLayout},
     },
-    infrastructure::filesystem::spec_directory_path,
+    infrastructure::{
+        filesystem::spec_directory_path,
+        spec_file_resolution::{spec_file_path_candidates, SpecFilePathCandidate},
+    },
 };
 
 use self::parser::{parse_markdown_blocks, MarkdownParseError};
@@ -168,6 +171,7 @@ pub struct ResolvedSpecDocumentPath {
     preferred_path: PathBuf,
     path: PathBuf,
     format: SpecDocumentFormat,
+    candidate_paths: Vec<PathBuf>,
 }
 
 impl ResolvedSpecDocumentPath {
@@ -182,6 +186,10 @@ impl ResolvedSpecDocumentPath {
     pub fn format(&self) -> SpecDocumentFormat {
         self.format
     }
+
+    pub fn candidate_paths(&self) -> &[PathBuf] {
+        &self.candidate_paths
+    }
 }
 
 #[derive(Debug, Error)]
@@ -229,43 +237,23 @@ pub fn resolve_spec_document_path(
         spec_directory_path(layout, spec_id).map_err(|_| MarkdownReadError::InvalidSpecId {
             spec_id: spec_id.to_string(),
         })?;
-    let preferred_path = spec_directory.join(mapping.file_name());
-
-    ensure_within_workspace(layout, &preferred_path)?;
-
-    let preferred_format = SpecDocumentFormat::from_file_name(mapping.file_name());
+    let configured_path = spec_directory.join(mapping.file_name());
+    let candidates = spec_file_path_candidates(key, &configured_path);
+    let preferred = candidates
+        .first()
+        .ok_or(MarkdownReadError::MissingFileMapping { key })?;
 
-    if preferred_format == SpecDocumentFormat::Html || file_exists(&preferred_path)? {
-        return Ok(ResolvedSpecDocumentPath {
-            preferred_path: preferred_path.clone(),
-            path: preferred_path,
-            format: preferred_format,
-        });
+    for candidate in &candidates {
+        ensure_within_workspace(layout, candidate.path())?;
     }
 
-    let Some(html_fallback_path) = html_fallback_path(&preferred_path) else {
-        return Ok(ResolvedSpecDocumentPath {
-            preferred_path: preferred_path.clone(),
-            path: preferred_path,
-            format: SpecDocumentFormat::Markdown,
-        });
-    };
-
-    ensure_within_workspace(layout, &html_fallback_path)?;
-
-    if file_exists(&html_fallback_path)? {
-        return Ok(ResolvedSpecDocumentPath {
-            preferred_path,
-            path: html_fallback_path,
-            format: SpecDocumentFormat::Html,
-        });
+    for candidate in &candidates {
+        if file_exists(candidate.path())? {
+            return Ok(resolved_spec_document_path(candidate, preferred, &candidates));
+        }
     }
 
-    Ok(ResolvedSpecDocumentPath {
-        preferred_path: preferred_path.clone(),
-        path: preferred_path,
-        format: SpecDocumentFormat::Markdown,
-    })
+    Ok(resolved_spec_document_path(preferred, preferred, &candidates))
 }
 
 fn file_exists(path: &Path) -> Result<bool, MarkdownReadError> {
@@ -279,16 +267,20 @@ fn file_exists(path: &Path) -> Result<bool, MarkdownReadError> {
     }
 }
 
-fn html_fallback_path(preferred_path: &Path) -> Option<PathBuf> {
-    if !preferred_path
-        .extension()
-        .and_then(|extension| extension.to_str())
-        .is_some_and(|extension| extension.eq_ignore_ascii_case("md"))
-    {
-        return None;
+fn resolved_spec_document_path(
+    selected: &SpecFilePathCandidate,
+    preferred: &SpecFilePathCandidate,
+    candidates: &[SpecFilePathCandidate],
+) -> ResolvedSpecDocumentPath {
+    ResolvedSpecDocumentPath {
+        preferred_path: preferred.path().to_path_buf(),
+        path: selected.path().to_path_buf(),
+        format: selected.format(),
+        candidate_paths: candidates
+            .iter()
+            .map(|candidate| candidate.path().to_path_buf())
+            .collect(),
     }
-
-    Some(preferred_path.with_extension("html"))
 }
 
 fn ensure_within_workspace(
@@ -515,6 +507,108 @@ mod tests {
         }
     }
 
+    #[test]
+    fn reads_tech_reference_html_when_both_html_and_markdown_exist() {
+        let workspace = TestWorkspace::new("tech-reference-html-first");
+        workspace.write_file(".plugin-workspace/.specs/auth/tech-reference.html", "<h1>Tech</h1>");
+        workspace.write_file(".plugin-workspace/.specs/auth/tech-reference.md", "# Tech");
+
+        let result = FilesystemMarkdownReader::new()
+            .read(
+                &workspace.layout(),
+                &WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace),
+                "auth",
+                SpecFileKey::TechReference,
+            )
+            .expect("tech reference should be readable");
+
+        match result {
+            MarkdownReadResult::Found(document) => {
+                assert_eq!(SpecDocumentFormat::Html, document.format());
+                assert!(document.path().ends_with("auth/tech-reference.html"));
+                assert_eq!("<h1>Tech</h1>", document.contents());
+                assert!(document.blocks().is_empty());
+            }
+            MarkdownReadResult::Missing(_) => panic!("expected tech reference html document"),
+        }
+    }
+
+    #[test]
+    fn reads_tech_reference_markdown_when_html_is_absent() {
+        let workspace = TestWorkspace::new("tech-reference-markdown-fallback");
+        workspace.write_file(".plugin-workspace/.specs/auth/tech-reference.md", "# Tech");
+
+        let result = FilesystemMarkdownReader::new()
+            .read(
+                &workspace.layout(),
+                &WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace),
+                "auth",
+                SpecFileKey::TechReference,
+            )
+            .expect("tech reference markdown fallback should be readable");
+
+        match result {
+            MarkdownReadResult::Found(document) => {
+                assert_eq!(SpecDocumentFormat::Markdown, document.format());
+                assert!(document.path().ends_with("auth/tech-reference.md"));
+                assert_eq!("# Tech", document.contents());
+                assert_eq!(1, document.blocks().len());
+            }
+            MarkdownReadResult::Missing(_) => panic!("expected tech reference markdown document"),
+        }
+    }
+
+    #[test]
+    fn returns_missing_html_result_for_absent_tech_reference() {
+        let workspace = TestWorkspace::new("tech-reference-missing");
+        workspace.create_dir(".plugin-workspace/.specs/auth");
+
+        let result = FilesystemMarkdownReader::new()
+            .read(
+                &workspace.layout(),
+                &WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace),
+                "auth",
+                SpecFileKey::TechReference,
+            )
+            .expect("missing tech reference should be a UI-friendly result");
+
+        match result {
+            MarkdownReadResult::Found(_) => panic!("expected missing tech reference result"),
+            MarkdownReadResult::Missing(missing) => {
+                assert_eq!(SpecFileKey::TechReference, missing.key());
+                assert_eq!(SpecDocumentFormat::Html, missing.format());
+                assert!(missing.path().ends_with("auth/tech-reference.html"));
+            }
+        }
+    }
+
+    #[test]
+    fn reads_tech_reference_override_html_before_same_stem_markdown() {
+        let workspace = TestWorkspace::new("tech-reference-override");
+        workspace.write_file(".plugin-workspace/.specs/auth/guide.html", "<h1>Guide HTML</h1>");
+        workspace.write_file(".plugin-workspace/.specs/auth/guide.md", "# Guide Markdown");
+        let config =
+            WorkspaceConfig::new(vec![crate::domain::workspace::WorkspaceFileMapping::new(
+                SpecFileKey::TechReference,
+                "guide.md",
+            )
+            .expect("mapping should be valid")])
+            .expect("config should be valid");
+
+        let result = FilesystemMarkdownReader::new()
+            .read(&workspace.layout(), &config, "auth", SpecFileKey::TechReference)
+            .expect("tech reference override should be readable");
+
+        match result {
+            MarkdownReadResult::Found(document) => {
+                assert_eq!(SpecDocumentFormat::Html, document.format());
+                assert!(document.path().ends_with("auth/guide.html"));
+                assert_eq!("<h1>Guide HTML</h1>", document.contents());
+            }
+            MarkdownReadResult::Missing(_) => panic!("expected tech reference html document"),
+        }
+    }
+
     #[test]
     fn reads_configured_html_file_without_markdown_reverse_fallback() {
         let workspace = TestWorkspace::new("configured-html");
diff --git a/spec-viewer/src-tauri/src/infrastructure/mod.rs b/spec-viewer/src-tauri/src/infrastructure/mod.rs
index e946473..c4d4543 100644
--- a/spec-viewer/src-tauri/src/infrastructure/mod.rs
+++ b/spec-viewer/src-tauri/src/infrastructure/mod.rs
@@ -4,3 +4,4 @@ pub mod filesystem;
 pub mod git;
 pub mod markdown;
 pub mod persistence;
+pub mod spec_file_resolution;
diff --git a/spec-viewer/src-tauri/src/infrastructure/persistence/config.rs b/spec-viewer/src-tauri/src/infrastructure/persistence/config.rs
index da0979f..c1d5620 100644
--- a/spec-viewer/src-tauri/src/infrastructure/persistence/config.rs
+++ b/spec-viewer/src-tauri/src/infrastructure/persistence/config.rs
@@ -313,6 +313,7 @@ mod tests {
             vec![
                 (SpecFileKey::Impl, "implementation-plan.md"),
                 (SpecFileKey::Tasks, "tasks.md"),
+                (SpecFileKey::TechReference, "tech-reference.html"),
                 (SpecFileKey::Exploration, "exploration-report.md"),
                 (SpecFileKey::Hearing, "hearing-notes.md"),
             ],
diff --git a/spec-viewer/src/features/specs/components/MarkdownViewer.stories.tsx b/spec-viewer/src/features/specs/components/MarkdownViewer.stories.tsx
index 9499f9e..7a49053 100644
--- a/spec-viewer/src/features/specs/components/MarkdownViewer.stories.tsx
+++ b/spec-viewer/src/features/specs/components/MarkdownViewer.stories.tsx
@@ -38,6 +38,34 @@ const readyState: SpecDocumentState = {
   error: null,
 };
 
+const techReferenceHtmlContents = [
+  "<!doctype html>",
+  "<html>",
+  "<body>",
+  "<main>",
+  "<h1>Tech Reference</h1>",
+  "<p>API surfaces, schema notes, and integration hints stay readable as HTML.</p>",
+  "</main>",
+  "</body>",
+  "</html>",
+].join("");
+
+const techReferenceHtmlState: SpecDocumentState = {
+  status: "ready",
+  workspacePath,
+  specId: "tech-reference-tab",
+  fileKey: "tech-reference",
+  document: {
+    key: "tech-reference",
+    format: "html",
+    path: "/workspace/spec-reviewer/.plugin-workspace/.specs/tech-reference-tab/tech-reference.html",
+    contents: techReferenceHtmlContents,
+    missing: false,
+    blocks: [],
+  },
+  error: null,
+};
+
 const highlightedParagraph =
   "Users can select only this paragraph fragment without activating the highlight.";
 
@@ -139,3 +167,13 @@ export const ExistingCommentCards: Story = {
     activeCommentId: commentId("cmt_active_selection"),
   },
 };
+
+export const TechReferenceHtmlPreview: Story = {
+  args: {
+    state: techReferenceHtmlState,
+    selectedSpecLabel: "Tech Reference Tab",
+    selectedFileLabel: "Tech Reference",
+    comments: [],
+    activeCommentId: null,
+  },
+};
diff --git a/spec-viewer/src/features/specs/components/MarkdownViewer.tsx b/spec-viewer/src/features/specs/components/MarkdownViewer.tsx
index 1c3b0bf..c021c99 100644
--- a/spec-viewer/src/features/specs/components/MarkdownViewer.tsx
+++ b/spec-viewer/src/features/specs/components/MarkdownViewer.tsx
@@ -511,16 +511,18 @@ export function MarkdownViewer({
           <p className="markdown-viewer__path">{state.document.path}</p>
         </div>
         <div className="markdown-viewer__actions">
-          <DocumentSearchControl
-            query={documentSearchQuery}
-            matchCount={documentSearchMatchCount}
-            activeMatchIndex={activeDocumentSearchIndex}
-            disabled={state.document.format === "html"}
-            onQueryChange={setDocumentSearchQuery}
-            onPrevious={goToPreviousDocumentSearchMatch}
-            onNext={goToNextDocumentSearchMatch}
-            onClear={clearDocumentSearch}
-          />
+          {isHtmlDocument ? null : (
+            <DocumentSearchControl
+              query={documentSearchQuery}
+              matchCount={documentSearchMatchCount}
+              activeMatchIndex={activeDocumentSearchIndex}
+              disabled={false}
+              onQueryChange={setDocumentSearchQuery}
+              onPrevious={goToPreviousDocumentSearchMatch}
+              onNext={goToNextDocumentSearchMatch}
+              onClear={clearDocumentSearch}
+            />
+          )}
           <button
             className="icon-button"
             type="button"
diff --git a/spec-viewer/src/features/specs/components/__tests__/MarkdownViewer.rendering.test.tsx b/spec-viewer/src/features/specs/components/__tests__/MarkdownViewer.rendering.test.tsx
index 08e54b1..9e91a2b 100644
--- a/spec-viewer/src/features/specs/components/__tests__/MarkdownViewer.rendering.test.tsx
+++ b/spec-viewer/src/features/specs/components/__tests__/MarkdownViewer.rendering.test.tsx
@@ -217,6 +217,7 @@ test("MarkdownViewerはHTML文書をsandbox iframeで閲覧表示する", () =>
   );
   expect(result.container.querySelector(".markdown-rendered")).toBeNull();
   expect(result.container.querySelector(".markdown-block-comment-button")).toBeNull();
+  expect(result.container.querySelector(".markdown-document-search")).toBeNull();
   result.unmount();
 });
 
diff --git a/spec-viewer/src/features/specs/hooks/__tests__/useSpecs.state.test.tsx b/spec-viewer/src/features/specs/hooks/__tests__/useSpecs.state.test.tsx
index c95d3d3..de3c9c8 100644
--- a/spec-viewer/src/features/specs/hooks/__tests__/useSpecs.state.test.tsx
+++ b/spec-viewer/src/features/specs/hooks/__tests__/useSpecs.state.test.tsx
@@ -116,6 +116,49 @@ const tasksAndDesignTree: SpecTree = {
   ],
 };
 
+const fiveTabTree: SpecTree = {
+  specs: [
+    {
+      id: "tech-reference-tab",
+      label: "Tech Reference Tab",
+      files: [
+        {
+          key: "impl",
+          label: "Implementation",
+          fileName: "implementation-plan.md",
+          status: "present",
+        },
+        {
+          key: "tasks",
+          label: "Tasks",
+          fileName: "tasks.md",
+          status: "present",
+        },
+        {
+          key: "tech-reference",
+          label: "Tech Reference",
+          fileName: "tech-reference.html",
+          status: "missing",
+          format: "html",
+        },
+        {
+          key: "exploration",
+          label: "Exploration",
+          fileName: "exploration-report.md",
+          status: "present",
+        },
+        {
+          key: "hearing",
+          label: "Hearing",
+          fileName: "hearing-notes.md",
+          status: "present",
+        },
+      ],
+      children: [],
+    },
+  ],
+};
+
 const renamedTasksTree: SpecTree = {
   specs: [
     {
@@ -184,6 +227,15 @@ const designDocument: SpecDocument = {
   blocks: [],
 };
 
+const techReferenceDocument: SpecDocument = {
+  key: "tech-reference",
+  format: "html",
+  path: "/workspace/spec-reviewer/.plugin-workspace/.specs/tech-reference-tab/tech-reference.html",
+  contents: null,
+  missing: true,
+  blocks: [],
+};
+
 type HookResult<Props, Result> = Readonly<{
   current: Result;
   rerender: (nextProps: Props) => void;
@@ -504,6 +556,43 @@ test("useSpecsはrefresh時に選択中fileが消えたら同じspecの先頭fil
   result.unmount();
 });
 
+test("useSpecsは5タブ構成でも選択中のTech Referenceをrefresh後に保持する", async () => {
+  const listSpecs = vi.fn().mockResolvedValue(fiveTabTree);
+  const readSpecFile = vi
+    .fn()
+    .mockResolvedValueOnce(missingDocument)
+    .mockResolvedValue(techReferenceDocument);
+
+  const result = renderHook(
+    ({ workspacePath }) => useSpecs({ workspacePath, listSpecs, readSpecFile }),
+    { workspacePath: "/workspace/spec-reviewer" },
+  );
+
+  await act(async () => {
+    await result.current.reloadSpecs();
+  });
+  await act(async () => {
+    await result.current.selectFileKey("tech-reference");
+  });
+  await act(async () => {
+    await result.current.reloadSpecs({ preserveSelection: true });
+  });
+
+  expect(result.current.selectedSpecId).toBe("tech-reference-tab");
+  expect(result.current.selectedFileKey).toBe("tech-reference");
+  expect(result.current.documentState).toEqual(
+    expect.objectContaining({
+      status: "missing",
+      workspacePath: "/workspace/spec-reviewer",
+      specId: "tech-reference-tab",
+      fileKey: "tech-reference",
+      document: techReferenceDocument,
+      error: null,
+    }),
+  );
+  result.unmount();
+});
+
 test("useSpecsはrefresh時に選択中Markdownが削除されたらmissing状態へ更新する", async () => {
   const listSpecs = vi.fn().mockResolvedValue(populatedTree);
   const readSpecFile = vi.fn().mockResolvedValue(loadedDocument);
diff --git a/spec-viewer/src/features/specs/types/spec.ts b/spec-viewer/src/features/specs/types/spec.ts
index 78e3fb4..e842d7b 100644
--- a/spec-viewer/src/features/specs/types/spec.ts
+++ b/spec-viewer/src/features/specs/types/spec.ts
@@ -3,6 +3,7 @@ export type SpecFileKey =
   | "hearing"
   | "impl"
   | "tasks"
+  | "tech-reference"
   | "requirements"
   | "design";
 
diff --git a/spec-viewer/src/shared/ui/__tests__/AppShell.state.test.tsx b/spec-viewer/src/shared/ui/__tests__/AppShell.state.test.tsx
index c4466ac..97c5787 100644
--- a/spec-viewer/src/shared/ui/__tests__/AppShell.state.test.tsx
+++ b/spec-viewer/src/shared/ui/__tests__/AppShell.state.test.tsx
@@ -31,6 +31,28 @@ const implFile: SpecFile = {
   status: "missing",
 };
 
+const techReferenceFile: SpecFile = {
+  key: "tech-reference",
+  label: "Tech Reference",
+  fileName: "tech-reference.html",
+  status: "missing",
+  format: "html",
+};
+
+const explorationFile: SpecFile = {
+  key: "exploration",
+  label: "Exploration",
+  fileName: "exploration-report.md",
+  status: "present",
+};
+
+const hearingFile: SpecFile = {
+  key: "hearing",
+  label: "Hearing",
+  fileName: "hearing-notes.md",
+  status: "present",
+};
+
 const selectedSpec: SpecNode = {
   id: "phase-1-viewer",
   label: "Phase 1 Viewer",
@@ -185,6 +207,39 @@ test("AppShellはtoolbar、tree、tabs、viewer、comment sidebarを表示する
   result.unmount();
 });
 
+test("SpecTabsはbackendの5タブ順をそのまま表示する", () => {
+  const result = renderComponent(
+    <SpecTabs
+      spec={{
+        id: "tech-reference-tab",
+        label: "Tech Reference Tab",
+        files: [
+          implFile,
+          taskFile,
+          techReferenceFile,
+          explorationFile,
+          hearingFile,
+        ],
+        children: [],
+      }}
+      selectedFileKey="tech-reference"
+      onSelectFile={vi.fn()}
+    />,
+  );
+  const labels = Array.from(
+    result.container.querySelectorAll(".spec-tabs__label"),
+  ).map((element) => element.textContent);
+
+  expect(labels).toEqual([
+    "Implementation",
+    "Tasks",
+    "Tech Reference",
+    "Exploration",
+    "Hearing",
+  ]);
+  result.unmount();
+});
+
 test("AppShellはコメントサイドバーを閉じると再オープン導線を表示する", () => {
   const onOpenCommentsSidebar = vi.fn();
   const result = renderComponent(
diff --git a/spec-viewer/src-tauri/src/infrastructure/spec_file_resolution.rs b/spec-viewer/src-tauri/src/infrastructure/spec_file_resolution.rs
new file mode 100644
index 0000000..c7b7511
--- /dev/null
+++ b/spec-viewer/src-tauri/src/infrastructure/spec_file_resolution.rs
@@ -0,0 +1,122 @@
+//! Spec logical-file candidate path resolution.
+
+use std::path::{Path, PathBuf};
+
+use crate::domain::spec::{SpecDocumentFormat, SpecFileKey};
+
+#[derive(Debug, Clone, PartialEq, Eq)]
+pub struct SpecFilePathCandidate {
+    path: PathBuf,
+    format: SpecDocumentFormat,
+}
+
+impl SpecFilePathCandidate {
+    pub fn new(path: PathBuf, format: SpecDocumentFormat) -> Self {
+        Self { path, format }
+    }
+
+    pub fn path(&self) -> &Path {
+        &self.path
+    }
+
+    pub fn format(&self) -> SpecDocumentFormat {
+        self.format
+    }
+}
+
+pub fn spec_file_path_candidates(
+    key: SpecFileKey,
+    configured_path: &Path,
+) -> Vec<SpecFilePathCandidate> {
+    if key == SpecFileKey::TechReference {
+        return vec![
+            SpecFilePathCandidate::new(
+                configured_path.with_extension("html"),
+                SpecDocumentFormat::Html,
+            ),
+            SpecFilePathCandidate::new(
+                configured_path.with_extension("md"),
+                SpecDocumentFormat::Markdown,
+            ),
+        ];
+    }
+
+    let preferred_format = SpecDocumentFormat::from_file_name(&configured_path.to_string_lossy());
+
+    if preferred_format == SpecDocumentFormat::Markdown {
+        return vec![
+            SpecFilePathCandidate::new(configured_path.to_path_buf(), SpecDocumentFormat::Markdown),
+            SpecFilePathCandidate::new(
+                configured_path.with_extension("html"),
+                SpecDocumentFormat::Html,
+            ),
+        ];
+    }
+
+    vec![SpecFilePathCandidate::new(
+        configured_path.to_path_buf(),
+        preferred_format,
+    )]
+}
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    fn candidate_paths(
+        key: SpecFileKey,
+        configured_path: &str,
+    ) -> Vec<(PathBuf, SpecDocumentFormat)> {
+        spec_file_path_candidates(key, Path::new(configured_path))
+            .into_iter()
+            .map(|candidate| (candidate.path().to_path_buf(), candidate.format()))
+            .collect()
+    }
+
+    #[test]
+    fn tech_reference_prefers_html_then_markdown_for_default_file_name() {
+        assert_eq!(
+            vec![
+                (
+                    PathBuf::from("tech-reference.html"),
+                    SpecDocumentFormat::Html
+                ),
+                (
+                    PathBuf::from("tech-reference.md"),
+                    SpecDocumentFormat::Markdown
+                ),
+            ],
+            candidate_paths(SpecFileKey::TechReference, "tech-reference.html")
+        );
+    }
+
+    #[test]
+    fn tech_reference_uses_override_stem_with_html_first() {
+        assert_eq!(
+            vec![
+                (PathBuf::from("guide.html"), SpecDocumentFormat::Html),
+                (PathBuf::from("guide.md"), SpecDocumentFormat::Markdown),
+            ],
+            candidate_paths(SpecFileKey::TechReference, "guide.md")
+        );
+    }
+
+    #[test]
+    fn markdown_keys_keep_markdown_then_html_fallback_order() {
+        assert_eq!(
+            vec![
+                (PathBuf::from("tasks.md"), SpecDocumentFormat::Markdown),
+                (PathBuf::from("tasks.html"), SpecDocumentFormat::Html),
+            ],
+            candidate_paths(SpecFileKey::Tasks, "tasks.md")
+        );
+    }
+
+    #[test]
+    fn configured_html_keys_do_not_reverse_fallback_to_markdown() {
+        assert_eq!(
+            vec![(PathBuf::from("preview.html"), SpecDocumentFormat::Html)],
+            candidate_paths(SpecFileKey::Tasks, "preview.html")
+        );
+    }
+}

```
