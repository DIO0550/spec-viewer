# Storybook Visual Regression

Storybook を GitHub Pages にデプロイするだけでなく、PR ごとの UI 差分を確認できる visual regression の構成をまとめる。

## 構成

1. PR CI で Storybook をビルドし、各 story のスクリーンショットを取得する。
2. `main` の baseline スクリーンショットと比較し、差分画像を GitHub Actions artifact と PR コメントから確認できるようにする。

GitHub Pages は「レビュー用の公開 URL」、Actions artifact は「diff の詳細確認先」として役割を分ける。

## 実装済みの構成

- `.github/scripts/storybook-visual-regression.mjs`
  - `capture`: 静的ビルド済み Storybook を一時 HTTP server で配信し、Chrome DevTools Protocol 経由で story ごとの PNG を生成する。
  - `compare`: baseline / actual の PNG を ImageMagick `compare -metric AE` で比較し、`visual-report/summary.json` とスライダー付きの `visual-report/index.html` を生成する。
- `.github/workflows/storybook-visual-regression.yml`
  - PR ごとに Storybook をビルドし、`gh-pages/visual-baseline/` と比較する。
  - `visual-report/` を GitHub Actions artifact としてアップロードし、`gh-pages/visual-regression/pr-{PR番号}/` へも公開する。
  - PR コメントに結果、リッチ diff レポート URL、artifact URL、Storybook preview URL を投稿する。
  - 閾値超過の差分がある場合は job を失敗させる。
  - PR close 時は `gh-pages/visual-regression/pr-{PR番号}/` を削除する。
- `.github/workflows/deploy-storybook-main.yml`
  - `main` の Storybook デプロイ時に `visual-baseline/` も更新する。
- `.github/workflows/storybook-pr-preview.yml`
  - PR ごとの Storybook を `gh-pages/pr-preview/pr-{PR番号}/` へ公開する。

## Pages 配置

| パス | 内容 |
| --- | --- |
| `/` | main の Storybook |
| `/visual-baseline/` | main の screenshot baseline |
| `/pr-preview/pr-{N}/` | PR の Storybook preview |
| `/visual-regression/pr-{N}/` | PR の visual diff report |

公開 URL 例: `https://dio0550.github.io/spec-viewer/`

## 閾値

- story 全体の許容差分率: `0.2%` (`max-diff-ratio: 0.002`)
- 新規 story / 削除 story: warning 扱い（閾値超過の `changed` のみ fail）

## ローカル実行

`spec-viewer/` ディレクトリで実行する。

```bash
pnpm build-storybook
pnpm visual:capture -- --storybook-dir storybook-static --out visual-actual
pnpm visual:compare -- --expected visual-baseline --actual visual-actual --out visual-report
```

ローカルで `visual:capture` を実行するには Google Chrome / Chromium が必要。`CHROME_BIN` で実行ファイルを指定できる。比較には ImageMagick の `compare` コマンドが必要。

## 運用メモ

- UI が大きく変わる PR では、レビュー後に main にマージすることで baseline が自動更新される。
- PR から baseline を直接更新しない。
- ランダム値・時刻・フォント読み込み・アニメーションは story 側で固定する。
