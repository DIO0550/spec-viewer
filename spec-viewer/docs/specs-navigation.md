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
