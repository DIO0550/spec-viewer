# Specs navigation
Specs 列は、ワークスペース内の仕様を spec、category、Archive、secondary source group の階層として表示します。primary source group のルート見出しは表示せず、active node の後に Archive、その後に secondary source group を表示します。各 source group 内では active node を名前順に並べ、Archive を末尾に固定します。

## Node と件数

- Spec は開いて文書を選択でき、badge は存在する設定済み文書数を示します。空ファイルも1文書として数えます。
- Category は構造を整理する container で、badge は配下の Spec 数を示します。
- Archive は移動済み Spec の container で、通常の読み込み・再読み込み・workspace 切替時には閉じた状態へ戻ります。
- Secondary source group は worktree など別の仕様ソースを表し、badge は配下の Spec 数を示します。

.spec-reviewer/config.json に nodeKind: "spec" または nodeKind: "category" を指定すると、空 directory の意味を明示できます。指定がない場合は、設定済み文書が存在する directory、NNN-* 名、子を持たない directory を Spec として扱い、それ以外を Category として扱います。

exact .archive directory だけは hidden directory の例外として表示されます。.hidden や .archive-other など、その他の . で始まる directory は表示されません。

## Archive と回復

Spec 行に pointer を合わせるか keyboard focus を置くと Archive action が表示されます。Category、Archive、source group、および Archive 配下の Spec には Archive action は表示されません。

Archive が成功すると backend の一覧を再取得し、実際の移動先を Archive 内で展開して focus します。同名の移動先がある場合は -1、-2 の suffix が付き、返却された正確な移動先を表示します。

Archive が失敗した場合は元の tree と選択を維持し、該当行の「アーカイブを再試行」から同じ Spec を再実行できます。再取得後に移動先が見つからない場合は panel の警告から refresh してください。refresh は現在の workspace を再取得し、通常の選択 fallback を適用します。

## Keyboard

- Arrow Up / Arrow Down: 表示中の前後の node へ focus を移動
- Arrow Right: 閉じた container を展開。展開済みなら最初の子へ移動
- Arrow Left: 展開済み container を閉じる。閉じている場合は親へ移動
- Home / End: 最初 / 最後の表示 node へ移動
- Enter / Space: Spec を選択、または container を展開・折りたたみ
- Tab: Specs tree の外にある次の control へ移動

## Artifact tabs と identity

Spec を選択すると、frontend は `load_spec_bundle` を1回呼び、表示対象の
artifact 本文・Markdown block metadata・progress・error metadata をまとめて
取得します。tab 切替は取得済み bundle 内の同期 projection だけで行い、
`read_spec_file` を追加呼び出ししません。

Artifact の順序は、存在する standard artifact を effective config 順、その後に
spec directory 直下の追加 `.md` を安定した名前順で並べます。nested file、
hidden file、symlink、設定済み standard file と同じ実体は追加対象にしません。

- Standard identity: `{ kind: "standard", fileKey }`
- Direct identity: `{ kind: "directMarkdown", fileName }`

Identity 比較は大文字小文字を含む完全一致です。同じ spec の reload では成功・
Unknown を問わず現在 identity を維持し、消失した場合だけ先頭へ fallback
します。別 spec へ移動した場合は新しい bundle の先頭を選びます。direct
artifact の `fileKey` は `null` であり、閲覧専用です。comments、watch、
diff など既存 fixed-key 機能には standard artifact だけを渡します。

## Progress

各 tab は色だけでなく、次の visible text と ARIA label で状態を示します。

| 状態 | 表示 | 判定 |
| --- | --- | --- |
| `notStarted` | Not started | 空文書、または tasks の checkbox が0件 |
| `inProgress` | In progress | tasks の完了数が0より多く総数より少ない |
| `completed` | Completed | tasks の全checkbox完了、またはnon-task非空 |
| `unknown` | Unknown | read/parse error、またはtasks不在時の集約error |

Spec tree の progress は tasks-first です。tasks が存在する場合はtasksだけで
判定し、存在しない場合はconfigured non-taskを集約して
Unknown > In progress > Completed > Not started の優先順位を適用します。

## Empty・partial error・互換境界

Artifact 0件はcommand成功のempty bundleであり、bundle-level failureとは区別
します。1件のread/parse失敗はbundle全体を失敗させず、そのartifactだけを
`contents: null`、`blocks: []`、`progress: unknown` として返します。
成功tabは引き続き閲覧でき、Unknown panelからbundleをreloadできます。
