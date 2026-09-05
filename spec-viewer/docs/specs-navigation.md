# Specs navigation

初めて workspace を開くところからの手順は
[Specs / Diff 統合レビュー利用ガイド](./integrated-review-guide.md) を参照してください。

Specs 列は、workspace 内の仕様を Spec、Category、Archive、secondary source group の
階層として表示します。primary source group の root 見出しは表示せず、active node の
後に Archive、その後に secondary source group を表示します。各 source group 内では
active node を名前順に並べ、Archive を末尾に固定します。

## Node と件数

- Spec は開いて文書を選択でき、badge は configured mapping のうち regular file として
  存在する文書数を示します。空 file も1文書として数えます。missing slot、direct /
  unmapped Markdown、`.comments`、review output は除外します。
- Category は構造を整理する container で、badge は配下の Spec 数を示します。
- Archive は移動済み Spec の container で、通常の読み込み・再読み込み・workspace
  切替時には閉じた状態へ戻ります。
- Secondary source group は worktree など別の仕様 source を表し、badge は配下の
  Archive 外 Spec 数を示します。

`.spec-reviewer/config.json` に `nodeKind: "spec"` または
`nodeKind: "category"` を指定すると、空 directory の意味を明示できます。指定がない
場合は、configured document が存在する directory、`NNN-*` 名、子を持たない
directory を Spec として扱い、それ以外を Category として扱います。

exact `.archive` directory だけは hidden directory の例外として表示されます。
`.hidden` や `.archive-other` など、その他の `.` で始まる directory は表示されません。

## Archive と回復

Spec 行に pointer を合わせるか keyboard focus を置くと Archive action が表示されます。
Category、Archive、source group、および Archive 配下の Spec には Archive action は
表示されません。

Archive が成功すると backend の一覧を再取得し、実際の移動先を Archive 内で展開して
focus します。同名の移動先がある場合は `-1`、`-2` の suffix が付き、返却された
正確な移動先を表示します。

Archive が失敗した場合は元の tree と選択を維持し、該当行の
`アーカイブを再試行` から同じ Spec を再実行できます。再取得後に移動先が見つからない
場合は panel の警告から refresh してください。refresh は現在の workspace を再取得し、
通常の selection fallback を適用します。

## Keyboard

- Arrow Up / Arrow Down: 表示中の前後の node へ focus を移動
- Arrow Right: 閉じた container を展開。展開済みなら最初の子へ移動
- Arrow Left: 展開済み container を閉じる。閉じている場合は親へ移動
- Home / End: 最初 / 最後の表示 node へ移動
- Enter / Space: Spec を選択、または container を展開・折りたたみ
- Tab: Specs tree の外にある次の control へ移動

## Artifact tab と identity

Spec を選択すると、frontend は `load_spec_bundle` を1回呼び、表示対象の artifact
本文・Markdown block metadata・progress・error metadata をまとめて取得します。tab
切替は取得済み bundle 内の同期 projection だけで行い、`read_spec_file` を追加呼び出し
しません。

Artifact の順序は、存在する standard artifact を effective config 順、その後に Spec
directory 直下の追加 `.md` を安定した名前順で並べます。nested file、hidden file、
symlink、configured standard file と同じ実体は追加対象にしません。

- Standard identity: `{ kind: "standard", fileKey }`
- Direct identity: `{ kind: "directMarkdown", fileName }`

identity 比較は大文字小文字を含む完全一致です。同じ Spec の reload では成功・Unknown
を問わず現在 identity を維持し、消失した場合だけ先頭へ fallback します。別 Spec へ
移動した場合は新しい bundle の先頭を選びます。direct artifact の `fileKey` は
`null` であり閲覧専用です。comment、watch、diff など fixed-key 機能には standard
artifact だけを渡します。

## Progress

backend scan が authoritative source です。各 tab は色だけでなく visible text と
ARIA label で状態を示します。

| Input | 表示 |
| --- | --- |
| missing / empty artifact | `Not started` |
| non-task artifact が present / non-empty | `Completed` |
| tasks read / parse error | `Unknown` |
| tasks present / empty | `Not started` |
| tasks non-empty、checkbox 総数 `N = 0` | `In progress` |
| tasks checkbox `N > 0, C = 0` | `Not started` |
| tasks checkbox `0 < C < N` | `In progress` |
| tasks checkbox `C = N` | `Completed` |

Spec tree の overall progress は tasks-first です。tasks が present なら tasks の結果だけを
採用し、missing のときだけ configured non-task artifact を集約します。

| tasks missing 時の configured non-task | Overall |
| --- | --- |
| present artifact に read / parse error | `Unknown` |
| present 数0 | `Not started` |
| 全 configured artifact が present regular file かつ non-empty | `Completed` |
| それ以外で present 数1以上 | `In progress` |

Markdown task marker の parse は `tasks.md` だけに限定します。frontend は file ごとの
N+1 read で進捗を再計算しません。`Unknown` は Completed / Not started へ丸めず、error
を修復して bundle を reload します。

## Empty・partial error・互換境界

Artifact 0件は command 成功の empty bundle であり、bundle-level failure と区別します。
1件の read / parse 失敗は bundle 全体を失敗させず、その artifact だけを
`contents: null`、`blocks: []`、`progress: unknown` として返します。成功 tab は
引き続き閲覧でき、Unknown panel から bundle を reload できます。
