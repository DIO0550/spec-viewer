# Hearing Notes: Tech Reference Tab

## 目的

`tech-reference.html` または `tech-reference.md` も仕様ビューアーで確認できるようにし、既存タブ構成の3番目に表示する。

## スコープ

- **種別**: 既存機能の改善
- **影響範囲**: 既存修正
- **優先度**: 中

## 技術的詳細

- **技術スタック**: TypeScript / React / Rust
- **フレームワーク**: Tauri / Vite / React
- **依存関係**: 既存のHTML/Markdown表示機構を優先して再利用する
- **データ構造**: 既存のタブ、ドキュメント取得、レンダリング用の型・IPC設計に合わせる。`tech-reference.html` を優先し、存在しない場合は `tech-reference.md` を対象にする想定。

## 品質要件

- **エッジケース**: HTML/MDの両方が存在する場合、どちらも存在しない場合、対象ファイルが空の場合、読み込みエラーが起きる場合
- **エラーハンドリング**: 既存の空状態・読み込み失敗状態があればそれに揃える
- **テスト要件**: 既存のテスト基盤に合わせて、タブ構成、ファイル優先順位、表示分岐を検証する
- **パフォーマンス**: 既存ドキュメント表示と同等。追加タブにより不要な再読み込みや重い再レンダリングが増えないこと

## 追加コンテキスト

- ユーザー回答:
  - 対象形式: HTML/MD両対応。`tech-reference.html` を優先し、なければ `tech-reference.md` を表示する
  - 表示位置: 常に3番目。ファイルがなくてもタブを表示し、空状態または未作成状態を出す
  - 表示方法: 既存ビュー再利用。既存のHTML/Markdown表示機構があればそれに合わせる

## 探索後ユーザー判断

### 論点 1: タブの3番目は `Implementation`, `Tasks`, `Tech Reference`, `Exploration`, `Hearing` の順でよいか

- **回答**: その順で固定 (Recommended)

### 論点 2: Tech Referenceタブを常設するワークスペース範囲

- **回答**: plugin workspaceのみ (Recommended)

### 論点 3: HTML表示時は既存通りコメントと文書検索なしでよいか

- **回答**: 既存通りでよい (Recommended)

### 論点 4: configでTech Referenceのファイル名を上書きした場合のfallback

- **回答**: 同stemで両対応 (Recommended)
