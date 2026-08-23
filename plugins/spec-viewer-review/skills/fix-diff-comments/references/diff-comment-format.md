# DiffコメントJSON形式

## 保存場所

リポジトリDiffコメントはGit共通ディレクトリ配下に保存される。

```text
<git-common-dir>/spec-viewer/diff-comments/df1_*.v1.json
```

`<git-common-dir>` は `git rev-parse --git-common-dir` で取得する。コメント文書はspec-viewerが管理するため、読み取り専用として扱う。

## 文書形式

```json
{
  "version": 1,
  "repositoryId": "rr1_...",
  "worktreeId": "rw1_...",
  "revision": "25",
  "comments": [
    {
      "id": "comment-id",
      "body": "修正してほしい内容",
      "resolved": false,
      "createdAt": "2026-08-23T00:00:00Z",
      "replies": [
        {
          "id": "reply-id",
          "body": "追加の指示",
          "createdAt": "2026-08-23T00:01:00Z"
        }
      ],
      "anchor": {
        "repositoryId": "rr1_...",
        "worktreeId": "rw1_...",
        "baseSha": "commit SHA",
        "currentSnapshotId": "snapshot ID",
        "side": "current",
        "oldPath": "変更前のパス.ts",
        "newPath": "現在のパス.ts",
        "line": 12,
        "endLine": 14,
        "lineHash": "sha256:...",
        "snippet": "アンカー対象の行",
        "contextBefore": ["直前の行"],
        "contextAfter": ["直後の行"]
      }
    }
  ]
}
```

## フィールドの解釈

- `version`: 文書形式。現在は `1`。
- `repositoryId` / `worktreeId`: 文書が属するリポジトリとworktree。
- `revision`: spec-viewerが排他更新に使うリビジョン文字列。変更しない。
- `comments`: コメント一覧。
- `comments[].body`: 修正要求の本文。
- `comments[].resolved`: `false` のコメントだけを修正対象にする。
- `comments[].replies`: 追加指示。配列順に読み、後の返信を新しい補足として扱う。
- `comments[].anchor.side`: `current` または `base`。
- `comments[].anchor.line` / `endLine`: コメント作成時点の行範囲。`endLine` がなければ単一行。
- `comments[].anchor.snippet`: アンカー対象の行。空文字の場合もある。
- `contextBefore` / `contextAfter`: アンカー再特定用の前後行。

`oldPath`、`newPath`、`endLine`、`replies` は状況により存在しない場合がある。

## 編集対象パス

- `side: current`: `newPath`。
- `side: base`: `newPath` があればそれを使用し、なければ `oldPath` に対応する現在のファイルを探す。

記録された行番号だけに依存せず、`snippet` と前後コンテキストを使って現在のコード上の対象箇所を確認する。
