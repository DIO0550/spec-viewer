# Repository Diff workspace

Repository Diff は、変更ツリーから複数ファイルを開き、同じworktreeの比較snapshotを共有して確認するためのworkspaceです。

## ファイルタブ

- Treeのファイルを選ぶと、そのpathのtabを末尾へ追加してactiveにします。
- 既に開いているファイルを選んでもtab順は変わりません。
- active tabを閉じると右隣、右がなければ左隣、最後の1件なら未選択へ移ります。
- snapshot更新で存在しなくなったpathは自動的に閉じ、同じfallback規則を使います。
- Changed / Allのfilter切替だけではtabを閉じません。

## Keyboard操作

tab本体にfocusがあるとき、次の操作を利用できます。

- ArrowLeft / ArrowRight: 前後のtabへ移動してactive化
- Home / End: 先頭または末尾のtabへ移動
- Enter / Space: focused tabをactive化
- Delete: focused tabを閉じる
- Ctrl+W / Cmd+W: focused tabを閉じる

close button、Editor内容、inputからfile-tab shortcutを横取りしません。active tabを閉じた後はfallback tabへfocusが移り、最後のtabを閉じた後は空のtablistへfocusが残ります。

## 表示mode

共通toolbar右側で次の3 modeを選択できます。

- Unified: 追加・削除を1列で表示
- Split: base/currentを左右に表示
- Editor: current側の内容を行番号付きで読み取り専用表示

Editorは編集・保存機能を持たず、availableなcurrent snapshot全文を正本として表示します。追加行は緑、置換後行は青のgutterと読み上げlabelを持ち、行番号は常にcurrent側です。

### Availabilityと安全なfallback

current content自体がbinary / large / missing / unsupportedで取得できない場合は理由別statusを表示します。current全文がavailableでstructured diffだけが上限などにより取得できない場合は、degraded警告とunchangedな全文を表示し、誤ったgutter・peek・change jumpは公開しません。availableな空fileと「hunkが空の非空file」は別状態です。不正なhunk番号・範囲・順序・重複・text不一致も、安全なcurrent全文fallbackへ切り替わります。

### 削除・変更前peek

削除だけのchangeはcurrent上の挿入境界に「N行削除」、置換は変更後行の直前に「変更前 N行」と表示します。summary buttonはEnter / Spaceで開閉できます。summary、旧行、注釈はすべて非comment対象で、currentの実在行だけがcomment可能です。deleted fileはbackendから取得したold contentとremoved hunkが整合する場合に限りwhole-file peekを表示します。

### Navigationと性能

前後changeはUnified / Split / Editorで同じchange IDを共有します。peek開閉ではIDとcurrent行identityを変えません。同じrepository navigation entryはrefresh後もtab・mode・jumpを保持し、Editorの展開・scroll・focus・行高cacheだけが新しいrevision keyでresetされます。Editorは異なる行高を測定するwindowingを使い、20,000行でも最大500 semantic rowsだけをDOMへ出します。長い1行はwrapせず横scrollできます。gridは全論理行数をaria-rowcount、描画行の位置をaria-rowindexで公開します。

## 状態の保持

open tab順、active path、Unified/Split/Editor、ファイルごとの変更jump、filter、展開directoryはapplication session内だけで保持します。keyはworkspaceとworktreeを含み、別worktreeへ状態を漏らしません。snapshot IDはkeyに含めず、refresh時は新snapshotのrepository全体に存在するlogical pathだけをreconcileします。

detail data、base、snapshot IDはtab stateへ複製せず、snapshot-safe Repository Diff loaderを正本にします。

## Diff comments

行コメント、Review navigation、keyboard、storage/recoveryの詳細は [Diff comments](./diff-comments.md) を参照してください。
