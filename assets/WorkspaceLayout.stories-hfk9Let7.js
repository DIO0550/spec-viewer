import{a as e,n as t}from"./chunk-DnJy8xQt.js";import{n}from"./iframe-XPPU-COY.js";import{t as r}from"./jsx-runtime-BX9360Lk.js";import{t as ee}from"./ChangesNavigation-ChxzNONS.js";import{t as i}from"./DiffWorkspace-CkGmv86B.js";import{t as a}from"./ViewModeToolbar-Bp6zUHMN.js";import{l as o,o as s,t as c}from"./workspace-C-MPjCsf.js";import{t as l}from"./comments-DHNvqiem.js";import{t as te}from"./CommentSidebar-96L5rWCA.js";import{r as ne,t as u}from"./preferences-B4NlQSpP.js";import{t as re}from"./MarkdownViewer-uvB7viiB.js";import{a as d,n as f,t as p}from"./commentId-D1q21bjy.js";import{t as ie}from"./SpecTabs-BOZ8mqTR.js";import{r as ae}from"./specTreeState-Dj8HJusN.js";import{n as m,t as h}from"./WorkspaceLayout-CcTlhBK-.js";import{t as oe}from"./WorkspaceSidebarSection-CkJw-LKY.js";import{t as se}from"./WorkspaceToolbar-Bw3ZHpPG.js";import{t as ce}from"./WorktreeTree-DQJaJgiF.js";function le(e){let{pathbar:t,toolbar:n,leftHeader:r,sidebar:ee,tabs:i,viewer:a,comments:o,leftOpen:s,leftWidth:c,leftMinWidth:l,leftMaxWidth:te,onOpenLeft:ne,onCloseLeft:u,onLeftWidthChange:re,commentsOpen:d,commentsWidth:f,commentsMinWidth:p,commentsMaxWidth:ie,onOpenComments:ae,onCloseComments:m,onCommentsWidthChange:oe}=e,[se,ce]=(0,_.useState)(s??!0),[le,ue]=(0,_.useState)(c??240),[de,fe]=(0,_.useState)(d??!0),[g,pe]=(0,_.useState)(f??300);return(0,v.jsxs)(h.Root,{worktrees:{isOpen:se,width:le,minWidth:l,maxWidth:te,onOpen:()=>{ce(!0),ne?.()},onClose:()=>{ce(!1),u?.()},onWidthChange:e=>{ue(e),re?.(e)}},comments:{isOpen:de,width:g,minWidth:p,maxWidth:ie,onOpen:()=>{fe(!0),ae?.()},onClose:()=>{fe(!1),m?.()},onWidthChange:e=>{pe(e),oe?.(e)}},children:[(0,v.jsx)(h.Pathbar,{children:t}),(0,v.jsx)(h.Toolbar,{children:n}),(0,v.jsx)(h.Worktrees,{header:r,children:ee}),(0,v.jsx)(h.ModeNavigation,{children:i}),(0,v.jsx)(h.Content,{children:a}),(0,v.jsx)(h.Comments,{children:o})]})}async function ue(e){let t=C(e);await y(t.getByRole(`textbox`,{name:`PATH`})).toHaveValue(E),await y(t.getByRole(`treeitem`,{name:new RegExp(T)})).toHaveAttribute(`aria-current`,`page`),await y(t.getByRole(`button`,{name:`${T}を開く`})).toHaveAttribute(`aria-current`,`location`)}async function de(e){let t=C(e),n=t.getByRole(`treeitem`,{name:/root/}),r=t.getByRole(`tab`,{name:`Specs`}),ee=t.getByRole(`tab`,{name:`Diff`}),i=t.getAllByRole(`separator`),a=e.querySelector(`.app-shell__toolbar`),o=e.querySelector(`.app-shell__toolbar-content`);await y(getComputedStyle(a).overflowX).toBe(`hidden`),await y(getComputedStyle(o).gridColumnStart).toBe(`2`),await y(o.clientWidth).toBe(a.clientWidth),await y(n).toHaveAttribute(`aria-current`,`page`),await y(r).toHaveAttribute(`aria-selected`,`true`),await y(i).toHaveLength(3);for(let e of i)await y(e).toHaveAttribute(`aria-valuenow`);await x.click(r),await x.keyboard(`{ArrowRight}`),await y(ee).toHaveFocus(),await x.click(t.getByRole(`button`,{name:`仕様一覧を閉じる`}));let s=t.getByRole(`button`,{name:`仕様一覧を開く`});await S(async()=>{await y(s).toHaveFocus()}),await x.click(s),await S(async()=>{await y(t.getByRole(`button`,{name:`仕様一覧を閉じる`})).toHaveFocus()});let c=e.querySelector(`.app-shell__comments-close`);await y(c).toBeVisible(),await x.click(c);let l=t.getByRole(`button`,{name:`サイドバーを開く`});await S(async()=>{await y(l).toHaveFocus()}),await x.click(l),await S(async()=>{await y(c).toHaveFocus()})}async function fe(e){let t=e.querySelector(`.app-shell__mode-navigation .spec-tree__list`);await y(t).toBeInstanceOf(HTMLElement);let n=t;await y(n.scrollWidth).toBeLessThanOrEqual(n.clientWidth)}function g({treeState:e,documentState:t,selectedSpec:n,selectedFileKey:r,workspaceInput:o,workspaceStatusPath:s,workspaceErrorMessage:c=void 0,isWorkspaceLoading:l=!1,archivingSpecId:u=null,viewMode:d=`specs`,activeWorktreeName:f=null}){let p=n?.files.find(e=>e.key===r)??null,m;m=d===`diff`?(0,v.jsx)(i,{selectedPath:null,preview:null,availability:{status:`ready`}}):(0,v.jsxs)(`section`,{className:`specs-workspace__document`,"aria-label":`Spec document`,children:[(0,v.jsx)(ie,{spec:n,selectedFileKey:r,onSelectFile:b()}),(0,v.jsx)(`div`,{className:`specs-workspace__viewer`,children:(0,v.jsx)(re,{state:t,selectedSpecLabel:n?.label??null,selectedFileLabel:p?.label??null,comments:I,activeCommentId:D(`cmt_story_open_1`),onReload:b(),onSelectComment:b()})})]});let h=f===null?{path:`/workspace/plugin-manager`,displayName:`plugin-manager`,kind:`plugin-worktree`,lastOpenedAt:`2026-05-05T00:00:00.000Z`}:{path:s??E,displayName:f,kind:`plugin-worktree`,lastOpenedAt:`2026-05-05T00:00:00.000Z`};return{leftOpen:!0,leftHeader:null,pathbar:(0,v.jsx)(ne,{children:(0,v.jsx)(se,{workspacePath:s,inputValue:o,isLoading:l,isBrowsing:!1,errorMessage:c??null,canRefresh:n!==null&&r!==null,onInputChange:b(),onBrowse:b(),onLoad:b(),onRefresh:b(),onReset:b()})}),toolbar:(0,v.jsx)(a,{mode:d,activeItemLabel:n!==null&&p!==null?n.label+` / `+p.fileName:`ファイル未選択`,onModeChange:b()}),sidebar:(0,v.jsxs)(`div`,{className:`left-navigation-panel`,children:[(0,v.jsx)(oe,{currentWorkspacePath:s,isOpen:!0,isBusy:l,recentWorkspaces:[{path:`/workspace/spec-board`,displayName:`spec-board`,kind:`plugin-workspace`,lastOpenedAt:`2026-05-07T00:00:00.000Z`},{path:w,displayName:`pdfmod`,kind:`plugin-workspace`,lastOpenedAt:`2026-05-06T00:00:00.000Z`},h],onBrowse:b(),onToggleOpen:b(),onOpenWorkspace:b(),onRemoveWorkspace:b()}),(0,v.jsx)(pe,{activeWorktreeName:f})]}),tabs:d===`specs`?(0,v.jsx)(ae,{state:e,selectedSpecId:n?.id??null,archivingSpecId:u,isLoading:u!==null,onSelectSpec:b(),onArchiveSpec:b(),onReload:b()}):(0,v.jsx)(ee,{items:[],selectedId:null,availability:{status:`unavailable`,reason:`data-source-not-connected`},onSelect:b()}),viewer:m,comments:(0,v.jsx)(te,{listState:{status:`ready`,comments:I,error:null},operationState:{status:`idle`,operation:null,commentId:null,error:null},activeCommentId:D(`cmt_story_open_1`),onSelectComment:b(),onResolveComment:b(),onReopenComment:b(),onDeleteComment:b(),onUpdateComment:b(),onReload:b()})}}function pe({activeWorktreeName:e}){let t=e??`root`;return(0,v.jsxs)(`section`,{className:`story-worktree-tree`,"aria-label":`Worktrees`,children:[(0,v.jsx)(`input`,{"aria-label":`Filter worktrees`,placeholder:`Filter worktrees...`}),(0,v.jsxs)(`div`,{className:`story-worktree-tree__header`,children:[(0,v.jsxs)(`span`,{children:[`ROOT / WORKTREES `,O.length]}),(0,v.jsx)(`span`,{"aria-hidden":`true`,children:`↻`})]}),(0,v.jsx)(ce,{nodes:O.map(e=>({kind:`worktree`,id:e.name,label:e.icon+` `+e.name,count:{kind:`changed-file-count`,value:e.changeCount}})),selectedWorktreeId:t,emptyLabel:`Worktree はありません`,onSelectWorktree:b()})]})}var _,v,y,b,x,S,C,w,T,E,D,O,k,me,A,he,j,M,N,P,F,I,ge,L,R,z,B,V,H,U,W,G,K,q,J,Y,X,Z,Q,$,_e;t((()=>{_=e(n(),1),l(),f(),o(),u(),s(),c(),m(),v=r(),{expect:y,fn:b,userEvent:x,waitFor:S,within:C}=__STORYBOOK_MODULE_TEST__,w=`/workspace/pdfmod`,T=`agent-a1b3ff42`,E=`/workspace/pdfmod/.worktrees/${T}`,D=p.fromString,O=[{name:`root`,icon:`⌂`,changeCount:0},{name:`549`,icon:`▣`,changeCount:2},{name:T,icon:`⑂`,changeCount:4},{name:`agent-a049b1c8`,icon:`⑂`,changeCount:0},{name:`agent-a395fbe1`,icon:`⑂`,changeCount:1},{name:`agent-a5b8a0d3`,icon:`⑂`,changeCount:2},{name:`agent-a65ad1a4`,icon:`⑂`,changeCount:7},{name:`archive`,icon:`▱`,changeCount:12,isMuted:!0}],k={id:`041-preview-task`,label:`041-preview-task`,kind:`spec`,sourceGroupId:`primary`,relativeId:`041-preview-task`,presentDocumentCount:3,descendantSpecCount:0,files:[{key:`exploration`,label:`exploration.md`,fileName:`exploration.md`,status:`present`},{key:`hearing`,label:`hearing.md`,fileName:`hearing.md`,status:`present`},{key:`impl`,label:`impl.md`,fileName:`impl.md`,status:`present`},{key:`tasks`,label:`tasks.md`,fileName:`tasks.md`,status:`missing`}],children:[]},me={specs:[{id:`040-delete-task-flow`,label:`040-delete-task-flow`,kind:`spec`,sourceGroupId:`primary`,relativeId:`040-delete-task-flow`,presentDocumentCount:3,descendantSpecCount:0,files:k.files,children:[]},k,{id:`042-cache-invalidation`,label:`042-cache-invalidation`,kind:`spec`,sourceGroupId:`primary`,relativeId:`042-cache-invalidation`,presentDocumentCount:3,descendantSpecCount:0,files:k.files.slice(0,3),children:[]},{id:`primary/.archive`,label:`Archive`,kind:`archive`,sourceGroupId:`primary`,relativeId:`.archive`,presentDocumentCount:0,descendantSpecCount:1,files:[],children:[{id:`primary/.archive/039-legacy-preview`,label:`039-legacy-preview`,kind:`spec`,sourceGroupId:`primary`,relativeId:`.archive/039-legacy-preview`,presentDocumentCount:3,descendantSpecCount:0,files:k.files,children:[]}]},{id:`secondary`,label:`agent-a1b3ff42 (.plugin-worktree)`,kind:`sourceGroup`,sourceGroupId:`secondary`,relativeId:`.`,presentDocumentCount:0,descendantSpecCount:1,files:[],children:[{...k,id:`secondary/041-preview-task`,sourceGroupId:`secondary`,relativeId:`041-preview-task`}]}]},A=`Implementation`,he=[{blockType:`heading`,blockIndex:0,textHash:d(`Implementation`),textSnippet:`Implementation`,sourceRange:null},{blockType:`paragraph`,blockIndex:1,textHash:d(`041-preview-task · impl`),textSnippet:`041-preview-task · impl`,sourceRange:null},{blockType:`paragraph`,blockIndex:2,textHash:d(`タスクプレビューの実装方針を、既存の QuickView 相当機能との統合方針を含めて決める。認証と描画性能の 2 軸で判断する。`),textSnippet:`タスクプレビューの実装方針を、既存の QuickView 相当機能との統合方針を含めて決める。認証と描画性能の 2 軸で判断する。`,sourceRange:null},{blockType:`heading`,blockIndex:3,textHash:d(`現状の課題`),textSnippet:`現状の課題`,sourceRange:null},{blockType:`list_item`,blockIndex:4,textHash:d(`プレビュー起動フローが複数入口に散らばっている`),textSnippet:`プレビュー起動フローが複数入口に散らばっている`,sourceRange:null},{blockType:`list_item`,blockIndex:5,textHash:d(`大きなタスクを開いたときの描画コストが線形に増える`),textSnippet:`大きなタスクを開いたときの描画コストが線形に増える`,sourceRange:null},{blockType:`list_item`,blockIndex:6,textHash:d(`権限のないタスクを掴んだときのエラーハンドリングが弱い`),textSnippet:`権限のないタスクを掴んだときのエラーハンドリングが弱い`,sourceRange:null},{blockType:`heading`,blockIndex:7,textHash:d(`検討した選択肢`),textSnippet:`検討した選択肢`,sourceRange:null},{blockType:`table`,blockIndex:8,textHash:d(`OPTION VERDICT A 既存 QuickView をそのままタスクにも流用 rejected B QuickView をラップした TaskPreview を新規に薄く作る accepted C プレビュー基盤ごと書き直す deferred`),textSnippet:`OPTION VERDICT A 既存 QuickView をそのままタスクにも流用 rejected B QuickView をラップした TaskPreview を新規に薄く作る accepted C プレビュー基盤ごと書き直す deferred`,sourceRange:null},{blockType:`heading`,blockIndex:9,textHash:d(`決定事項`),textSnippet:`決定事項`,sourceRange:null},{blockType:`paragraph`,blockIndex:10,textHash:d(`選択肢 B を採用する。既存の QuickView をラップした TaskPreview を薄く作り、タスク固有の権限チェックと空状態のみを新規実装する。描画は既存パスに委譲。`),textSnippet:`選択肢 B を採用する。既存の QuickView をラップした TaskPreview を薄く作り、タスク固有の権限チェックと空状態のみを新規実装する。描画は既存パスに委譲。`,sourceRange:null}],j={key:`impl`,path:`${w}/.plugin-workspace/.specs/041-preview-task/impl.md`,contents:[`# Implementation`,``,"`041-preview-task · impl`",``,"タスクプレビューの実装方針を、既存の `QuickView` 相当機能との統合方針を含めて決める。認証と描画性能の 2 軸で判断する。",``,`## 現状の課題`,``,`- プレビュー起動フローが複数入口に散らばっている`,`- 大きなタスクを開いたときの描画コストが線形に増える`,`- 権限のないタスクを掴んだときのエラーハンドリングが弱い`,``,`## 検討した選択肢`,``,`| OPTION | | VERDICT |`,`| --- | --- | --- |`,`| A | 既存 QuickView をそのままタスクにも流用 | rejected |`,`| B | **QuickView をラップした TaskPreview を新規に薄く作る** | accepted |`,`| C | プレビュー基盤ごと書き直す | deferred |`,``,`## 決定事項`,``,"選択肢 B を採用する。既存の QuickView をラップした `TaskPreview` を薄く作り、タスク固有の権限チェックと空状態のみを新規実装する。描画は既存パスに委譲。"].join(`
`),missing:!1,blocks:he},M={status:`ready`,workspacePath:w,tree:me,error:null},N={status:`ready`,workspacePath:w,specId:k.id,fileKey:`impl`,document:j,error:null},P={...M,workspacePath:E},F={...N,workspacePath:E,document:{...j,path:`${E}/.plugin-workspace/.specs/041-preview-task/impl.md`}},I=[{id:D(`cmt_story_open_1`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:d(A),textSnippet:`scorer.ts L16 · calcFu`,charRange:{start:0,end:14}},body:`ctx が undefined のとき落ちる。null チェックいる?`,status:`open`,createdAt:`2026-07-25T12:00:00Z`,updatedAt:`2026-07-25T12:00:00Z`},{id:D(`cmt_story_open_2`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:d(A),textSnippet:`pinfu.ts L10 · checkAllRuns`,charRange:{start:0,end:14}},body:`agent-a5b8a0d3 は shapes を Map で持ってた。どっちが速いか計測したい`,status:`open`,createdAt:`2026-07-25T10:00:00Z`,updatedAt:`2026-07-25T10:00:00Z`},{id:D(`cmt_story_open_3`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:d(A),textSnippet:`scorer.ts L14 · score()`,charRange:{start:0,end:14}},body:`戻り値の Result 型、hands/*.ts と重複してるフィールドあり`,status:`open`,createdAt:`2026-07-25T08:00:00Z`,updatedAt:`2026-07-25T08:00:00Z`},{id:D(`cmt_story_resolved`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:d(A),textSnippet:`implementation decision`,charRange:{start:0,end:14}},body:`描画経路の統合方針を反映済み。`,status:`resolved`,createdAt:`2026-07-24T08:00:00Z`,updatedAt:`2026-07-24T09:00:00Z`}],ge={component:le,parameters:{layout:`fullscreen`,viewport:{options:Object.fromEntries([1200,1199,900,899,761,760].map(e=>[`width-`+e,{name:e+`px`,styles:{width:e+`px`,height:`800px`}}]))}},decorators:[e=>(0,v.jsx)(`div`,{style:{height:`100vh`},children:(0,v.jsx)(e,{})})],argTypes:{pathbar:{control:!1},toolbar:{control:!1},sidebar:{control:!1},tabs:{control:!1},viewer:{control:!1},comments:{control:!1}}},L=g({treeState:M,documentState:N,selectedSpec:k,selectedFileKey:`impl`,workspaceInput:w,workspaceStatusPath:w}),R={name:`Specs`,args:L,play:async({canvasElement:e})=>{await fe(e),await de(e)}},z={args:{...L,leftWidth:420,commentsWidth:560}},B={args:{...L,leftOpen:!1,commentsOpen:!1}},V={args:L,parameters:{viewport:{defaultViewport:`width-1200`}}},H={args:L,parameters:{viewport:{defaultViewport:`width-1199`}}},U={args:L,parameters:{viewport:{defaultViewport:`width-900`}}},W={args:L,parameters:{viewport:{defaultViewport:`width-899`}}},G={args:L,parameters:{viewport:{defaultViewport:`width-761`}}},K={args:L,parameters:{viewport:{defaultViewport:`width-760`}},play:async({canvasElement:e})=>{let t=C(e);await x.click(t.getByRole(`button`,{name:`仕様一覧を閉じる`}));let n=e.querySelector(`.app-shell__comments-close`);await y(n).toBeVisible(),await x.click(n),await x.click(t.getByRole(`tab`,{name:`Specs`})),await x.click(t.getByRole(`region`,{name:`Spec document`})),await x.click(t.getByRole(`button`,{name:`サイドバーを開く`}))}},q={args:g({treeState:M,documentState:N,selectedSpec:k,selectedFileKey:`impl`,workspaceInput:w,workspaceStatusPath:w,viewMode:`diff`})},J={args:g({treeState:P,documentState:F,selectedSpec:k,selectedFileKey:`impl`,workspaceInput:E,workspaceStatusPath:E,activeWorktreeName:T}),play:async({canvasElement:e})=>{await ue(e)}},Y={args:g({treeState:P,documentState:F,selectedSpec:k,selectedFileKey:`impl`,workspaceInput:E,workspaceStatusPath:E,activeWorktreeName:T,viewMode:`diff`}),play:async({canvasElement:e})=>{await ue(e)}},X={args:g({treeState:M,documentState:N,selectedSpec:k,selectedFileKey:`impl`,workspaceInput:w,workspaceStatusPath:w,archivingSpecId:k.id})},Z={args:g({treeState:{status:`loading`,workspacePath:w,tree:null,error:null},documentState:{status:`loading`,workspacePath:w,specId:k.id,fileKey:`impl`,document:null,error:null},selectedSpec:k,selectedFileKey:`impl`,workspaceInput:w,workspaceStatusPath:w,isWorkspaceLoading:!0})},Q={args:g({treeState:{status:`empty`,workspacePath:w,tree:{specs:[]},error:null},documentState:{status:`idle`,workspacePath:w,specId:null,fileKey:null,document:null,error:null},selectedSpec:null,selectedFileKey:null,workspaceInput:w,workspaceStatusPath:w})},$={args:g({treeState:{status:`error`,workspacePath:w,tree:null,error:{feature:`specs`,code:`specTreeScan`,message:`Spec directory could not be scanned.`,cause:{command:`list_specs`,code:`specTreeScan`,message:`Spec directory could not be scanned.`,raw:`Spec directory could not be scanned.`}}},documentState:{status:`error`,workspacePath:w,specId:k.id,fileKey:`impl`,document:null,error:{feature:`specs`,code:`markdownRead`,message:`Markdown file could not be read.`,cause:{command:`read_spec_file`,code:`markdownRead`,message:`Markdown file could not be read.`,raw:`Markdown file could not be read.`}}},selectedSpec:k,selectedFileKey:`impl`,workspaceInput:w,workspaceStatusPath:w,workspaceErrorMessage:`Workspace loaded with file warnings.`})},R.parameters={...R.parameters,docs:{...R.parameters?.docs,source:{originalSource:`{
  name: "Specs",
  args: readySpecsArgs,
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