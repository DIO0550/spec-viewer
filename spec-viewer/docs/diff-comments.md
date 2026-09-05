# Diff comments

Repository Diff と Spec Diff の comment は、特定の base / current snapshot の実在する
差分行に紐づく worktree-wide review note です。Spec Diff は Repository Diff を利用
できない fallback 表示でも同じ Diff comment 経路を使います。

Diff comment は Spec Markdown comment と presentation を共有しますが、anchor、command、
persistence は分離されています。Spec export、MCP、LLM、JSON v2 の互換性を変更しません。

Spec Diff の比較元を変更すると runtime identity が切り替わり、保存済み comment は
その base / current snapshot に対して再解決されます。Diff Review panel と行 jump は
両方の Diff 表示で利用できます。

## Commentable line

- `Unified`: removed は base、added は current。unchanged context は base / current の
  それぞれを独立した target として扱う
- `Split`: 実在する base / current cell は独立。spacer cell は対象外
- `Editor`: All による unchanged 行を含む、実在する current line が対象
- comment 不可: deleted / previous peek summary、peek row、annotation、gap、binary、
  omitted、synthetic row

同じ semantic target に open / resolved comment があれば `+` の代わりに indicator を
表示し、2件目の新規 comment を作りません。historical comment が同じ行へ relocate した
場合は、count から createdAt / ID 順の deterministic picker を開きます。

現在の UI / command は新規作成、本文更新、返信、resolve / reopen、確認付き削除を
support します。未保存 draft は新しい有効行へ re-anchor できます。

## Keyboard workflow

行の `+` を activate すると inline composer が開き、textarea に focus します。

- `Enter`: 改行
- `Ctrl+Enter` / `Cmd+Enter`: 空でない draft を送信
- `Esc`: 保存せず composer を閉じ、元の `+` へ focus を戻す
- IME composition 中の `Enter` / `Esc`: composition 終了まで無視

repository workspace 内で開ける composer は1つです。tab / view mode を切り替えても
controlled draft は保持されます。base draft は `Editor` では隠れ、`Unified` /
`Split` に戻ると再表示されます。snapshot / worktree の変更で未保存 target が stale に
なった場合は、再 anchor または破棄するまで送信できません。

target stale または revision overflow でも本文は編集・copy できますが、button と
keyboard submit は無効です。permission / invalid store は repository / worktree
document 全体の create、update、reply、resolve、reopen、delete を block します。
cancel や新しい draft で block を迂回できません。

## Review panel と navigation

Review は Repository Diff mode と Spec Diff fallback mode に表示され、`Open`、
`Resolved`、`All`、search で絞り込みます。

- 行 indicator を activate: filter を `All`、search を空にし、card を選択。draft は保持
- card を選択: 現在の filter / search を維持
- `行へ移動`: `selectionPath` の tree / tab を開き、`sidePath` の semantic anchor を
  window 内へ materialize して indicator / control に focus
- base side の jump を `Editor` から行う: `Unified` へ切り替えてから移動

resolution label の意味は次のとおりです。

| Status | Jump | 意味 |
| --- | --- | --- |
| `exact` | 可 | immutable anchor が元の行と一致 |
| `relocated` | 可 | content / context が一意に移動した target を特定 |
| `stale` | 不可 | delete、rename ambiguity、context 消失／重複、binary、snapshot change などで安全な target がない |
| `unavailable` | 不可 | IO、permission、budget、cancellation、repository change により解決できない |

stale / unavailable result は近い行を推測しません。original anchor と comment は保存した
まま、runtime warning と jump 不可状態を返します。

Review list は最大10,000 loaded comments から一度に最大100 card を materialize し、
選択中 card は常に含めます。

## Storage path と分離

Diff comment は canonical Git common dir 配下に JSON v1 document として保存します。

```text
<git-common-dir>/spec-viewer/diff-comments/df1_<storageFileKey>.v1.json
<git-common-dir>/spec-viewer/diff-comments/df1_<storageFileKey>.lock
```

`storageFileKey` は canonical `rw1_...` worktree storage ID を length-frame して SHA-256
した lowercase hex です。raw filesystem path や表示名は filename に使いません。
`spec-viewer` / `diff-comments` directory は private permission で作成し、canonical common
dir boundary、symlink、Windows reparse point を検査します。

Spec comment は `<spec-folder>/.comments/<logical-file>.json` の JSON v2 のままです。
Diff v1 と Spec v2 は相互の file を migration / rewrite / delete しません。

worktree を削除しても Diff v1 document は自動削除せず、orphaned review history として
保持します。明示 cleanup / export UI は Phase 1 対象外です。mutation 中断で残った
`df1_*.tmp.<nonce>` だけは、24時間以上経過した file を bounded scan で cleanup します。

## Stored JSON v1 schema

次は current side の複数行 anchor と1件の reply を持つ保存例です。ID / SHA / hash は
canonical format の説明用固定値です。

