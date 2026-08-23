# Spec Viewer Review

spec-viewerのリポジトリDiffに付けた未解決レビューコメントを、現在のワークツリーへ反映するClaude Codeプラグインです。

`/spec-viewer-review:fix-diff-comments` スキルを提供します。現在のworktreeにある未解決コメントを読み、AIが対象箇所と修正要否を自動で判断します。

スキルはspec-viewerのDiffコメントJSONを直接読み、妥当な指示をソースコードへ反映してリポジトリの検証を実行します。補助ランタイムは不要です。対応が完了したコメントはAIが解決済みにし、実装方針の判断が必要な場合だけAsk系ツールで確認します。

## ローカル開発

リポジトリルートで実行します。

```bash
claude --plugin-dir ./plugins/spec-viewer-review
```

## Marketplaceからインストール

現在のcheckoutをローカルmarketplaceとして追加する場合:

```text
/plugin marketplace add .
/plugin install spec-viewer-review@spec-viewer-tools
```

リポジトリ公開後にGitHubから追加する場合:

```text
/plugin marketplace add DIO0550/spec-viewer
/plugin install spec-viewer-review@spec-viewer-tools
```
