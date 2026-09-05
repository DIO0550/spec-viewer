# Specs / Diff 統合レビュー利用ガイド

Spec Viewer は、仕様 Markdown を読む `Specs` と、repository の現在 snapshot を
比較する `Diff` を同じ workspace で行き来しながらレビューするアプリです。この
ガイドでは、workspace を開いてからコメントを解決し、レビューを終えるまでを
説明します。

Phase 1 の product contract は
[Issue #191 ADR](https://github.com/DIO0550/spec-viewer/issues/191) が正本です。
詳細な機能別操作は [Specs navigation](./specs-navigation.md)、
[Repository Diff workspace](./repository-diff-workspace.md)、
[Diff comments](./diff-comments.md) を参照してください。

## 画面と状態の考え方

画面は左から workspace / worktree と Specs または Diff の navigation、中央の
Markdown / Diff viewer、右の Review sidebar で構成されます。

- `Specs` / `Diff` mode は session 全体で1つです。起動時は `Specs` で、worktree
  を切り替えても mode は変わりません。
- 選択中 Spec、Markdown tab、Diff file、`Changed` / `All`、展開 directory、
  開いている file tab は worktree ごとに保持されます。
- これらの UI state はアプリを終了すると消えます。comment だけが永続化されます。
- worktree badge は `Specs` では Archive 外の Spec 数、`Diff` では logical な
  changed file 数です。rename / copy はそれぞれ1件で、comment 数ではありません。

## 1. Workspace と worktree を選ぶ

1. `ワークスペースフォルダを開く` を選び、Git repository または Spec source を
   含む directory を開きます。
2. 左端の workspace tree から review 対象の worktree を選びます。
3. 初期表示の `Specs` で対象 Spec を選び、中央に Markdown が表示されることを
   確認します。

linked worktree では Spec、Diff navigation、comment document が worktree ごとに
分かれます。別 worktree へ切り替えても現在の `Specs` / `Diff` mode は維持され、
戻るとその worktree の直前の選択へ復帰します。

## 2. Specs をレビューする

### 階層、件数、Archive

- Spec 行の badge は configured mapping のうち regular file として存在する文書数
  です。空 file は数え、missing slot、未設定 Markdown、`.comments` は数えません。
- Category と Archive の badge は配下の Spec 数です。
- 各 source group の `Archive` は active category の後、末尾に表示され、初期状態は
  collapsed です。`.archive` 以外の hidden directory は表示されません。
- Spec 行の Archive action が成功すると、移動先の `Archive` が自動展開され、
  移動後の行へ focus します。Archive 配下の Spec は再度 Archive できません。

### Markdown tab と進捗

Spec を選ぶと、存在する configured artifact、その後に Spec directory 直下の追加
Markdown が tab に並びます。tab 切替は取得済み bundle を使うため、文書ごとの追加
読み込みは発生しません。

表示される進捗は backend scan が正本です。

| 表示 | 意味 |
| --- | --- |
| `Not started` | tasks が空、checkbox がすべて未完了、または configured artifact がまだない |
| `In progress` | tasks が一部完了、checkbox を持たない非空 tasks、または一部の configured artifact だけが完成 |
| `Completed` | tasks の checkbox がすべて完了、または tasks がなく全 configured non-task artifact が非空 |
| `Unknown` | tasks または configured artifact の read / parse に失敗 |

`Unknown` は完了扱いに丸められません。該当 tab の error を確認して修復し、reload
してください。

### Spec section comment

Markdown の対象 section / block を選んで comment を作成します。Spec comment は
Markdown block anchor を使い、右 sidebar から本文更新、返信、resolve / reopen、
削除、anchor 位置への移動を行えます。Spec comment は Diff comment とは別の
JSON v2 store、command、export / MCP 契約を使います。

## 3. Repository Diff をレビューする

toolbar の `Diff` を選ぶと、選択中 worktree の repository Diff へ切り替わります。
比較範囲は次の固定 contract です。

- base: resolved base branch と worktree `HEAD` の `merge-base`
- current: commit 済み + staged + unstaged + untracked を合わせた現在 snapshot
- `Changed`: base と current の間で変化した logical file
- `All`: current の tracked / untracked / ignored / 生成物と、base 側だけにある deleted
  file。`.git` 内部だけは常に除外

### Changed と All

未訪問 worktree は `Changed` から始まります。`All` は同じ
`currentSnapshotId` を使う表示 filter であり、切替だけでは snapshot 全体を再生成
しません。

ignored / generated directory は `All` に表示されますが、初期 overview では中身を
読みません。directory を展開したときに最大200 entry ずつ lazy load します。
`Changed` では ignored-only / unchanged file は表示されません。

### File tab と3つの表示 mode

tree で file を選ぶと中央の tab に追加されます。複数 file を開いたまま次の表示を
切り替えられます。

| Mode | 用途 |
| --- | --- |
| `Unified` | 追加・削除・context を1列で追い、変更の流れを読む |
| `Split` | base と current を左右で対応させて比較する |
| `Editor` | current snapshot 全文を読み、current line に comment する |

`Editor` は read-only です。編集、保存、stage、commit、discard は行いません。
binary、large、missing、unsupported file は理由別 status になり、取得できない行に
comment control は出ません。structured diff だけが上限を超えた場合は、取得済み
current 全文を警告付きで表示し、誤った change marker や jump は出しません。

## 4. Diff line comment と Review sidebar

`Unified` / `Split` の実在する base / current 行、または `Editor` の実在する
current 行から comment を作成します。spacer、peek summary、annotation、binary、
synthetic row は対象外です。

1. 行の `+` を選び、本文を入力します。
2. `Ctrl+Enter` または `Cmd+Enter` で保存します。`Esc` は draft を破棄せず composer
   を閉じ、元の control へ focus を戻します。
3. Review sidebar の `Open` / `Resolved` / `All` と search で対象を絞ります。
4. card の `行へ移動` で file / tab / line を開きます。base comment を `Editor`
   から開く場合は `Unified` へ切り替わります。
5. 対応済みなら resolve、再確認が必要なら reopen します。返信、本文更新、確認付き
   削除も同じ card から行えます。

行 indicator を選ぶと status filter は `All`、search は空になり、対応する card が
選択されます。複数の過去 comment が同じ行へ移動した場合は createdAt / ID 順の
picker から選択します。

anchor の状態は次の意味です。

| 状態 | Jump | 意味 |
| --- | --- | --- |
| `exact` | 可 | 保存した base / snapshot / path / side / line / hash が一致 |
| `relocated` | 可 | rename map と context から一意の移動先を特定 |
| `stale` | 不可 | path 消失、削除、binary、候補なし／複数などで安全な位置を特定不能 |
| `unavailable` | 不可 | IO、権限、時間／容量 budget、cancel、repository 更新で解決不能 |

`stale` / `unavailable` comment は削除されません。元 anchor と本文を保持し、近い行へ
推測で移動しません。未保存 draft が snapshot / worktree 変更で stale になった場合は、
新しい行へ re-anchor するか破棄してください。

## 5. レビュー完了の目安

1. `Specs` で対象 artifact と `Unknown` のない進捗を確認します。
2. `Diff > Changed` ですべての changed file を開きます。
3. 必要なら `All` で unchanged、ignored、生成物も確認します。
4. `Unified` / `Split` / `Editor` を目的に応じて使い分けます。
5. Review sidebar の `Open` が0件になるまで対応し、`Resolved` で履歴を確認します。
6. 完了した Spec は Archive し、移動先が表示されることを確認します。

アプリに repository 全体の「レビュー完了」を commit / push する action はありません。
resolve と Archive は review 状態の整理であり、Git の変更操作とは独立しています。

## 比較元とエラーからの回復

base branch は次の順で解決されます。

1. 検証済み explicit override
2. `branch.<current>.gh-merge-base`
3. current branch の remote HEAD
4. `origin/HEAD`
5. 一意なその他 remote HEAD
6. local `main`
7. local `master`

通常の tracking branch は feature branch 自身を指し得るため自動候補にしません。

| 表示・状態 | 回復方法 |
| --- | --- |
| 比較元を選択してください / `needsSelection` | remote HEAD または local `main` / `master` を用意し、repository を refresh。候補が複数なら remote HEAD を一意にする |
| 指定された比較元を解決できません / `invalidOverride` | override ref を修復・再選択するか解除してから refresh。黙って別候補へ fallback しない |
| `unbornHead` | worktree に最初の commit を作成してから refresh。架空の empty base とは比較しない |
| `detachedHead` / `shallowHistory` / `noCommonAncestor` | branch checkout、history fetch、または共通祖先を持つ base を用意して refresh |
| `staleBase` / `staleSnapshot` | repository が読み込み中に変化したため overview を refresh。古い response は自動的に棄却される |
| permission / path / schema error | 権限または store を修復し、validated reload。保存本文は先に copy する |
| revision conflict | 最新 document が再読み込みされ、draft は残る。内容を確認して再送信 |
| revision overflow | その worktree の Diff comment mutation は恒久停止。本文を copy して store を保全する |

現行 Phase 1 UI は repository base override の入力 control を公開していません。
自動解決できない場合は Git ref / remote HEAD を修復して `再試行` してください。explicit
override は backend / frontend hook の contract として実装されており、入力 UI は
後続候補です。

## 保存と retention

- Spec comment: `<spec-folder>/.comments/<logical-file>.json` の JSON v2
- Diff comment: Git common dir の
  `spec-viewer/diff-comments/df1_<storageFileKey>.v1.json`
- Diff comment file は canonical worktree storage identity ごとに分離されます。
- worktree を削除しても Diff comment document は orphaned review history として残ります。
  comment document の cleanup / export UI は未提供です。

保存中に store file を直接編集しないでください。manual recovery が必要なら先に backup
し、version、identity、canonical decimal revision、anchor を維持します。

## Phase 1 の対象外と後続候補

- stage、unstage、commit、discard、file 編集／保存
- Repository Diff の arbitrary な2 revision 比較、submodule 内部への recursive diff
- mode / filter / navigation state の session をまたぐ永続化
- repository base override の入力 UI
- orphaned Diff comment document の一覧、export、明示 cleanup
- stale comment の自動再配置、曖昧な anchor への jump

## 最新画面の参照

Storybook の `App/ReviewRegression` に Specs hierarchy、Archive、progress、Changed、All、
Unified、Split、Editor、comment conflict / stale / filter、base error の固定 scenario が
あります。ローカル確認方法は
[Review Phase 1 regression suite](./testing/review-phase-1-regression.md) を参照してください。
