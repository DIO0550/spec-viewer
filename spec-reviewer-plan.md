# spec-reviewer — Spec Skill レビューアプリ

## 概要

Spec Skillが生成するMarkdownファイル群（requirements / design / tasks）を閲覧・レビューするためのTauriデスクトップアプリ。
md本体を汚さずにインラインコメントを付けられる機能を持ち、仕様レビューや振り返りのワークフローを支援する。

---

## ディレクトリ構造（対象プロジェクト側）

```
.spec-skill/
├── config.json                   # ファイル名マッピング（ワークスペース単位）
└── features/
    ├── auth/
    │   ├── requirements.md       # 固定名
    │   ├── design.md             # ユーザー設定可
    │   ├── tasks.md              # ユーザー設定可
    │   └── .comments/            # アプリが管理（md本体には触れない）
    │       ├── requirements.json
    │       ├── design.json
    │       └── tasks.json
    └── payment/
        ├── requirements.md
        ├── implementation-plan.md
        └── todo.md
```

### config.json

```json
{
  "files": {
    "requirements": "requirements.md",
    "design": "design.md",
    "tasks": "tasks.md"
  }
}
```

- 論理名（requirements / design / tasks）→ 実ファイル名のマッピング
- コメント保存は論理名キーで固定（リネーム耐性）
- feature単位でのオーバーライドは Phase 1 では対象外

---

## アプリ構成

```
spec-reviewer/
├── src-tauri/
│   └── src/
│       ├── main.rs
│       ├── config.rs        # config.json 読み込み・解決
│       ├── feature.rs       # feature一覧スキャン
│       ├── comment/
│       │   ├── mod.rs
│       │   ├── store.rs     # JSON I/O
│       │   └── anchor.rs    # アンカー解決・マッチング
│       └── commands.rs      # Tauri IPC コマンド定義
├── src/                     # React + TypeScript（Vite）
│   ├── App.tsx
│   ├── components/
│   │   ├── FeatureList.tsx       # 左サイドバー: feature一覧
│   │   ├── SpecTabs.tsx          # Requirements / Design / Tasks タブ
│   │   ├── MarkdownViewer.tsx    # md レンダリング + ブロックID付与
│   │   ├── CommentThread.tsx     # コメントスレッドUI
│   │   └── CommentSidebar.tsx    # コメント一覧・orphaned表示
│   ├── hooks/
│   │   ├── useComments.ts
│   │   └── useFeatures.ts
│   └── types/
│       ├── comment.ts
│       └── feature.ts
├── package.json
└── src-tauri/Cargo.toml
```

### 技術スタック

| レイヤー     | 技術                                           |
| ------------ | ---------------------------------------------- |
| フレームワーク | Tauri v2                                       |
| フロントエンド | Vite + React + TypeScript                      |
| md レンダリング | react-markdown + remark-gfm                  |
| md パース（Rust） | pulldown-cmark                             |
| コメント保存   | JSON ファイル（`.comments/` 配下）             |
| パッケージ管理 | pnpm（フロント） / Cargo（Rust）               |

---

## コメントシステム設計

### コメントデータ構造

```json
{
  "id": "cmt_1a2b3c",
  "anchor": {
    "blockType": "heading | paragraph | list_item | code_block | table",
    "blockIndex": 3,
    "textHash": "sha256_prefix_8chars",
    "textSnippet": "JWTトークンを使用して認証する",
    "charOffset": [12, 24]
  },
  "body": "リフレッシュトークンの有効期限も定義が必要",
  "resolved": false,
  "createdAt": "2026-05-05T10:00:00Z",
  "updatedAt": "2026-05-05T10:00:00Z"
}
```

### アンカー解決の優先順位

1. `blockType` + `blockIndex` で完全一致 → 採用
2. 不一致なら `textHash` で全ブロック走査
3. `textHash` も失敗なら `textSnippet` で部分一致（fuzzy）
4. 全滅 → orphaned comment としてサイドバーに退避（削除しない）

### md本体を汚さない理由

- spec skillがmd再生成するケースがある
- gitでcommitしたときにコメントノイズが入らない
- AIに渡すとき、コメント群だけ抽出して指示として使える

---

## UI設計

### レイアウト

