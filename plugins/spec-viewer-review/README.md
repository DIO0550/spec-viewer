# Spec Viewer Review

spec-viewerのリポジトリDiffに付けた未解決レビューコメントを、現在のワークツリーへ反映するClaude Codeプラグインです。

`/spec-viewer-review:fix-diff-comments` スキルを提供します。コメントIDを渡すと対象を限定でき、省略すると現在のworktreeにある未解決コメントをすべて処理します。

スキルはspec-viewerのDiffコメントJSONを直接読み、妥当な指示をソースコードへ反映してリポジトリの検証を実行します。補助ランタイムは不要で、コメント文書自体は変更しません。コメントの解決操作はspec-viewer側で行います。

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
