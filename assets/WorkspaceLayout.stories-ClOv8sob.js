import{a as e,n as t}from"./chunk-DnJy8xQt.js";import{n}from"./iframe-WYdaAhna.js";import{t as r}from"./CommentSidebar-C-jXCRGu.js";import{r as ee,t as i}from"./preferences-IvowJ50s.js";import{t as a}from"./jsx-runtime-BpX3lQ6F.js";import{t as o}from"./MarkdownViewer-1nyYGvYu.js";import{a as s,n as c,t as l}from"./commentId-D2JE7cv5.js";import{t as te}from"./SpecTabs-C37Nj2CT.js";import{r as ne}from"./specTreeState-D-Bba_TI.js";import{c as u,o as d,s as re,t as f}from"./workspace-CVh3SvDL.js";import{t as p}from"./comments-35NjZ88G.js";import{t as ie}from"./DiffWorkspace-8iik4KO2.js";import{t as ae}from"./ViewModeToolbar-COgNNjUw.js";import{n as m,t as h}from"./WorkspaceLayout-BGm_3vK0.js";import{t as oe}from"./WorkspaceSidebarSection-BULMIStB.js";import{t as se}from"./WorkspaceToolbar-DGF8_Tzo.js";import{t as ce}from"./WorktreeTree-DlyQE4kJ.js";function le(e){let{pathbar:t,toolbar:n,leftHeader:r,sidebar:ee,tabs:i,viewer:a,comments:o,leftOpen:s,leftWidth:c,leftMinWidth:l,leftMaxWidth:te,onOpenLeft:ne,onCloseLeft:u,onLeftWidthChange:d,commentsOpen:re,commentsWidth:f,commentsMinWidth:p,commentsMaxWidth:ie,onOpenComments:ae,onCloseComments:m,onCommentsWidthChange:oe}=e,[se,ce]=(0,y.useState)(s??!0),[le,g]=(0,y.useState)(c??240),[ue,_]=(0,y.useState)(re??!0),[v,de]=(0,y.useState)(f??300);return(0,b.jsxs)(h.Root,{worktrees:{isOpen:se,width:le,minWidth:l,maxWidth:te,onOpen:()=>{ce(!0),ne?.()},onClose:()=>{ce(!1),u?.()},onWidthChange:e=>{g(e),d?.(e)}},comments:{isOpen:ue,width:v,minWidth:p,maxWidth:ie,onOpen:()=>{_(!0),ae?.()},onClose:()=>{_(!1),m?.()},onWidthChange:e=>{de(e),oe?.(e)}},children:[(0,b.jsx)(h.Pathbar,{children:t}),(0,b.jsx)(h.Toolbar,{children:n}),(0,b.jsx)(h.Worktrees,{header:r,children:ee}),(0,b.jsx)(h.ModeNavigation,{children:i}),(0,b.jsx)(h.Content,{children:a}),(0,b.jsx)(h.Comments,{children:o})]})}async function g(e){let t=T(e);await x(t.getByRole(`textbox`,{name:`PATH`})).toHaveValue(O),await x(t.getByRole(`treeitem`,{name:new RegExp(D)})).toHaveAttribute(`aria-current`,`page`),await x(t.getByRole(`button`,{name:`${D}を開く`})).toHaveAttribute(`aria-current`,`location`)}async function ue(e){let t=T(e),n=t.getByRole(`treeitem`,{name:/root/}),r=t.getByRole(`tab`,{name:`Specs`}),ee=t.getByRole(`tab`,{name:`Diff`}),i=t.getAllByRole(`separator`),a=e.querySelector(`.app-shell__toolbar`),o=e.querySelector(`.app-shell__toolbar-content`);await x(getComputedStyle(a).overflowX).toBe(`hidden`),await x(getComputedStyle(o).gridColumnStart).toBe(`2`),await x(o.clientWidth).toBe(a.clientWidth),await x(n).toHaveAttribute(`aria-current`,`page`),await x(r).toHaveAttribute(`aria-selected`,`true`),await x(i).toHaveLength(3);for(let e of i)await x(e).toHaveAttribute(`aria-valuenow`);await C.click(r),await C.keyboard(`{ArrowRight}`),await x(ee).toHaveFocus(),await C.click(t.getByRole(`button`,{name:`仕様一覧を閉じる`}));let s=t.getByRole(`button`,{name:`仕様一覧を開く`});await w(async()=>{await x(s).toHaveFocus()}),await C.click(s),await w(async()=>{await x(t.getByRole(`button`,{name:`仕様一覧を閉じる`})).toHaveFocus()});let c=e.querySelector(`.app-shell__comments-close`);await x(c).toBeVisible(),await C.click(c);let l=t.getByRole(`button`,{name:`サイドバーを開く`});await w(async()=>{await x(l).toHaveFocus()}),await C.click(l),await w(async()=>{await x(c).toHaveFocus()})}async function _(e){let t=e.querySelector(`.app-shell__mode-navigation .spec-tree__list`);await x(t).toBeInstanceOf(HTMLElement);let n=t;await x(n.scrollWidth).toBeLessThanOrEqual(n.clientWidth)}function v({treeState:e,documentState:t,selectedSpec:n,selectedFileKey:i,workspaceInput:a,workspaceStatusPath:s,workspaceErrorMessage:c=void 0,isWorkspaceLoading:l=!1,archivingSpecId:u=null,viewMode:d=`specs`,activeWorktreeName:f=null}){let p=n?.files.find(e=>e.key===i)??null,m;m=d===`diff`?(0,b.jsx)(ie,{selectedPath:null,preview:null,availability:{status:`ready`}}):(0,b.jsxs)(`section`,{className:`specs-workspace__document`,"aria-label":`Spec document`,children:[(0,b.jsx)(te,{spec:n,selectedFileKey:i,onSelectFile:S()}),(0,b.jsx)(`div`,{className:`specs-workspace__viewer`,children:(0,b.jsx)(o,{state:t,selectedSpecLabel:n?.label??null,selectedFileLabel:p?.label??null,comments:I,activeCommentId:k(`cmt_story_open_1`),onReload:S(),onSelectComment:S()})})]});let h=f===null?{path:`/workspace/plugin-manager`,displayName:`plugin-manager`,kind:`plugin-worktree`,lastOpenedAt:`2026-05-05T00:00:00.000Z`}:{path:s??O,displayName:f,kind:`plugin-worktree`,lastOpenedAt:`2026-05-05T00:00:00.000Z`};return{leftOpen:!0,leftHeader:null,pathbar:(0,b.jsx)(ee,{children:(0,b.jsx)(se,{workspacePath:s,inputValue:a,isLoading:l,isBrowsing:!1,errorMessage:c??null,canRefresh:n!==null&&i!==null,onInputChange:S(),onBrowse:S(),onLoad:S(),onRefresh:S(),onReset:S()})}),toolbar:(0,b.jsx)(ae,{mode:d,activeItemLabel:n!==null&&p!==null?n.label+` / `+p.fileName:`ファイル未選択`,onModeChange:S()}),sidebar:(0,b.jsxs)(`div`,{className:`left-navigation-panel`,children:[(0,b.jsx)(oe,{currentWorkspacePath:s,isOpen:!0,isBusy:l,recentWorkspaces:[{path:`/workspace/spec-board`,displayName:`spec-board`,kind:`plugin-workspace`,lastOpenedAt:`2026-05-07T00:00:00.000Z`},{path:E,displayName:`pdfmod`,kind:`plugin-workspace`,lastOpenedAt:`2026-05-06T00:00:00.000Z`},h],onBrowse:S(),onToggleOpen:S(),onOpenWorkspace:S(),onRemoveWorkspace:S()}),(0,b.jsx)(de,{activeWorktreeName:f})]}),tabs:d===`specs`?(0,b.jsx)(ne,{state:e,selectedSpecId:n?.id??null,archivingSpecId:u,isLoading:u!==null,onSelectSpec:S(),onArchiveSpec:S(),onReload:S()}):(0,b.jsx)(re,{items:[],selectedId:null,availability:{status:`unavailable`,reason:`data-source-not-connected`},onSelect:S()}),viewer:m,comments:(0,b.jsx)(r,{listState:{status:`ready`,comments:I,error:null},operationState:{status:`idle`,operation:null,commentId:null,error:null},activeCommentId:k(`cmt_story_open_1`),onSelectComment:S(),onResolveComment:S(),onReopenComment:S(),onDeleteComment:S(),onUpdateComment:S(),onReload:S()})}}function de({activeWorktreeName:e}){let t=e??`root`;return(0,b.jsxs)(`section`,{className:`story-worktree-tree`,"aria-label":`Worktrees`,children:[(0,b.jsx)(`input`,{"aria-label":`Filter worktrees`,placeholder:`Filter worktrees...`}),(0,b.jsxs)(`div`,{className:`story-worktree-tree__header`,children:[(0,b.jsxs)(`span`,{children:[`ROOT / WORKTREES `,A.length]}),(0,b.jsx)(`span`,{"aria-hidden":`true`,children:`↻`})]}),(0,b.jsx)(ce,{nodes:A.map(e=>({kind:`worktree`,id:e.name,label:e.icon+` `+e.name,count:{kind:`changed-file-count`,value:e.changeCount}})),selectedWorktreeId:t,emptyLabel:`Worktree はありません`,onSelectWorktree:S()})]})}var y,b,x,S,C,w,T,E,D,O,k,A,j,fe,M,pe,me,N,P,he,F,I,ge,L,R,z,B,V,H,U,W,G,K,q,J,Y,X,Z,Q,$,_e;t((()=>{y=e(n(),1),p(),c(),d(),i(),u(),f(),m(),b=a(),{expect:x,fn:S,userEvent:C,waitFor:w,within:T}=__STORYBOOK_MODULE_TEST__,E=`/workspace/pdfmod`,D=`agent-a1b3ff42`,O=`/workspace/pdfmod/.worktrees/${D}`,k=l.fromString,A=[{name:`root`,icon:`⌂`,changeCount:0},{name:`549`,icon:`▣`,changeCount:2},{name:D,icon:`⑂`,changeCount:4},{name:`agent-a049b1c8`,icon:`⑂`,changeCount:0},{name:`agent-a395fbe1`,icon:`⑂`,changeCount:1},{name:`agent-a5b8a0d3`,icon:`⑂`,changeCount:2},{name:`agent-a65ad1a4`,icon:`⑂`,changeCount:7},{name:`archive`,icon:`▱`,changeCount:12,isMuted:!0}],j={id:`041-preview-task`,label:`041-preview-task`,kind:`spec`,sourceGroupId:`primary`,relativeId:`041-preview-task`,presentDocumentCount:3,descendantSpecCount:0,files:[{key:`exploration`,label:`exploration.md`,fileName:`exploration.md`,status:`present`},{key:`hearing`,label:`hearing.md`,fileName:`hearing.md`,status:`present`},{key:`impl`,label:`impl.md`,fileName:`impl.md`,status:`present`},{key:`tasks`,label:`tasks.md`,fileName:`tasks.md`,status:`missing`}],children:[]},fe={specs:[{id:`040-delete-task-flow`,label:`040-delete-task-flow`,kind:`spec`,sourceGroupId:`primary`,relativeId:`040-delete-task-flow`,presentDocumentCount:3,descendantSpecCount:0,files:j.files,children:[]},j,{id:`042-cache-invalidation`,label:`042-cache-invalidation`,kind:`spec`,sourceGroupId:`primary`,relativeId:`042-cache-invalidation`,presentDocumentCount:3,descendantSpecCount:0,files:j.files.slice(0,3),children:[]},{id:`primary/.archive`,label:`Archive`,kind:`archive`,sourceGroupId:`primary`,relativeId:`.archive`,presentDocumentCount:0,descendantSpecCount:1,files:[],children:[{id:`primary/.archive/039-legacy-preview`,label:`039-legacy-preview`,kind:`spec`,sourceGroupId:`primary`,relativeId:`.archive/039-legacy-preview`,presentDocumentCount:3,descendantSpecCount:0,files:j.files,children:[]}]},{id:`secondary`,label:`agent-a1b3ff42 (.plugin-worktree)`,kind:`sourceGroup`,sourceGroupId:`secondary`,relativeId:`.`,presentDocumentCount:0,descendantSpecCount:1,files:[],children:[{...j,id:`secondary/041-preview-task`,sourceGroupId:`secondary`,relativeId:`041-preview-task`}]}]},M=`Implementation`,pe=[{blockType:`heading`,blockIndex:0,textHash:s(`Implementation`),textSnippet:`Implementation`,sourceRange:null},{blockType:`paragraph`,blockIndex:1,textHash:s(`041-preview-task · impl`),textSnippet:`041-preview-task · impl`,sourceRange:null},{blockType:`paragraph`,blockIndex:2,textHash:s(`タスクプレビューの実装方針を、既存の QuickView 相当機能との統合方針を含めて決める。認証と描画性能の 2 軸で判断する。`),textSnippet:`タスクプレビューの実装方針を、既存の QuickView 相当機能との統合方針を含めて決める。認証と描画性能の 2 軸で判断する。`,sourceRange:null},{blockType:`heading`,blockIndex:3,textHash:s(`現状の課題`),textSnippet:`現状の課題`,sourceRange:null},{blockType:`list_item`,blockIndex:4,textHash:s(`プレビュー起動フローが複数入口に散らばっている`),textSnippet:`プレビュー起動フローが複数入口に散らばっている`,sourceRange:null},{blockType:`list_item`,blockIndex:5,textHash:s(`大きなタスクを開いたときの描画コストが線形に増える`),textSnippet:`大きなタスクを開いたときの描画コストが線形に増える`,sourceRange:null},{blockType:`list_item`,blockIndex:6,textHash:s(`権限のないタスクを掴んだときのエラーハンドリングが弱い`),textSnippet:`権限のないタスクを掴んだときのエラーハンドリングが弱い`,sourceRange:null},{blockType:`heading`,blockIndex:7,textHash:s(`検討した選択肢`),textSnippet:`検討した選択肢`,sourceRange:null},{blockType:`table`,blockIndex:8,textHash:s(`OPTION VERDICT A 既存 QuickView をそのままタスクにも流用 rejected B QuickView をラップした TaskPreview を新規に薄く作る accepted C プレビュー基盤ごと書き直す deferred`),textSnippet:`OPTION VERDICT A 既存 QuickView をそのままタスクにも流用 rejected B QuickView をラップした TaskPreview を新規に薄く作る accepted C プレビュー基盤ごと書き直す deferred`,sourceRange:null},{blockType:`heading`,blockIndex:9,textHash:s(`決定事項`),textSnippet:`決定事項`,sourceRange:null},{blockType:`paragraph`,blockIndex:10,textHash:s(`選択肢 B を採用する。既存の QuickView をラップした TaskPreview を薄く作り、タスク固有の権限チェックと空状態のみを新規実装する。描画は既存パスに委譲。`),textSnippet:`選択肢 B を採用する。既存の QuickView をラップした TaskPreview を薄く作り、タスク固有の権限チェックと空状態のみを新規実装する。描画は既存パスに委譲。`,sourceRange:null}],me={key:`impl`,path:`${E}/.plugin-workspace/.specs/041-preview-task/impl.md`,contents:[`# Implementation`,``,"`041-preview-task · impl`",``,"タスクプレビューの実装方針を、既存の `QuickView` 相当機能との統合方針を含めて決める。認証と描画性能の 2 軸で判断する。",``,`## 現状の課題`,``,`- プレビュー起動フローが複数入口に散らばっている`,`- 大きなタスクを開いたときの描画コストが線形に増える`,`- 権限のないタスクを掴んだときのエラーハンドリングが弱い`,``,`## 検討した選択肢`,``,`| OPTION | | VERDICT |`,`| --- | --- | --- |`,`| A | 既存 QuickView をそのままタスクにも流用 | rejected |`,`| B | **QuickView をラップした TaskPreview を新規に薄く作る** | accepted |`,`| C | プレビュー基盤ごと書き直す | deferred |`,``,`## 決定事項`,``,"選択肢 B を採用する。既存の QuickView をラップした `TaskPreview` を薄く作り、タスク固有の権限チェックと空状態のみを新規実装する。描画は既存パスに委譲。"].join(`
`),missing:!1,blocks:pe},N={status:`ready`,workspacePath:E,tree:fe,error:null},P={status:`ready`,workspacePath:E,specId:j.id,fileKey:`impl`,document:me,error:null},he={...N,workspacePath:O},F={...P,workspacePath:O,document:{...me,path:`${O}/.plugin-workspace/.specs/041-preview-task/impl.md`}},I=[{id:k(`cmt_story_open_1`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:s(M),textSnippet:`scorer.ts L16 · calcFu`,charRange:{start:0,end:14}},body:`ctx が undefined のとき落ちる。null チェックいる?`,status:`open`,createdAt:`2026-07-25T12:00:00Z`,updatedAt:`2026-07-25T12:00:00Z`},{id:k(`cmt_story_open_2`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:s(M),textSnippet:`pinfu.ts L10 · checkAllRuns`,charRange:{start:0,end:14}},body:`agent-a5b8a0d3 は shapes を Map で持ってた。どっちが速いか計測したい`,status:`open`,createdAt:`2026-07-25T10:00:00Z`,updatedAt:`2026-07-25T10:00:00Z`},{id:k(`cmt_story_open_3`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:s(M),textSnippet:`scorer.ts L14 · score()`,charRange:{start:0,end:14}},body:`戻り値の Result 型、hands/*.ts と重複してるフィールドあり`,status:`open`,createdAt:`2026-07-25T08:00:00Z`,updatedAt:`2026-07-25T08:00:00Z`},{id:k(`cmt_story_resolved`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:s(M),textSnippet:`implementation decision`,charRange:{start:0,end:14}},body:`描画経路の統合方針を反映済み。`,status:`resolved`,createdAt:`2026-07-24T08:00:00Z`,updatedAt:`2026-07-24T09:00:00Z`}],ge={component:le,parameters:{layout:`fullscreen`,viewport:{options:Object.fromEntries([1200,1199,900,899,761,760].map(e=>[`width-`+e,{name:e+`px`,styles:{width:e+`px`,height:`800px`}}]))}},decorators:[e=>(0,b.jsx)(`div`,{style:{height:`100vh`},children:(0,b.jsx)(e,{})})],argTypes:{pathbar:{control:!1},toolbar:{control:!1},sidebar:{control:!1},tabs:{control:!1},viewer:{control:!1},comments:{control:!1}}},L=v({treeState:N,documentState:P,selectedSpec:j,selectedFileKey:`impl`,workspaceInput:E,workspaceStatusPath:E}),R={name:`Specs`,args:L,play:async({canvasElement:e})=>{await _(e),await ue(e)}},z={args:{...L,leftWidth:420,commentsWidth:560}},B={args:{...L,leftOpen:!1,commentsOpen:!1}},V={args:L,parameters:{viewport:{defaultViewport:`width-1200`}}},H={args:L,parameters:{viewport:{defaultViewport:`width-1199`}}},U={args:L,parameters:{viewport:{defaultViewport:`width-900`}}},W={args:L,parameters:{viewport:{defaultViewport:`width-899`}}},G={args:L,parameters:{viewport:{defaultViewport:`width-761`}}},K={args:L,parameters:{viewport:{defaultViewport:`width-760`}},play:async({canvasElement:e})=>{let t=T(e);await C.click(t.getByRole(`button`,{name:`仕様一覧を閉じる`}));let n=e.querySelector(`.app-shell__comments-close`);await x(n).toBeVisible(),await C.click(n),await C.click(t.getByRole(`tab`,{name:`Specs`})),await C.click(t.getByRole(`region`,{name:`Spec document`})),await C.click(t.getByRole(`button`,{name:`サイドバーを開く`}))}},q={args:v({treeState:N,documentState:P,selectedSpec:j,selectedFileKey:`impl`,workspaceInput:E,workspaceStatusPath:E,viewMode:`diff`})},J={args:v({treeState:he,documentState:F,selectedSpec:j,selectedFileKey:`impl`,workspaceInput:O,workspaceStatusPath:O,activeWorktreeName:D}),play:async({canvasElement:e})=>{await g(e)}},Y={args:v({treeState:he,documentState:F,selectedSpec:j,selectedFileKey:`impl`,workspaceInput:O,workspaceStatusPath:O,activeWorktreeName:D,viewMode:`diff`}),play:async({canvasElement:e})=>{await g(e)}},X={args:v({treeState:N,documentState:P,selectedSpec:j,selectedFileKey:`impl`,workspaceInput:E,workspaceStatusPath:E,archivingSpecId:j.id})},Z={args:v({treeState:{status:`loading`,workspacePath:E,tree:null,error:null},documentState:{status:`loading`,workspacePath:E,specId:j.id,fileKey:`impl`,document:null,error:null},selectedSpec:j,selectedFileKey:`impl`,workspaceInput:E,workspaceStatusPath:E,isWorkspaceLoading:!0})},Q={args:v({treeState:{status:`empty`,workspacePath:E,tree:{specs:[]},error:null},documentState:{status:`idle`,workspacePath:E,specId:null,fileKey:null,document:null,error:null},selectedSpec:null,selectedFileKey:null,workspaceInput:E,workspaceStatusPath:E})},$={args:v({treeState:{status:`error`,workspacePath:E,tree:null,error:{feature:`specs`,code:`specTreeScan`,message:`Spec directory could not be scanned.`,cause:{command:`list_specs`,code:`specTreeScan`,message:`Spec directory could not be scanned.`,raw:`Spec directory could not be scanned.`}}},documentState:{status:`error`,workspacePath:E,specId:j.id,fileKey:`impl`,document:null,error:{feature:`specs`,code:`markdownRead`,message:`Markdown file could not be read.`,cause:{command:`read_spec_file`,code:`markdownRead`,message:`Markdown file could not be read.`,raw:`Markdown file could not be read.`}}},selectedSpec:j,selectedFileKey:`impl`,workspaceInput:E,workspaceStatusPath:E,workspaceErrorMessage:`Workspace loaded with file warnings.`})},R.parameters={...R.parameters,docs:{...R.parameters?.docs,source:{originalSource:`{
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