```
┌───────────────┬──────────────────────────┬──────────────────┐
│               │  [Requirements] [Design] [Tasks]            │
│  Feature      │─────────────────────────────────────────────│
│  List         │                          │                  │
│               │  Markdown                │  Comment         │
│  ▸ auth       │  Rendered View           │  Sidebar         │
│  ▸ payment    │                          │                  │
│  ▸ search     │  テキスト選択 →           │  - スレッド表示  │
│               │  💬 ボタン表示            │  - orphaned一覧  │
│               │                          │  - resolved切替  │
│               │                          │                  │
└───────────────┴──────────────────────────┴──────────────────┘
```

### 操作フロー

1. アプリ起動 → `.spec-skill/` を含むディレクトリを開く（or ドラッグ&ドロップ）
2. 左サイドバーに feature 一覧表示
3. feature選択 → 3タブ（Requirements / Design / Tasks）が開く
4. md表示上でテキスト範囲選択 → 浮動ボタン「💬 コメント追加」
5. ポップオーバーでコメント入力 → 保存
6. コメント箇所はハイライト表示、クリックでスレッド展開
7. コメントサイドバーで一覧・resolved切替・orphaned確認

---

## フェーズ計画

### Phase 1: 基盤 — md閲覧 + feature一覧

**ゴール**: spec skillのmd群をまともに読めるビューア

- [ ] Tauri v2 + Vite + React + TypeScript プロジェクト初期化
- [ ] `.spec-skill/config.json` の読み込み（Rust側）
- [ ] feature ディレクトリスキャン → 一覧取得
- [ ] 左サイドバー: feature一覧表示
- [ ] タブUI: Requirements / Design / Tasks 切り替え
- [ ] md レンダリング（react-markdown + remark-gfm）
- [ ] 各mdブロックに `data-block-type` / `data-block-index` 属性付与

### Phase 2: コメント機能

**ゴール**: mdに紐づくコメントの作成・保存・表示

- [ ] コメントデータ構造定義（Rust struct + TypeScript type）
- [ ] `.comments/` ディレクトリへのJSON I/O（Rust側）
- [ ] Tauri IPC コマンド: `add_comment`, `list_comments`, `update_comment`, `delete_comment`
- [ ] テキスト選択 → コメント追加UI
- [ ] コメント箇所のハイライト表示
- [ ] コメントスレッドUI（ポップオーバー or インライン）
- [ ] コメントサイドバー（一覧表示）

### Phase 3: アンカー解決 + 堅牢化

**ゴール**: md再生成後もコメントが生き残る

- [ ] pulldown-cmark でmd AST解析（Rust側）
- [ ] アンカー解決ロジック（blockType + blockIndex → textHash → fuzzy）
- [ ] orphaned comment の検出・サイドバー退避表示
- [ ] ファイル変更監視（notify crate）→ コメント再解決

### Phase 4: UX改善 + 拡張

**ゴール**: 実用レベルのレビュー体験

- [ ] resolved / unresolved フィルタ
- [ ] コメント検索
- [ ] ダーク/ライトテーマ
- [ ] ディレクトリ ドラッグ&ドロップでプロジェクト開く
- [ ] feature単位での config.json オーバーライド
- [ ] コメント一括エクスポート（md or JSON形式）

### Phase 5（将来構想）: AI連携

- [ ] コメント群をプロンプトとしてLLMに送信 → md修正提案
- [ ] "Apply with AI" ボタン: 選択コメント → 修正diff生成
- [ ] MCP連携: spec skill側への修正フィードバック

---

## 命名候補

| 案                  | 根拠                                      |
| ------------------- | ----------------------------------------- |
| `spec-reviewer`     | 直球。用途が明確                          |
| `spec-viewer`       | レビューよりも閲覧寄りなら                |
| `spec-note`         | コメント = ノートとして捉えるなら         |
| `spec-lens`         | 仕様を覗く・検査するニュアンス            |

※ Doiの命名規則（`[domain]-[type]`）に沿った形

---

## 技術的な注意点

- **Tauri v2** の IPC は `#[tauri::command]` + `invoke()` 。v1とAPIが異なるので注意
- **pulldown-cmark** のブロックインデックスは `Parser::new()` のイテレータ順で決まる。mdの構造変更に弱いので Phase 3 でテキストハッシュのフォールバックが必須
- **react-markdown** の `components` prop でカスタムコンポーネントに差し替え、`data-*` 属性付与が最も素直
- **ファイル監視**: Tauri v2 は `tauri-plugin-fs` に watch 機能あり。notify crate 直接使うより楽な可能性あり