```json
{
  "version": 1,
  "repositoryId": "rr1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "worktreeId": "rw1_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "revision": "7",
  "comments": [
    {
      "id": "7aa61b3d-5dba-4972-8ad6-4f45ef6d2670",
      "body": "境界条件をテストしてください。",
      "resolved": false,
      "createdAt": "2026-08-23T12:00:00Z",
      "replies": [
        {
          "id": "9422d4a7-a4f9-420d-88f4-6fcac36bc0f9",
          "body": "回帰テストを追加しました。",
          "createdAt": "2026-08-23T12:30:00Z"
        }
      ],
      "anchor": {
        "repositoryId": "rr1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "worktreeId": "rw1_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        "baseSha": "cccccccccccccccccccccccccccccccccccccccc",
        "currentSnapshotId": "rs1_dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        "side": "current",
        "oldPath": "src/review.ts",
        "newPath": "src/review.ts",
        "line": 42,
        "endLine": 44,
        "lineHash": "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        "snippet": "return resolveAnchor(input);",
        "contextBefore": ["if (input === null) {", "  return null;", "}"],
        "contextAfter": ["", "export { resolveAnchor };"]
      }
    }
  ]
}
```

schema invariant:

- document envelope は `repositoryId` / `worktreeId` scope を持つ。全 anchor の2値は
  envelope と一致しなければならない
- anchor は historical `baseSha` / `currentSnapshotId` を保持する
- `side: "base"` は `oldPath` 必須、`side: "current"` は `newPath` 必須
- line は1-based `u32`、optional `endLine` は `line` 以上。同じ行なら省略
- `lineHash` は `sha256:` + 64 lowercase hex
- context は前後それぞれ最大3行。snippet / 各 context line は最大256 Unicode scalar
- body / reply body は trim 後に空でなく、UTF-8 byte で最大16 KiB
- comment ID / reply ID は document / comment 内で一意、空でなく最大128 byte
- document は最大10,000 comments、JSON は最大8 MiB、depth 32、250,000 node
- version / identity / revision / unknown field / duplicate key / path / hash の不正は schema
  error。runtime resolution や warning は保存しない

`replies` は encoder が配列で出力し、legacy v1 document で field がなければ空配列として
load します。

## Stored と runtime の分離

load response は stored data に runtime resolution を加えた projection です。

```ts
type StoredDiffComment = {
  id: string;
  body: string;
  resolved: boolean;
  createdAt: string;
  replies?: readonly DiffCommentReply[];
  anchor: DiffLineAnchor;
};

type ResolvedDiffComment = StoredDiffComment & {
  anchorResolution: DiffAnchorResolution;
};
```

document envelope が持つのは stable repository / worktree scope です。command request と
frontend session は `repositoryId` / `worktreeId` / `baseSha` /
`currentSnapshotId` の4値を完全 identity として使います。response が別 scope を返した
場合は strict decoder が `invalidResponse` として拒否します。

anchor resolution は original anchor を rewrite せず、次の別 DTO で返します。

```ts
type DiffAnchorResolution =
  | { status: "exact" | "relocated"; selectionPath: string;
      sidePath: string; side: "base" | "current"; line: number }
  | { status: "stale"; reason: StaleAnchorReason; candidateCount: number }
  | { status: "unavailable"; reason: UnavailableReason; canJump: false };
```

resolver は全 comment を返すことを優先します。deadline / cancellation / structural limit
到達後も残りを `unavailable` とし、省略や guessed target にしません。

## Revision CAS と commit point

revision は canonical decimal unsigned u64 string です。

- missing document の load: `"0"`
- first successful mutation: `"1"`
- valid: `"0"` または leading zero のない正の decimal
- invalid: 空、負数、`+1`、`01`、小数、non-digit、u64 超過

すべての create / update / reply / resolve / reopen / delete request は
`expectedRevision` を送ります。backend は cross-process lock 内で current document を
読み、次 revision を `checked_add(1)` で決めます。client が next revision を指定する
ことはできません。

```text
expected == current -> mutation -> private temp write + fsync
                    -> atomic replace -> committed(next revision)
expected != current -> conflict(latest document / revision), no write
current == u64::MAX -> revisionOverflow(current document / revision), no write
```

atomic replace が commit point です。directory sync の確認だけが失敗した場合は書込済み
なので、`committed` + `durability: "uncertain"` を返します。mutation retry を表示せず、
まず reload します。

## Mutation outcome

| Outcome | Document state | UI contract |
| --- | --- | --- |
| `committed / durable` | 保存済み | origin draft を閉じ、新 document を表示 |
| `committed / uncertain` | 保存済み、directory durability 未確認 | warning を表示し、再 mutation 前に reload |
| `conflict` | 無書込。latest document を返す | latest を install、draft を保持・focus。確認後に再送信 |
| `preCommitFailure / storeBusy|io` | 無書込 | draft を保持し retry 可 |
| `preCommitFailure / permission|invalidStore` | 無書込 | document-wide write block。修復後の validated reload まで解除しない |
| `preCommitFailure / revisionOverflow` | 無書込 | 恒久 write block。current document と copyable body を保持 |

command-level stable error は `invalidRequest`、`invalidRevision`、`identityMismatch`、
`staleSnapshot`、`staleBase`、`schema`、`pathBoundary`、`lineAlreadyCommented`、
`unavailable`、`unexpected` です。

## Recovery

- CAS conflict: latest document / revision を確認。保持された draft を必要なら修正して再送信
- transient IO / store busy / transport: draft を保持したまま retry
- permission / invalid store: body を copy、権限または JSON を修復、validated reload。
  reload 失敗中は write block を維持
- revision overflow: mutation は恒久停止。document と本文を保全
- durability uncertain: committed comment を表示。操作を繰り返す前に reload
- stale base / snapshot: repository overview を refresh して新 identity を取得
- worktree 削除後: Git common dir の document は保持。自動 cleanup されない

store file はアプリ実行中に直接編集しないでください。manual recovery が必要なら先に
backup し、strict JSON v1、canonical revision、complete identity / anchor を維持します。
