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

Editorは編集・保存機能を持ちません。deleted file、空file、binary/large/missing/unsupported contentはそれぞれ異なるstatusで表示します。

## 状態の保持

open tab順、active path、Unified/Split/Editor、ファイルごとの変更jump、filter、展開directoryはapplication session内だけで保持します。keyはworkspaceとworktreeを含み、別worktreeへ状態を漏らしません。snapshot IDはkeyに含めず、refresh時は新snapshotのrepository全体に存在するlogical pathだけをreconcileします。

detail data、base、snapshot IDはtab stateへ複製せず、snapshot-safe Repository Diff loaderを正本にします。
