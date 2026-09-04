import{a as e,n as t}from"./chunk-DnJy8xQt.js";import{i as n}from"./iframe-DkUc2U9t.js";import{d as r,t as i}from"./lucide-react-Cwub884p.js";import{t as a}from"./jsx-runtime-TRoWuN2H.js";import{n as o,t as s}from"./WorkspaceLayout-CUFnuZLQ.js";import{i as c,l,r as u,s as d}from"./CommentThread-QAArveAC.js";import{t as ee}from"./MarkdownViewer-7NXzItQ5.js";import{t as te}from"./SpecTabs-DLyA8GmY.js";import{r as ne}from"./specTreeState-CmqX9Dxk.js";import{r as f}from"./errorMessage-BIpBUFqs.js";import{r as re}from"./commentListState-CS8P2XXC.js";import{t as ie}from"./WorkspaceSidebarSection-DGbBvLjF.js";import{t as ae}from"./WorkspaceToolbar-BfdyZNZy.js";import{t as p}from"./WorktreeTree-CGTmi2IQ.js";import{t as m}from"./workspace-BzQ6wLtk.js";import{n as oe,t as h}from"./preferences-DqI3sMH6.js";import{t as se}from"./ChangesNavigation-C5Evpy4x.js";import{t as ce}from"./DiffViewer-ANnQlxFQ.js";import{t as le}from"./DiffWorkspace-CY1iifrk.js";import{t as ue}from"./ViewModeToolbar-CiJ9aGt1.js";import{t as de}from"./diff-DHa7qIPa.js";import{r as fe,t as pe}from"./testFixtures-R06EYCvB.js";function me(e){let{pathbar:t,toolbar:n,leftHeader:r,sidebar:i,tabs:a,viewer:o,comments:c,leftOpen:l,leftWidth:u,leftMinWidth:d,leftMaxWidth:ee,onOpenLeft:te,onCloseLeft:ne,onLeftWidthChange:f,commentsOpen:re,commentsWidth:ie,commentsMinWidth:ae,commentsMaxWidth:p,onOpenComments:m,onCloseComments:oe,onCommentsWidthChange:h}=e,[se,ce]=(0,_.useState)(l??!0),[le,ue]=(0,_.useState)(u??240),[de,fe]=(0,_.useState)(re??!0),[pe,me]=(0,_.useState)(ie??300);return(0,v.jsxs)(s.Root,{worktrees:{isOpen:se,width:le,minWidth:d,maxWidth:ee,onOpen:()=>{ce(!0),te?.()},onClose:()=>{ce(!1),ne?.()},onWidthChange:e=>{ue(e),f?.(e)}},comments:{isOpen:de,width:pe,minWidth:ae,maxWidth:p,onOpen:()=>{fe(!0),m?.()},onClose:()=>{fe(!1),oe?.()},onWidthChange:e=>{me(e),h?.(e)}},children:[(0,v.jsx)(s.Pathbar,{children:t}),(0,v.jsx)(s.Toolbar,{children:n}),(0,v.jsx)(s.Worktrees,{header:r,children:i}),(0,v.jsx)(s.ModeNavigation,{children:a}),(0,v.jsx)(s.Content,{children:o}),(0,v.jsx)(s.Comments,{children:c})]})}async function he(e){let t=C(e);await y(t.getByRole(`textbox`,{name:`PATH`})).toHaveValue(E),await y(t.getByRole(`treeitem`,{name:new RegExp(T)})).toHaveAttribute(`aria-current`,`page`),await y(t.getByRole(`button`,{name:`${T}を開く`})).toHaveAttribute(`aria-current`,`location`)}async function ge(e){let t=C(e),n=t.getByRole(`treeitem`,{name:/root/}),r=t.getByRole(`tab`,{name:`Specs`}),i=t.getByRole(`tab`,{name:`Diff`}),a=t.getAllByRole(`separator`),o=e.querySelector(`.app-shell__toolbar`),s=e.querySelector(`.app-shell__toolbar-content`);await y(getComputedStyle(o).overflowX).toBe(`hidden`),await y(getComputedStyle(s).gridColumnStart).toBe(`2`),await y(s.clientWidth).toBe(o.clientWidth),await y(n).toHaveAttribute(`aria-current`,`page`),await y(r).toHaveAttribute(`aria-selected`,`true`),await y(a).toHaveLength(3);for(let e of a)await y(e).toHaveAttribute(`aria-valuenow`);await x.click(r),await x.keyboard(`{ArrowRight}`),await y(i).toHaveFocus(),await x.click(t.getByRole(`button`,{name:`仕様一覧を閉じる`}));let c=t.getByRole(`button`,{name:`仕様一覧を開く`});await S(async()=>{await y(c).toHaveFocus()}),await x.click(c),await S(async()=>{await y(t.getByRole(`button`,{name:`仕様一覧を閉じる`})).toHaveFocus()});let l=e.querySelector(`.app-shell__comments-close`);await y(l).toBeVisible(),await x.click(l);let u=t.getByRole(`button`,{name:`サイドバーを開く`});await S(async()=>{await y(u).toHaveFocus()}),await x.click(u),await S(async()=>{await y(l).toHaveFocus()})}async function _e(e){let t=e.querySelector(`.app-shell__mode-navigation .spec-tree__list`);await y(t).toBeInstanceOf(HTMLElement);let n=t;await y(n.scrollWidth).toBeLessThanOrEqual(n.clientWidth)}function g({treeState:e,documentState:t,selectedSpec:n,selectedFileKey:r,workspaceInput:i,workspaceStatusPath:a,workspaceErrorMessage:o=void 0,isWorkspaceLoading:s=!1,archivingSpecId:c=null,viewMode:l=`specs`,activeWorktreeName:u=null,changedFiles:d=[]}){let f=n?.files.find(e=>e.key===r)??null,p=d[0]??null,m;m=l===`diff`?(0,v.jsx)(le,{selectedPath:p?.path??null,preview:p===null?null:(0,v.jsx)(ce,{fileDiff:be,mode:`unified`,activeChangeId:null,onActiveChangeIdChange:b()}),availability:{status:`ready`}}):(0,v.jsxs)(`section`,{className:`specs-workspace__document`,"aria-label":`Spec document`,children:[(0,v.jsx)(te,{spec:n,selectedFileKey:r,onSelectFile:b()}),(0,v.jsx)(`div`,{className:`specs-workspace__viewer`,children:(0,v.jsx)(ee,{state:t,selectedSpecLabel:n?.label??null,selectedFileLabel:f?.label??null,onReload:b()})})]});let h=u===null?{path:`/workspace/plugin-manager`,displayName:`plugin-manager`,kind:`plugin-worktree`,lastOpenedAt:`2026-05-05T00:00:00.000Z`}:{path:a??E,displayName:u,kind:`plugin-worktree`,lastOpenedAt:`2026-05-05T00:00:00.000Z`};return{leftOpen:!0,leftHeader:null,pathbar:(0,v.jsx)(oe,{children:(0,v.jsx)(ae,{workspacePath:a,inputValue:i,isLoading:s,isBrowsing:!1,errorMessage:o??null,canRefresh:n!==null&&r!==null,onInputChange:b(),onBrowse:b(),onLoad:b(),onRefresh:b(),onReset:b()})}),toolbar:(0,v.jsx)(ue,{mode:l,activeItemLabel:l===`diff`?p?.path??`ファイル未選択`:n!==null&&f!==null?n.label+` / `+f.fileName:`ファイル未選択`,onModeChange:b()}),sidebar:(0,v.jsxs)(`div`,{className:`left-navigation-panel`,children:[(0,v.jsx)(ie,{currentWorkspacePath:a,isOpen:!0,isBusy:s,recentWorkspaces:[{path:`/workspace/spec-board`,displayName:`spec-board`,kind:`plugin-workspace`,lastOpenedAt:`2026-05-07T00:00:00.000Z`},{path:w,displayName:`pdfmod`,kind:`plugin-workspace`,lastOpenedAt:`2026-05-06T00:00:00.000Z`},h],onBrowse:b(),onToggleOpen:b(),onOpenWorkspace:b(),onRemoveWorkspace:b()}),(0,v.jsx)(ve,{activeWorktreeName:u})]}),tabs:l===`specs`?(0,v.jsx)(ne,{state:e,selectedSpecId:n?.id??null,archivingSpecId:c,isLoading:c!==null,onSelectSpec:b(),onArchiveSpec:b(),onReload:b()}):(0,v.jsx)(se,{items:d,selectedId:p?.id??null,availability:d.length===0?{status:`unavailable`,reason:`data-source-not-connected`}:{status:`ready`},onSelect:b()}),viewer:m,comments:(0,v.jsx)(re,{listState:{status:`ready`,comments:Ce,error:null},operationState:{status:`idle`,operation:null,commentId:null,error:null},activeCommentId:D(`cmt_story_open_1`),onSelectComment:b(),onResolveComment:b(),onReopenComment:b(),onDeleteComment:b(),onUpdateComment:b(),onReload:b()})}}function ve({activeWorktreeName:e}){let t=e??`root`;return(0,v.jsxs)(`section`,{className:`story-worktree-tree`,"aria-label":`Worktrees`,children:[(0,v.jsx)(`input`,{"aria-label":`Filter worktrees`,placeholder:`Filter worktrees...`}),(0,v.jsxs)(`div`,{className:`story-worktree-tree__header`,children:[(0,v.jsxs)(`span`,{children:[`ROOT / WORKTREES `,O.length]}),(0,v.jsx)(`button`,{className:`icon-button worktree-navigation__refresh`,type:`button`,"aria-label":`Worktree一覧を再読み込み`,title:`Worktree一覧を再読み込み`,onClick:b(),children:(0,v.jsx)(r,{"aria-hidden":`true`,size:12})})]}),(0,v.jsx)(p,{nodes:O.map(e=>({kind:`worktree`,id:e.name,label:e.icon+` `+e.name,count:{kind:`changed-file-count`,value:e.changeCount}})),selectedWorktreeId:t,emptyLabel:`Worktree はありません`,onSelectWorktree:b()})]})}var _,v,y,b,x,S,C,w,T,E,D,O,ye,be,k,xe,A,Se,j,M,N,P,F,Ce,we,I,L,R,z,B,V,H,U,W,G,K,q,J,Y,X,Z,Q,$,Te;t((()=>{i(),_=e(n(),1),o(),f(),c(),de(),fe(),h(),l(),m(),v=a(),{expect:y,fn:b,userEvent:x,waitFor:S,within:C}=__STORYBOOK_MODULE_TEST__,w=`/workspace/pdfmod`,T=`agent-a1b3ff42`,E=`/workspace/pdfmod/.worktrees/${T}`,D=u.fromString,O=[{name:`root`,icon:`⌂`,changeCount:0},{name:`549`,icon:`▣`,changeCount:2},{name:T,icon:`⑂`,changeCount:4},{name:`agent-a049b1c8`,icon:`⑂`,changeCount:0},{name:`agent-a395fbe1`,icon:`⑂`,changeCount:1},{name:`agent-a5b8a0d3`,icon:`⑂`,changeCount:2},{name:`agent-a65ad1a4`,icon:`⑂`,changeCount:7},{name:`archive`,icon:`▱`,changeCount:12,isMuted:!0}],ye=[{id:`src/app/App.tsx`,path:`src/app/App.tsx`,change:`modified`},{id:`src/features/workspace/components/WorktreeTree/index.tsx`,path:`src/features/workspace/components/WorktreeTree/index.tsx`,change:`modified`},{id:`src/features/workspace/hooks/useWorkspaceWorktrees/index.ts`,path:`src/features/workspace/hooks/useWorkspaceWorktrees/index.ts`,change:`added`},{id:`docs/worktree-navigation.md`,path:`docs/worktree-navigation.md`,change:`untracked`}],be=pe({fileKey:`src/app/App.tsx`,oldPath:`src/app/App.tsx`,newPath:`src/app/App.tsx`,lines:[{kind:`context`,text:`import { WorkspaceLayout } from "@/components/WorkspaceLayout";`},{kind:`removed`,text:`const emptyState = true;`},{kind:`added`,text:`const emptyState = false;`},{kind:`context`,text:`const changedFiles = [`},{kind:`removed`,text:`  "src/app/App.tsx",`},{kind:`added`,text:`  "src/features/workspace/components/WorktreeTree/index.tsx",`},{kind:`context`,text:`];`}]}),k={id:`041-preview-task`,label:`041-preview-task`,kind:`spec`,sourceGroupId:`primary`,relativeId:`041-preview-task`,presentDocumentCount:3,descendantSpecCount:0,files:[{key:`exploration`,label:`exploration.md`,fileName:`exploration.md`,status:`present`},{key:`hearing`,label:`hearing.md`,fileName:`hearing.md`,status:`present`},{key:`impl`,label:`impl.md`,fileName:`impl.md`,status:`present`},{key:`tasks`,label:`tasks.md`,fileName:`tasks.md`,status:`missing`}],children:[]},xe={specs:[{id:`040-delete-task-flow`,label:`040-delete-task-flow`,kind:`spec`,sourceGroupId:`primary`,relativeId:`040-delete-task-flow`,presentDocumentCount:3,descendantSpecCount:0,files:k.files,children:[]},k,{id:`042-cache-invalidation`,label:`042-cache-invalidation`,kind:`spec`,sourceGroupId:`primary`,relativeId:`042-cache-invalidation`,presentDocumentCount:3,descendantSpecCount:0,files:k.files.slice(0,3),children:[]},{id:`primary/.archive`,label:`Archive`,kind:`archive`,sourceGroupId:`primary`,relativeId:`.archive`,presentDocumentCount:0,descendantSpecCount:1,files:[],children:[{id:`primary/.archive/039-legacy-preview`,label:`039-legacy-preview`,kind:`spec`,sourceGroupId:`primary`,relativeId:`.archive/039-legacy-preview`,presentDocumentCount:3,descendantSpecCount:0,files:k.files,children:[]}]},{id:`secondary`,label:`agent-a1b3ff42 (.plugin-worktree)`,kind:`sourceGroup`,sourceGroupId:`secondary`,relativeId:`.`,presentDocumentCount:0,descendantSpecCount:1,files:[],children:[{...k,id:`secondary/041-preview-task`,sourceGroupId:`secondary`,relativeId:`041-preview-task`}]}]},A=`Implementation`,Se=[{blockType:`heading`,blockIndex:0,textHash:d(`Implementation`),textSnippet:`Implementation`,sourceRange:null},{blockType:`paragraph`,blockIndex:1,textHash:d(`041-preview-task · impl`),textSnippet:`041-preview-task · impl`,sourceRange:null},{blockType:`paragraph`,blockIndex:2,textHash:d(`タスクプレビューの実装方針を、既存の QuickView 相当機能との統合方針を含めて決める。認証と描画性能の 2 軸で判断する。`),textSnippet:`タスクプレビューの実装方針を、既存の QuickView 相当機能との統合方針を含めて決める。認証と描画性能の 2 軸で判断する。`,sourceRange:null},{blockType:`heading`,blockIndex:3,textHash:d(`現状の課題`),textSnippet:`現状の課題`,sourceRange:null},{blockType:`list_item`,blockIndex:4,textHash:d(`プレビュー起動フローが複数入口に散らばっている`),textSnippet:`プレビュー起動フローが複数入口に散らばっている`,sourceRange:null},{blockType:`list_item`,blockIndex:5,textHash:d(`大きなタスクを開いたときの描画コストが線形に増える`),textSnippet:`大きなタスクを開いたときの描画コストが線形に増える`,sourceRange:null},{blockType:`list_item`,blockIndex:6,textHash:d(`権限のないタスクを掴んだときのエラーハンドリングが弱い`),textSnippet:`権限のないタスクを掴んだときのエラーハンドリングが弱い`,sourceRange:null},{blockType:`heading`,blockIndex:7,textHash:d(`検討した選択肢`),textSnippet:`検討した選択肢`,sourceRange:null},{blockType:`table`,blockIndex:8,textHash:d(`OPTION VERDICT A 既存 QuickView をそのままタスクにも流用 rejected B QuickView をラップした TaskPreview を新規に薄く作る accepted C プレビュー基盤ごと書き直す deferred`),textSnippet:`OPTION VERDICT A 既存 QuickView をそのままタスクにも流用 rejected B QuickView をラップした TaskPreview を新規に薄く作る accepted C プレビュー基盤ごと書き直す deferred`,sourceRange:null},{blockType:`heading`,blockIndex:9,textHash:d(`決定事項`),textSnippet:`決定事項`,sourceRange:null},{blockType:`paragraph`,blockIndex:10,textHash:d(`選択肢 B を採用する。既存の QuickView をラップした TaskPreview を薄く作り、タスク固有の権限チェックと空状態のみを新規実装する。描画は既存パスに委譲。`),textSnippet:`選択肢 B を採用する。既存の QuickView をラップした TaskPreview を薄く作り、タスク固有の権限チェックと空状態のみを新規実装する。描画は既存パスに委譲。`,sourceRange:null}],j={key:`impl`,path:`${w}/.plugin-workspace/.specs/041-preview-task/impl.md`,contents:[`# Implementation`,``,"`041-preview-task · impl`",``,"タスクプレビューの実装方針を、既存の `QuickView` 相当機能との統合方針を含めて決める。認証と描画性能の 2 軸で判断する。",``,`## 現状の課題`,``,`- プレビュー起動フローが複数入口に散らばっている`,`- 大きなタスクを開いたときの描画コストが線形に増える`,`- 権限のないタスクを掴んだときのエラーハンドリングが弱い`,``,`## 検討した選択肢`,``,`| OPTION | | VERDICT |`,`| --- | --- | --- |`,`| A | 既存 QuickView をそのままタスクにも流用 | rejected |`,`| B | **QuickView をラップした TaskPreview を新規に薄く作る** | accepted |`,`| C | プレビュー基盤ごと書き直す | deferred |`,``,`## 決定事項`,``,"選択肢 B を採用する。既存の QuickView をラップした `TaskPreview` を薄く作り、タスク固有の権限チェックと空状態のみを新規実装する。描画は既存パスに委譲。"].join(`
`),missing:!1,blocks:Se},M={status:`ready`,workspacePath:w,tree:xe,error:null},N={status:`ready`,workspacePath:w,specId:k.id,fileKey:`impl`,document:j,error:null},P={...M,workspacePath:E},F={...N,workspacePath:E,document:{...j,path:`${E}/.plugin-workspace/.specs/041-preview-task/impl.md`}},Ce=[{id:D(`cmt_story_open_1`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:d(A),textSnippet:`scorer.ts L16 · calcFu`,charRange:{start:0,end:14}},body:`ctx が undefined のとき落ちる。null チェックいる?`,status:`open`,createdAt:`2026-07-25T12:00:00Z`,updatedAt:`2026-07-25T12:00:00Z`},{id:D(`cmt_story_open_2`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:d(A),textSnippet:`pinfu.ts L10 · checkAllRuns`,charRange:{start:0,end:14}},body:`agent-a5b8a0d3 は shapes を Map で持ってた。どっちが速いか計測したい`,status:`open`,createdAt:`2026-07-25T10:00:00Z`,updatedAt:`2026-07-25T10:00:00Z`},{id:D(`cmt_story_open_3`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:d(A),textSnippet:`scorer.ts L14 · score()`,charRange:{start:0,end:14}},body:`戻り値の Result 型、hands/*.ts と重複してるフィールドあり`,status:`open`,createdAt:`2026-07-25T08:00:00Z`,updatedAt:`2026-07-25T08:00:00Z`},{id:D(`cmt_story_resolved`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:d(A),textSnippet:`implementation decision`,charRange:{start:0,end:14}},body:`描画経路の統合方針を反映済み。`,status:`resolved`,createdAt:`2026-07-24T08:00:00Z`,updatedAt:`2026-07-24T09:00:00Z`}],we={component:me,parameters:{layout:`fullscreen`,viewport:{options:Object.fromEntries([1200,1199,900,899,761,760].map(e=>[`width-`+e,{name:e+`px`,styles:{width:e+`px`,height:`800px`}}]))}},decorators:[e=>(0,v.jsx)(`div`,{style:{height:`100vh`},children:(0,v.jsx)(e,{})})],argTypes:{pathbar:{control:!1},toolbar:{control:!1},sidebar:{control:!1},tabs:{control:!1},viewer:{control:!1},comments:{control:!1}}},I=g({treeState:M,documentState:N,selectedSpec:k,selectedFileKey:`impl`,workspaceInput:w,workspaceStatusPath:w}),L={name:`Specs`,args:I,play:async({canvasElement:e})=>{await _e(e),await ge(e)}},R={args:{...I,leftWidth:420,commentsWidth:560}},z={args:{...I,leftOpen:!1,commentsOpen:!1}},B={args:I,parameters:{viewport:{defaultViewport:`width-1200`}}},V={args:I,parameters:{viewport:{defaultViewport:`width-1199`}}},H={args:I,parameters:{viewport:{defaultViewport:`width-900`}}},U={args:I,parameters:{viewport:{defaultViewport:`width-899`}}},W={args:I,parameters:{viewport:{defaultViewport:`width-761`}}},G={args:I,parameters:{viewport:{defaultViewport:`width-760`}},play:async({canvasElement:e})=>{let t=C(e);await x.click(t.getByRole(`button`,{name:`仕様一覧を閉じる`}));let n=e.querySelector(`.app-shell__comments-close`);await y(n).toBeVisible(),await x.click(n),await x.click(t.getByRole(`tab`,{name:`Specs`})),await x.click(t.getByRole(`region`,{name:`Spec document`})),await x.click(t.getByRole(`button`,{name:`サイドバーを開く`}))}},K={args:g({treeState:M,documentState:N,selectedSpec:k,selectedFileKey:`impl`,workspaceInput:w,workspaceStatusPath:w,viewMode:`diff`})},q={args:g({treeState:P,documentState:F,selectedSpec:k,selectedFileKey:`impl`,workspaceInput:E,workspaceStatusPath:E,activeWorktreeName:T}),play:async({canvasElement:e})=>{await he(e)}},J={args:g({treeState:P,documentState:F,selectedSpec:k,selectedFileKey:`impl`,workspaceInput:E,workspaceStatusPath:E,activeWorktreeName:T,viewMode:`diff`}),play:async({canvasElement:e})=>{await he(e)}},Y={args:g({treeState:P,documentState:F,selectedSpec:k,selectedFileKey:`impl`,workspaceInput:E,workspaceStatusPath:E,activeWorktreeName:T,viewMode:`diff`,changedFiles:ye}),play:async({canvasElement:e})=>{await he(e);let t=C(e);await y(t.getByRole(`navigation`,{name:`変更ファイル`})).toBeVisible(),await y(t.getByRole(`button`,{name:/src\/app\/App\.tsx/})).toHaveAttribute(`aria-current`,`page`),await y(t.getByRole(`region`,{name:`src/app/App.tsx の差分`})).toBeVisible(),await y(e.querySelector(`.diff-viewer__cell[data-kind="added"]`)).not.toBeNull(),await y(e.querySelector(`.diff-viewer__cell[data-kind="removed"]`)).not.toBeNull(),await y(e.querySelectorAll(`.diff-viewer__line-number`).length).toBeGreaterThan(0);let n=Array.from(e.querySelectorAll(`.diff-viewer__marker`),e=>e.textContent);await y(n.includes(` `)).toBe(!0),await y(n.includes(`+`)).toBe(!0),await y(n.includes(`-`)).toBe(!0)}},X={args:g({treeState:M,documentState:N,selectedSpec:k,selectedFileKey:`impl`,workspaceInput:w,workspaceStatusPath:w,archivingSpecId:k.id})},Z={args:g({treeState:{status:`loading`,workspacePath:w,tree:null,error:null},documentState:{status:`loading`,workspacePath:w,specId:k.id,fileKey:`impl`,document:null,error:null},selectedSpec:k,selectedFileKey:`impl`,workspaceInput:w,workspaceStatusPath:w,isWorkspaceLoading:!0})},Q={args:g({treeState:{status:`empty`,workspacePath:w,tree:{specs:[]},error:null},documentState:{status:`idle`,workspacePath:w,specId:null,fileKey:null,document:null,error:null},selectedSpec:null,selectedFileKey:null,workspaceInput:w,workspaceStatusPath:w})},$={args:g({treeState:{status:`error`,workspacePath:w,tree:null,error:{feature:`specs`,code:`specTreeScan`,message:`Spec directory could not be scanned.`,cause:{command:`list_specs`,code:`specTreeScan`,message:`Spec directory could not be scanned.`,raw:`Spec directory could not be scanned.`}}},documentState:{status:`error`,workspacePath:w,specId:k.id,fileKey:`impl`,document:null,error:{feature:`specs`,code:`markdownRead`,message:`Markdown file could not be read.`,cause:{command:`read_spec_file`,code:`markdownRead`,message:`Markdown file could not be read.`,raw:`Markdown file could not be read.`}}},selectedSpec:k,selectedFileKey:`impl`,workspaceInput:w,workspaceStatusPath:w,workspaceErrorMessage:`Workspace loaded with file warnings.`})},L.parameters={...L.parameters,docs:{...L.parameters?.docs,source:{originalSource:`{
  name: "Specs",
  args: readySpecsArgs,
  /**
   * Verifies the Specs list scrolls only vertically and the shell stays accessible.
   *
   * @param context - Storybook play context with the rendered canvas element.
   */
  play: async ({
    canvasElement
  }) => {
    await verifySpecsListHasNoHorizontalOverflow(canvasElement);
    await verifyShellAccessibility(canvasElement);
  }
}`,...L.parameters?.docs?.source}}},R.parameters={...R.parameters,docs:{...R.parameters?.docs,source:{originalSource:`{
  args: {
    ...readySpecsArgs,
    leftWidth: 420,
    commentsWidth: 560
  }
}`,...R.parameters?.docs?.source}}},z.parameters={...z.parameters,docs:{...z.parameters?.docs,source:{originalSource:`{
  args: {
    ...readySpecsArgs,
    leftOpen: false,
    commentsOpen: false
  }
}`,...z.parameters?.docs?.source}}},B.parameters={...B.parameters,docs:{...B.parameters?.docs,source:{originalSource:`{
  args: readySpecsArgs,
  parameters: {
    viewport: {
      defaultViewport: "width-1200"
    }
  }
}`,...B.parameters?.docs?.source}}},V.parameters={...V.parameters,docs:{...V.parameters?.docs,source:{originalSource:`{
  args: readySpecsArgs,
  parameters: {
    viewport: {
      defaultViewport: "width-1199"
    }
  }
}`,...V.parameters?.docs?.source}}},H.parameters={...H.parameters,docs:{...H.parameters?.docs,source:{originalSource:`{
  args: readySpecsArgs,
  parameters: {
    viewport: {
      defaultViewport: "width-900"
    }
  }
}`,...H.parameters?.docs?.source}}},U.parameters={...U.parameters,docs:{...U.parameters?.docs,source:{originalSource:`{
  args: readySpecsArgs,
  parameters: {
    viewport: {
      defaultViewport: "width-899"
    }
  }
}`,...U.parameters?.docs?.source}}},W.parameters={...W.parameters,docs:{...W.parameters?.docs,source:{originalSource:`{
  args: readySpecsArgs,
  parameters: {
    viewport: {
      defaultViewport: "width-761"
    }
  }
}`,...W.parameters?.docs?.source}}},G.parameters={...G.parameters,docs:{...G.parameters?.docs,source:{originalSource:`{
  args: readySpecsArgs,
  parameters: {
    viewport: {
      defaultViewport: "width-760"
    }
  },
  /**
   * Exercises the narrow-viewport flow: close the worktrees panel, close comments,
   * switch to Specs, and reopen comments.
   *
   * @param context - Storybook play context with the rendered canvas element.
   */
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", {
      name: "仕様一覧を閉じる"
    }));
    const closeComments = canvasElement.querySelector<HTMLButtonElement>(".app-shell__comments-close");
    await expect(closeComments).toBeVisible();
    await userEvent.click(closeComments as HTMLButtonElement);
    await userEvent.click(canvas.getByRole("tab", {
      name: "Specs"
    }));
    await userEvent.click(canvas.getByRole("region", {
      name: "Spec document"
    }));
    await userEvent.click(canvas.getByRole("button", {
      name: "サイドバーを開く"
    }));
  }
}`,...G.parameters?.docs?.source}}},K.parameters={...K.parameters,docs:{...K.parameters?.docs,source:{originalSource:`{
  args: createShellArgs({
    treeState: readyTreeState,
    documentState: readyDocumentState,
    selectedSpec: sampleSpec,
    selectedFileKey: "impl",
    workspaceInput: workspacePath,
    workspaceStatusPath: workspacePath,
    viewMode: "diff"
  })
}`,...K.parameters?.docs?.source}}},q.parameters={...q.parameters,docs:{...q.parameters?.docs,source:{originalSource:`{
  args: createShellArgs({
    treeState: readyWorktreeTreeState,
    documentState: readyWorktreeDocumentState,
    selectedSpec: sampleSpec,
    selectedFileKey: "impl",
    workspaceInput: worktreeWorkspacePath,
    workspaceStatusPath: worktreeWorkspacePath,
    activeWorktreeName: worktreeName
  }),
  /**
   * Verifies the worktree Story keeps its path and selected tree row aligned.
   *
   * @param context - Storybook play context with the rendered canvas element.
   */
  play: async ({
    canvasElement
  }) => {
    await verifyWorktreeOpenStory(canvasElement);
  }
}`,...q.parameters?.docs?.source}}},J.parameters={...J.parameters,docs:{...J.parameters?.docs,source:{originalSource:`{
  args: createShellArgs({
    treeState: readyWorktreeTreeState,
    documentState: readyWorktreeDocumentState,
    selectedSpec: sampleSpec,
    selectedFileKey: "impl",
    workspaceInput: worktreeWorkspacePath,
    workspaceStatusPath: worktreeWorkspacePath,
    activeWorktreeName: worktreeName,
    viewMode: "diff"
  }),
  /**
   * Verifies the worktree Story keeps its path and selected tree row aligned.
   *
   * @param context - Storybook play context with the rendered canvas element.
   */
  play: async ({
    canvasElement
  }) => {
    await verifyWorktreeOpenStory(canvasElement);
  }
}`,...J.parameters?.docs?.source}}},Y.parameters={...Y.parameters,docs:{...Y.parameters?.docs,source:{originalSource:`{
  args: createShellArgs({
    treeState: readyWorktreeTreeState,
    documentState: readyWorktreeDocumentState,
    selectedSpec: sampleSpec,
    selectedFileKey: "impl",
    workspaceInput: worktreeWorkspacePath,
    workspaceStatusPath: worktreeWorkspacePath,
    activeWorktreeName: worktreeName,
    viewMode: "diff",
    changedFiles: worktreeChangedFiles
  }),
  /**
   * Verifies that a populated worktree exposes its changed files and preview.
   *
   * @param canvasElement - Rendered Storybook canvas.
   */
  play: async ({
    canvasElement
  }) => {
    await verifyWorktreeOpenStory(canvasElement);
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("navigation", {
      name: "変更ファイル"
    })).toBeVisible();
    await expect(canvas.getByRole("button", {
      name: /src\\/app\\/App\\.tsx/
    })).toHaveAttribute("aria-current", "page");
    await expect(canvas.getByRole("region", {
      name: "src/app/App.tsx の差分"
    })).toBeVisible();
    await expect(canvasElement.querySelector('.diff-viewer__cell[data-kind="added"]')).not.toBeNull();
    await expect(canvasElement.querySelector('.diff-viewer__cell[data-kind="removed"]')).not.toBeNull();
    await expect(canvasElement.querySelectorAll(".diff-viewer__line-number").length).toBeGreaterThan(0);
    const markers = Array.from(canvasElement.querySelectorAll(".diff-viewer__marker"), marker => marker.textContent);
    await expect(markers.includes(" ")).toBe(true);
    await expect(markers.includes("+")).toBe(true);
    await expect(markers.includes("-")).toBe(true);
  }
}`,...Y.parameters?.docs?.source}}},X.parameters={...X.parameters,docs:{...X.parameters?.docs,source:{originalSource:`{
  args: createShellArgs({
    treeState: readyTreeState,
    documentState: readyDocumentState,
    selectedSpec: sampleSpec,
    selectedFileKey: "impl",
    workspaceInput: workspacePath,
    workspaceStatusPath: workspacePath,
    archivingSpecId: sampleSpec.id
  })
}`,...X.parameters?.docs?.source}}},Z.parameters={...Z.parameters,docs:{...Z.parameters?.docs,source:{originalSource:`{
  args: createShellArgs({
    treeState: {
      status: "loading",
      workspacePath,
      tree: null,
      error: null
    },
    documentState: {
      status: "loading",
      workspacePath,
      specId: sampleSpec.id,
      fileKey: "impl",
      document: null,
      error: null
    },
    selectedSpec: sampleSpec,
    selectedFileKey: "impl",
    workspaceInput: workspacePath,
    workspaceStatusPath: workspacePath,
    isWorkspaceLoading: true
  })
}`,...Z.parameters?.docs?.source}}},Q.parameters={...Q.parameters,docs:{...Q.parameters?.docs,source:{originalSource:`{
  args: createShellArgs({
    treeState: {
      status: "empty",
      workspacePath,
      tree: {
        specs: []
      },
      error: null
    },
    documentState: {
      status: "idle",
      workspacePath,
      specId: null,
      fileKey: null,
      document: null,
      error: null
    },
    selectedSpec: null,
    selectedFileKey: null,
    workspaceInput: workspacePath,
    workspaceStatusPath: workspacePath
  })
}`,...Q.parameters?.docs?.source}}},$.parameters={...$.parameters,docs:{...$.parameters?.docs,source:{originalSource:`{
  args: createShellArgs({
    treeState: {
      status: "error",
      workspacePath,
      tree: null,
      error: {
        feature: "specs",
        code: "specTreeScan",
        message: "Spec directory could not be scanned.",
        cause: {
          command: "list_specs",
          code: "specTreeScan",
          message: "Spec directory could not be scanned.",
          raw: "Spec directory could not be scanned."
        }
      }
    },
    documentState: {
      status: "error",
      workspacePath,
      specId: sampleSpec.id,
      fileKey: "impl",
      document: null,
      error: {
        feature: "specs",
        code: "markdownRead",
        message: "Markdown file could not be read.",
        cause: {
          command: "read_spec_file",
          code: "markdownRead",
          message: "Markdown file could not be read.",
          raw: "Markdown file could not be read."
        }
      }
    },
    selectedSpec: sampleSpec,
    selectedFileKey: "impl",
    workspaceInput: workspacePath,
    workspaceStatusPath: workspacePath,
    workspaceErrorMessage: "Workspace loaded with file warnings."
  })
}`,...$.parameters?.docs?.source}}},Te=[`Default`,`AllProps`,`EdgeCases`,`Viewport1200`,`Viewport1199`,`Viewport900`,`Viewport899`,`Viewport761`,`Viewport760`,`Diff`,`WorktreeOpen`,`WorktreeDiff`,`WorktreeDiffWithFiles`,`Archiving`,`Loading`,`Empty`,`Error`]}))();export{R as AllProps,X as Archiving,L as Default,K as Diff,z as EdgeCases,Q as Empty,$ as Error,Z as Loading,V as Viewport1199,B as Viewport1200,G as Viewport760,W as Viewport761,U as Viewport899,H as Viewport900,J as WorktreeDiff,Y as WorktreeDiffWithFiles,q as WorktreeOpen,Te as __namedExportsOrder,we as default};