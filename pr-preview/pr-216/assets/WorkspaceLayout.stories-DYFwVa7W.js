import{a as e,n as t}from"./chunk-DnJy8xQt.js";import{n}from"./iframe-xeUWA1Wl.js";import{t as r}from"./jsx-runtime-BX9360Lk.js";import{t as ee}from"./ChangesNavigation-Ruq6KWVs.js";import{t as i}from"./DiffWorkspace-C6eux8KX.js";import{t as a}from"./ViewModeToolbar-B3xQVH83.js";import{l as o,o as s,t as c}from"./workspace-Bn6WYmtD.js";import{t as l}from"./comments-C0DS7WtL.js";import{t as te}from"./CommentSidebar-BjwhWF-z.js";import{r as ne,t as u}from"./preferences-B3g9g65T.js";import{t as re}from"./MarkdownViewer-Ynzu_5Qw.js";import{r as d}from"./comment-anchor-draft-CNm67qj9.js";import{t as ie}from"./SpecTabs-Bz0236TG.js";import{r as ae}from"./specTreeState-ssW-0DUD.js";import{n as f,t as p}from"./commentId-0XF2jdVD.js";import{n as m,t as h}from"./WorkspaceLayout-DxCe_gRP.js";import{t as oe}from"./WorkspaceSidebarSection-BAz2Fg8p.js";import{t as se}from"./WorkspaceToolbar-D-17j1G9.js";import{t as g}from"./WorktreeTree-DHSIefdl.js";function ce(e){let{pathbar:t,toolbar:n,leftHeader:r,sidebar:ee,tabs:i,viewer:a,comments:o,leftOpen:s,leftWidth:c,leftMinWidth:l,leftMaxWidth:te,onOpenLeft:ne,onCloseLeft:u,onLeftWidthChange:re,commentsOpen:d,commentsWidth:ie,commentsMinWidth:ae,commentsMaxWidth:f,onOpenComments:p,onCloseComments:m,onCommentsWidthChange:oe}=e,[se,g]=(0,v.useState)(s??!0),[ce,le]=(0,v.useState)(c??240),[ue,de]=(0,v.useState)(d??!0),[_,fe]=(0,v.useState)(ie??300);return(0,y.jsxs)(h.Root,{worktrees:{isOpen:se,width:ce,minWidth:l,maxWidth:te,onOpen:()=>{g(!0),ne?.()},onClose:()=>{g(!1),u?.()},onWidthChange:e=>{le(e),re?.(e)}},comments:{isOpen:ue,width:_,minWidth:ae,maxWidth:f,onOpen:()=>{de(!0),p?.()},onClose:()=>{de(!1),m?.()},onWidthChange:e=>{fe(e),oe?.(e)}},children:[(0,y.jsx)(h.Pathbar,{children:t}),(0,y.jsx)(h.Toolbar,{children:n}),(0,y.jsx)(h.Worktrees,{header:r,children:ee}),(0,y.jsx)(h.ModeNavigation,{children:i}),(0,y.jsx)(h.Content,{children:a}),(0,y.jsx)(h.Comments,{children:o})]})}async function le(e){let t=w(e);await b(t.getByRole(`textbox`,{name:`PATH`})).toHaveValue(D),await b(t.getByRole(`treeitem`,{name:new RegExp(E)})).toHaveAttribute(`aria-current`,`page`),await b(t.getByRole(`button`,{name:`${E}を開く`})).toHaveAttribute(`aria-current`,`location`)}async function ue(e){let t=w(e),n=t.getByRole(`treeitem`,{name:/root/}),r=t.getByRole(`tab`,{name:`Specs`}),ee=t.getByRole(`tab`,{name:`Diff`}),i=t.getAllByRole(`separator`),a=e.querySelector(`.app-shell__toolbar`),o=e.querySelector(`.app-shell__toolbar-content`);await b(getComputedStyle(a).overflowX).toBe(`hidden`),await b(getComputedStyle(o).gridColumnStart).toBe(`2`),await b(o.clientWidth).toBe(a.clientWidth),await b(n).toHaveAttribute(`aria-current`,`page`),await b(r).toHaveAttribute(`aria-selected`,`true`),await b(i).toHaveLength(3);for(let e of i)await b(e).toHaveAttribute(`aria-valuenow`);await S.click(r),await S.keyboard(`{ArrowRight}`),await b(ee).toHaveFocus(),await S.click(t.getByRole(`button`,{name:`仕様一覧を閉じる`}));let s=t.getByRole(`button`,{name:`仕様一覧を開く`});await C(async()=>{await b(s).toHaveFocus()}),await S.click(s),await C(async()=>{await b(t.getByRole(`button`,{name:`仕様一覧を閉じる`})).toHaveFocus()});let c=e.querySelector(`.app-shell__comments-close`);await b(c).toBeVisible(),await S.click(c);let l=t.getByRole(`button`,{name:`サイドバーを開く`});await C(async()=>{await b(l).toHaveFocus()}),await S.click(l),await C(async()=>{await b(c).toHaveFocus()})}async function de(e){let t=e.querySelector(`.app-shell__mode-navigation .spec-tree__list`);await b(t).toBeInstanceOf(HTMLElement);let n=t;await b(n.scrollWidth).toBeLessThanOrEqual(n.clientWidth)}function _({treeState:e,documentState:t,selectedSpec:n,selectedFileKey:r,workspaceInput:o,workspaceStatusPath:s,workspaceErrorMessage:c=void 0,isWorkspaceLoading:l=!1,archivingSpecId:u=null,viewMode:d=`specs`,activeWorktreeName:f=null}){let p=n?.files.find(e=>e.key===r)??null,m;m=d===`diff`?(0,y.jsx)(i,{selectedPath:null,preview:null,availability:{status:`ready`}}):(0,y.jsxs)(`section`,{className:`specs-workspace__document`,"aria-label":`Spec document`,children:[(0,y.jsx)(ie,{spec:n,selectedFileKey:r,onSelectFile:x()}),(0,y.jsx)(`div`,{className:`specs-workspace__viewer`,children:(0,y.jsx)(re,{state:t,selectedSpecLabel:n?.label??null,selectedFileLabel:p?.label??null,comments:I,activeCommentId:O(`cmt_story_open_1`),onReload:x(),onSelectComment:x()})})]});let h=f===null?{path:`/workspace/plugin-manager`,displayName:`plugin-manager`,kind:`plugin-worktree`,lastOpenedAt:`2026-05-05T00:00:00.000Z`}:{path:s??D,displayName:f,kind:`plugin-worktree`,lastOpenedAt:`2026-05-05T00:00:00.000Z`};return{leftOpen:!0,leftHeader:null,pathbar:(0,y.jsx)(ne,{children:(0,y.jsx)(se,{workspacePath:s,inputValue:o,isLoading:l,isBrowsing:!1,errorMessage:c??null,canRefresh:n!==null&&r!==null,onInputChange:x(),onBrowse:x(),onLoad:x(),onRefresh:x(),onReset:x()})}),toolbar:(0,y.jsx)(a,{mode:d,activeItemLabel:n!==null&&p!==null?n.label+` / `+p.fileName:`ファイル未選択`,onModeChange:x()}),sidebar:(0,y.jsxs)(`div`,{className:`left-navigation-panel`,children:[(0,y.jsx)(oe,{currentWorkspacePath:s,isOpen:!0,isBusy:l,recentWorkspaces:[{path:`/workspace/spec-board`,displayName:`spec-board`,kind:`plugin-workspace`,lastOpenedAt:`2026-05-07T00:00:00.000Z`},{path:T,displayName:`pdfmod`,kind:`plugin-workspace`,lastOpenedAt:`2026-05-06T00:00:00.000Z`},h],onBrowse:x(),onToggleOpen:x(),onOpenWorkspace:x(),onRemoveWorkspace:x()}),(0,y.jsx)(fe,{activeWorktreeName:f})]}),tabs:d===`specs`?(0,y.jsx)(ae,{state:e,selectedSpecId:n?.id??null,archivingSpecId:u,isLoading:u!==null,onSelectSpec:x(),onArchiveSpec:x(),onReload:x()}):(0,y.jsx)(ee,{items:[],selectedId:null,availability:{status:`unavailable`,reason:`data-source-not-connected`},onSelect:x()}),viewer:m,comments:(0,y.jsx)(te,{listState:{status:`ready`,comments:I,error:null},operationState:{status:`idle`,operation:null,commentId:null,error:null},activeCommentId:O(`cmt_story_open_1`),onSelectComment:x(),onResolveComment:x(),onReopenComment:x(),onDeleteComment:x(),onUpdateComment:x(),onReload:x()})}}function fe({activeWorktreeName:e}){let t=e??`root`;return(0,y.jsxs)(`section`,{className:`story-worktree-tree`,"aria-label":`Worktrees`,children:[(0,y.jsx)(`input`,{"aria-label":`Filter worktrees`,placeholder:`Filter worktrees...`}),(0,y.jsxs)(`div`,{className:`story-worktree-tree__header`,children:[(0,y.jsxs)(`span`,{children:[`ROOT / WORKTREES `,pe.length]}),(0,y.jsx)(`span`,{"aria-hidden":`true`,children:`↻`})]}),(0,y.jsx)(g,{nodes:pe.map(e=>({kind:`worktree`,id:e.name,label:e.icon+` `+e.name,count:{kind:`changed-file-count`,value:e.changeCount}})),selectedWorktreeId:t,emptyLabel:`Worktree はありません`,onSelectWorktree:x()})]})}var v,y,b,x,S,C,w,T,E,D,O,pe,k,me,A,he,j,M,N,P,F,I,ge,L,R,z,B,V,H,U,W,G,K,q,J,Y,X,Z,Q,$,_e;t((()=>{v=e(n(),1),m(),l(),f(),o(),u(),s(),c(),y=r(),{expect:b,fn:x,userEvent:S,waitFor:C,within:w}=__STORYBOOK_MODULE_TEST__,T=`/workspace/pdfmod`,E=`agent-a1b3ff42`,D=`/workspace/pdfmod/.worktrees/${E}`,O=p.fromString,pe=[{name:`root`,icon:`⌂`,changeCount:0},{name:`549`,icon:`▣`,changeCount:2},{name:E,icon:`⑂`,changeCount:4},{name:`agent-a049b1c8`,icon:`⑂`,changeCount:0},{name:`agent-a395fbe1`,icon:`⑂`,changeCount:1},{name:`agent-a5b8a0d3`,icon:`⑂`,changeCount:2},{name:`agent-a65ad1a4`,icon:`⑂`,changeCount:7},{name:`archive`,icon:`▱`,changeCount:12,isMuted:!0}],k={id:`041-preview-task`,label:`041-preview-task`,kind:`spec`,sourceGroupId:`primary`,relativeId:`041-preview-task`,presentDocumentCount:3,descendantSpecCount:0,files:[{key:`exploration`,label:`exploration.md`,fileName:`exploration.md`,status:`present`},{key:`hearing`,label:`hearing.md`,fileName:`hearing.md`,status:`present`},{key:`impl`,label:`impl.md`,fileName:`impl.md`,status:`present`},{key:`tasks`,label:`tasks.md`,fileName:`tasks.md`,status:`missing`}],children:[]},me={specs:[{id:`040-delete-task-flow`,label:`040-delete-task-flow`,kind:`spec`,sourceGroupId:`primary`,relativeId:`040-delete-task-flow`,presentDocumentCount:3,descendantSpecCount:0,files:k.files,children:[]},k,{id:`042-cache-invalidation`,label:`042-cache-invalidation`,kind:`spec`,sourceGroupId:`primary`,relativeId:`042-cache-invalidation`,presentDocumentCount:3,descendantSpecCount:0,files:k.files.slice(0,3),children:[]},{id:`primary/.archive`,label:`Archive`,kind:`archive`,sourceGroupId:`primary`,relativeId:`.archive`,presentDocumentCount:0,descendantSpecCount:1,files:[],children:[{id:`primary/.archive/039-legacy-preview`,label:`039-legacy-preview`,kind:`spec`,sourceGroupId:`primary`,relativeId:`.archive/039-legacy-preview`,presentDocumentCount:3,descendantSpecCount:0,files:k.files,children:[]}]},{id:`secondary`,label:`agent-a1b3ff42 (.plugin-worktree)`,kind:`sourceGroup`,sourceGroupId:`secondary`,relativeId:`.`,presentDocumentCount:0,descendantSpecCount:1,files:[],children:[{...k,id:`secondary/041-preview-task`,sourceGroupId:`secondary`,relativeId:`041-preview-task`}]}]},A=`Implementation`,he=[{blockType:`heading`,blockIndex:0,textHash:d(`Implementation`),textSnippet:`Implementation`,sourceRange:null},{blockType:`paragraph`,blockIndex:1,textHash:d(`041-preview-task · impl`),textSnippet:`041-preview-task · impl`,sourceRange:null},{blockType:`paragraph`,blockIndex:2,textHash:d(`タスクプレビューの実装方針を、既存の QuickView 相当機能との統合方針を含めて決める。認証と描画性能の 2 軸で判断する。`),textSnippet:`タスクプレビューの実装方針を、既存の QuickView 相当機能との統合方針を含めて決める。認証と描画性能の 2 軸で判断する。`,sourceRange:null},{blockType:`heading`,blockIndex:3,textHash:d(`現状の課題`),textSnippet:`現状の課題`,sourceRange:null},{blockType:`list_item`,blockIndex:4,textHash:d(`プレビュー起動フローが複数入口に散らばっている`),textSnippet:`プレビュー起動フローが複数入口に散らばっている`,sourceRange:null},{blockType:`list_item`,blockIndex:5,textHash:d(`大きなタスクを開いたときの描画コストが線形に増える`),textSnippet:`大きなタスクを開いたときの描画コストが線形に増える`,sourceRange:null},{blockType:`list_item`,blockIndex:6,textHash:d(`権限のないタスクを掴んだときのエラーハンドリングが弱い`),textSnippet:`権限のないタスクを掴んだときのエラーハンドリングが弱い`,sourceRange:null},{blockType:`heading`,blockIndex:7,textHash:d(`検討した選択肢`),textSnippet:`検討した選択肢`,sourceRange:null},{blockType:`table`,blockIndex:8,textHash:d(`OPTION VERDICT A 既存 QuickView をそのままタスクにも流用 rejected B QuickView をラップした TaskPreview を新規に薄く作る accepted C プレビュー基盤ごと書き直す deferred`),textSnippet:`OPTION VERDICT A 既存 QuickView をそのままタスクにも流用 rejected B QuickView をラップした TaskPreview を新規に薄く作る accepted C プレビュー基盤ごと書き直す deferred`,sourceRange:null},{blockType:`heading`,blockIndex:9,textHash:d(`決定事項`),textSnippet:`決定事項`,sourceRange:null},{blockType:`paragraph`,blockIndex:10,textHash:d(`選択肢 B を採用する。既存の QuickView をラップした TaskPreview を薄く作り、タスク固有の権限チェックと空状態のみを新規実装する。描画は既存パスに委譲。`),textSnippet:`選択肢 B を採用する。既存の QuickView をラップした TaskPreview を薄く作り、タスク固有の権限チェックと空状態のみを新規実装する。描画は既存パスに委譲。`,sourceRange:null}],j={key:`impl`,path:`${T}/.plugin-workspace/.specs/041-preview-task/impl.md`,contents:[`# Implementation`,``,"`041-preview-task · impl`",``,"タスクプレビューの実装方針を、既存の `QuickView` 相当機能との統合方針を含めて決める。認証と描画性能の 2 軸で判断する。",``,`## 現状の課題`,``,`- プレビュー起動フローが複数入口に散らばっている`,`- 大きなタスクを開いたときの描画コストが線形に増える`,`- 権限のないタスクを掴んだときのエラーハンドリングが弱い`,``,`## 検討した選択肢`,``,`| OPTION | | VERDICT |`,`| --- | --- | --- |`,`| A | 既存 QuickView をそのままタスクにも流用 | rejected |`,`| B | **QuickView をラップした TaskPreview を新規に薄く作る** | accepted |`,`| C | プレビュー基盤ごと書き直す | deferred |`,``,`## 決定事項`,``,"選択肢 B を採用する。既存の QuickView をラップした `TaskPreview` を薄く作り、タスク固有の権限チェックと空状態のみを新規実装する。描画は既存パスに委譲。"].join(`
`),missing:!1,blocks:he},M={status:`ready`,workspacePath:T,tree:me,error:null},N={status:`ready`,workspacePath:T,specId:k.id,fileKey:`impl`,document:j,error:null},P={...M,workspacePath:D},F={...N,workspacePath:D,document:{...j,path:`${D}/.plugin-workspace/.specs/041-preview-task/impl.md`}},I=[{id:O(`cmt_story_open_1`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:d(A),textSnippet:`scorer.ts L16 · calcFu`,charRange:{start:0,end:14}},body:`ctx が undefined のとき落ちる。null チェックいる?`,status:`open`,createdAt:`2026-07-25T12:00:00Z`,updatedAt:`2026-07-25T12:00:00Z`},{id:O(`cmt_story_open_2`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:d(A),textSnippet:`pinfu.ts L10 · checkAllRuns`,charRange:{start:0,end:14}},body:`agent-a5b8a0d3 は shapes を Map で持ってた。どっちが速いか計測したい`,status:`open`,createdAt:`2026-07-25T10:00:00Z`,updatedAt:`2026-07-25T10:00:00Z`},{id:O(`cmt_story_open_3`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:d(A),textSnippet:`scorer.ts L14 · score()`,charRange:{start:0,end:14}},body:`戻り値の Result 型、hands/*.ts と重複してるフィールドあり`,status:`open`,createdAt:`2026-07-25T08:00:00Z`,updatedAt:`2026-07-25T08:00:00Z`},{id:O(`cmt_story_resolved`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:d(A),textSnippet:`implementation decision`,charRange:{start:0,end:14}},body:`描画経路の統合方針を反映済み。`,status:`resolved`,createdAt:`2026-07-24T08:00:00Z`,updatedAt:`2026-07-24T09:00:00Z`}],ge={component:ce,parameters:{layout:`fullscreen`,viewport:{options:Object.fromEntries([1200,1199,900,899,761,760].map(e=>[`width-`+e,{name:e+`px`,styles:{width:e+`px`,height:`800px`}}]))}},decorators:[e=>(0,y.jsx)(`div`,{style:{height:`100vh`},children:(0,y.jsx)(e,{})})],argTypes:{pathbar:{control:!1},toolbar:{control:!1},sidebar:{control:!1},tabs:{control:!1},viewer:{control:!1},comments:{control:!1}}},L=_({treeState:M,documentState:N,selectedSpec:k,selectedFileKey:`impl`,workspaceInput:T,workspaceStatusPath:T}),R={name:`Specs`,args:L,play:async({canvasElement:e})=>{await de(e),await ue(e)}},z={args:{...L,leftWidth:420,commentsWidth:560}},B={args:{...L,leftOpen:!1,commentsOpen:!1}},V={args:L,parameters:{viewport:{defaultViewport:`width-1200`}}},H={args:L,parameters:{viewport:{defaultViewport:`width-1199`}}},U={args:L,parameters:{viewport:{defaultViewport:`width-900`}}},W={args:L,parameters:{viewport:{defaultViewport:`width-899`}}},G={args:L,parameters:{viewport:{defaultViewport:`width-761`}}},K={args:L,parameters:{viewport:{defaultViewport:`width-760`}},play:async({canvasElement:e})=>{let t=w(e);await S.click(t.getByRole(`button`,{name:`仕様一覧を閉じる`}));let n=e.querySelector(`.app-shell__comments-close`);await b(n).toBeVisible(),await S.click(n),await S.click(t.getByRole(`tab`,{name:`Specs`})),await S.click(t.getByRole(`region`,{name:`Spec document`})),await S.click(t.getByRole(`button`,{name:`サイドバーを開く`}))}},q={args:_({treeState:M,documentState:N,selectedSpec:k,selectedFileKey:`impl`,workspaceInput:T,workspaceStatusPath:T,viewMode:`diff`})},J={args:_({treeState:P,documentState:F,selectedSpec:k,selectedFileKey:`impl`,workspaceInput:D,workspaceStatusPath:D,activeWorktreeName:E}),play:async({canvasElement:e})=>{await le(e)}},Y={args:_({treeState:P,documentState:F,selectedSpec:k,selectedFileKey:`impl`,workspaceInput:D,workspaceStatusPath:D,activeWorktreeName:E,viewMode:`diff`}),play:async({canvasElement:e})=>{await le(e)}},X={args:_({treeState:M,documentState:N,selectedSpec:k,selectedFileKey:`impl`,workspaceInput:T,workspaceStatusPath:T,archivingSpecId:k.id})},Z={args:_({treeState:{status:`loading`,workspacePath:T,tree:null,error:null},documentState:{status:`loading`,workspacePath:T,specId:k.id,fileKey:`impl`,document:null,error:null},selectedSpec:k,selectedFileKey:`impl`,workspaceInput:T,workspaceStatusPath:T,isWorkspaceLoading:!0})},Q={args:_({treeState:{status:`empty`,workspacePath:T,tree:{specs:[]},error:null},documentState:{status:`idle`,workspacePath:T,specId:null,fileKey:null,document:null,error:null},selectedSpec:null,selectedFileKey:null,workspaceInput:T,workspaceStatusPath:T})},$={args:_({treeState:{status:`error`,workspacePath:T,tree:null,error:{feature:`specs`,code:`specTreeScan`,message:`Spec directory could not be scanned.`,cause:{command:`list_specs`,code:`specTreeScan`,message:`Spec directory could not be scanned.`,raw:`Spec directory could not be scanned.`}}},documentState:{status:`error`,workspacePath:T,specId:k.id,fileKey:`impl`,document:null,error:{feature:`specs`,code:`markdownRead`,message:`Markdown file could not be read.`,cause:{command:`read_spec_file`,code:`markdownRead`,message:`Markdown file could not be read.`,raw:`Markdown file could not be read.`}}},selectedSpec:k,selectedFileKey:`impl`,workspaceInput:T,workspaceStatusPath:T,workspaceErrorMessage:`Workspace loaded with file warnings.`})},R.parameters={...R.parameters,docs:{...R.parameters?.docs,source:{originalSource:`{
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
}`,...R.parameters?.docs?.source}}},z.parameters={...z.parameters,docs:{...z.parameters?.docs,source:{originalSource:`{
  args: {
    ...readySpecsArgs,
    leftWidth: 420,
    commentsWidth: 560
  }
}`,...z.parameters?.docs?.source}}},B.parameters={...B.parameters,docs:{...B.parameters?.docs,source:{originalSource:`{
  args: {
    ...readySpecsArgs,
    leftOpen: false,
    commentsOpen: false
  }
}`,...B.parameters?.docs?.source}}},V.parameters={...V.parameters,docs:{...V.parameters?.docs,source:{originalSource:`{
  args: readySpecsArgs,
  parameters: {
    viewport: {
      defaultViewport: "width-1200"
    }
  }
}`,...V.parameters?.docs?.source}}},H.parameters={...H.parameters,docs:{...H.parameters?.docs,source:{originalSource:`{
  args: readySpecsArgs,
  parameters: {
    viewport: {
      defaultViewport: "width-1199"
    }
  }
}`,...H.parameters?.docs?.source}}},U.parameters={...U.parameters,docs:{...U.parameters?.docs,source:{originalSource:`{
  args: readySpecsArgs,
  parameters: {
    viewport: {
      defaultViewport: "width-900"
    }
  }
}`,...U.parameters?.docs?.source}}},W.parameters={...W.parameters,docs:{...W.parameters?.docs,source:{originalSource:`{
  args: readySpecsArgs,
  parameters: {
    viewport: {
      defaultViewport: "width-899"
    }
  }
}`,...W.parameters?.docs?.source}}},G.parameters={...G.parameters,docs:{...G.parameters?.docs,source:{originalSource:`{
  args: readySpecsArgs,
  parameters: {
    viewport: {
      defaultViewport: "width-761"
    }
  }
}`,...G.parameters?.docs?.source}}},K.parameters={...K.parameters,docs:{...K.parameters?.docs,source:{originalSource:`{
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
}`,...K.parameters?.docs?.source}}},q.parameters={...q.parameters,docs:{...q.parameters?.docs,source:{originalSource:`{
  args: createShellArgs({
    treeState: readyTreeState,
    documentState: readyDocumentState,
    selectedSpec: sampleSpec,
    selectedFileKey: "impl",
    workspaceInput: workspacePath,
    workspaceStatusPath: workspacePath,
    viewMode: "diff"
  })
}`,...q.parameters?.docs?.source}}},J.parameters={...J.parameters,docs:{...J.parameters?.docs,source:{originalSource:`{
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
}`,...J.parameters?.docs?.source}}},Y.parameters={...Y.parameters,docs:{...Y.parameters?.docs,source:{originalSource:`{
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
}`,...$.parameters?.docs?.source}}},_e=[`Default`,`AllProps`,`EdgeCases`,`Viewport1200`,`Viewport1199`,`Viewport900`,`Viewport899`,`Viewport761`,`Viewport760`,`Diff`,`WorktreeOpen`,`WorktreeDiff`,`Archiving`,`Loading`,`Empty`,`Error`]}))();export{z as AllProps,X as Archiving,R as Default,q as Diff,B as EdgeCases,Q as Empty,$ as Error,Z as Loading,H as Viewport1199,V as Viewport1200,K as Viewport760,G as Viewport761,W as Viewport899,U as Viewport900,Y as WorktreeDiff,J as WorktreeOpen,_e as __namedExportsOrder,ge as default};