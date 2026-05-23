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
