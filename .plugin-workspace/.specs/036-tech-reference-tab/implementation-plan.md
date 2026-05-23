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
