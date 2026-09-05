# Repository Diff workspace

初めて workspace を開くところからの手順は
[Specs / Diff 統合レビュー利用ガイド](./integrated-review-guide.md) を参照してください。

Repository Diff は、選択中 worktree の変更 tree から複数 file を開き、同じ current
snapshot を共有して確認する workspace です。

## 比較基準

- base は resolved base ref と worktree `HEAD` の `merge-base`
- current は committed、staged、unstaged、untracked を含む canonical snapshot
- `Changed` と `All`、Unified / Split / Editor は同じ `currentSnapshotId` を共有
- worktree badge は changed logical file 数。rename / copy は各1件で、unchanged /
  ignored-only は含めない

base ref は validated explicit override、`branch.<current>.gh-merge-base`、current
remote HEAD、`origin/HEAD`、一意なその他 remote HEAD、local `main`、local
`master` の順です。invalid override は silent fallback しません。復旧手順と現行 UI
の制約は [統合レビュー利用ガイド](./integrated-review-guide.md#比較元とエラーからの回復)
を参照してください。

## Changed / All と ignored 表示

- `Changed`: added、modified、deleted、renamed、copied、type changed、untracked、binary
  など、base と current の logical change を表示
- `All`: current の tracked / untracked / ignored / generated file と、base 側だけの
  deleted file を表示
- `.git` 内部はどちらにも表示しない
- root ignored file は overview に含め、ignored / generated directory は deferred node
  として表示する

未訪問 worktree の filter は `Changed` です。filter、selected file、open tab、expanded
directory は worktree ごとの session state で、別 worktree へ漏れません。filter 切替は
同じ snapshot の projection を変えるだけで、overview を再生成しません。

deferred directory は展開時に最大200 immediate entry ずつ lazy load します。page request
は snapshot、node、cursor、generation に bind され、repository が変化した stale response
は棄却します。

## File tab

- tree の file を選ぶと、その path の tab を末尾へ追加して active にする
- 既に開いている file を選んでも tab 順は変わらない
- active tab を閉じると右隣、右がなければ左隣、最後の1件なら未選択へ移る
- snapshot 更新で存在しなくなった path は自動的に閉じ、同じ fallback 規則を使う
- Changed / All の filter 切替だけでは tab を閉じない

## Keyboard 操作

tab 本体に focus があるとき、次の操作を利用できます。

- ArrowLeft / ArrowRight: 前後の tab へ移動して active 化
- Home / End: 先頭または末尾の tab へ移動
- Enter / Space: focused tab を active 化
- Delete: focused tab を閉じる
- Ctrl+W / Cmd+W: focused tab を閉じる

close button、Editor 内容、input から file-tab shortcut を横取りしません。active tab を
閉じた後は fallback tab へ focus が移り、最後の tab を閉じた後は空の tablist へ focus
が残ります。

## 表示 mode

共通 toolbar 右側で次の3 modeを選択できます。

- `Unified`: 追加・削除を1列で表示
- `Split`: base / current を左右に表示
- `Editor`: current 側の内容を行番号付きで read-only 表示

Editor は編集・保存機能を持たず、available な current snapshot 全文を正本として
表示します。追加行は緑、置換後行は青の gutter と読み上げ label を持ち、行番号は常に
current 側です。

### Availability と安全な fallback

current content 自体が binary / large / missing / unsupported で取得できない場合は
理由別 status を表示します。current 全文が available で structured diff だけが上限など
により取得できない場合は、degraded 警告と unchanged な全文を表示し、誤った gutter /
peek / change jump は公開しません。available な空 file と「hunk が空の非空 file」は
別状態です。不正な hunk 番号・範囲・順序・重複・text 不一致も、安全な current 全文
fallback へ切り替わります。

### 削除・変更前 peek

削除だけの change は current 上の挿入境界に `N行削除`、置換は変更後行の直前に
`変更前 N行` と表示します。summary button は Enter / Space で開閉できます。summary、
旧行、注釈はすべて non-comment target で、current の実在行だけが comment 可能です。
deleted file は backend から取得した old content と removed hunk が整合する場合に限り
whole-file peek を表示します。

### Navigation と性能

前後 change は Unified / Split / Editor で同じ change ID を共有します。peek 開閉では
ID と current line identity を変えません。同じ repository navigation entry は refresh
後も tab・mode・jump を保持し、Editor の展開・scroll・focus・行高 cache だけが新しい
revision key で reset されます。

Editor は異なる行高を測定する windowing を使い、20,000行でも最大500 semantic row
だけを DOM へ出します。長い1行は wrap せず横 scroll できます。grid は全 logical 行数を
`aria-rowcount`、描画行の位置を `aria-rowindex` で公開します。

## 状態の保持

open tab 順、active path、Unified / Split / Editor、file ごとの change jump、filter、
expanded directory は application session 内だけで保持します。key は workspace と
worktree を含み、別 worktree へ状態を漏らしません。snapshot ID は key に含めず、refresh
時は新 snapshot の repository 全体に存在する logical path だけを reconcile します。

detail data、base、snapshot ID は tab state へ複製せず、snapshot-safe Repository Diff
loader を正本にします。

## Diff comments

行 comment、Review navigation、keyboard、storage / recovery の詳細は
[Diff comments](./diff-comments.md) を参照してください。
