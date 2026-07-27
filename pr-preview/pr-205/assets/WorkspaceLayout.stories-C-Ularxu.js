import{a as e,n as t}from"./chunk-DnJy8xQt.js";import{n}from"./iframe-BxoCWwEq.js";import{t as r}from"./CommentSidebar-CWEuDoAN.js";import{r as ee,t as i}from"./preferences-B6N3y9vH.js";import{t as a}from"./jsx-runtime-BpX3lQ6F.js";import{t as o}from"./MarkdownViewer-CQjb4KeJ.js";import{a as s,n as te,t as c}from"./commentId-D2JE7cv5.js";import{t as ne}from"./SpecTabs-BXszwsFg.js";import{s as re}from"./specTreeState-BDtD4mWx.js";import{c as l,o as u,s as ie,t as d}from"./workspace-DXUMoMBs.js";import{t as f}from"./comments-BfjBRkoJ.js";import{t as ae}from"./DiffWorkspace-8iik4KO2.js";import{t as oe}from"./ViewModeToolbar-CPt1wUPK.js";import{n as p,t as m}from"./WorkspaceLayout-DsA0wUrv.js";import{t as se}from"./WorkspaceSidebarSection-BvwjsHzt.js";import{t as h}from"./WorkspaceToolbar-Ca8GPr_P.js";import{t as ce}from"./WorktreeTree-C-iqWtsK.js";function le(e){let{toolbar:t,leftHeader:n,sidebar:r,tabs:ee,viewer:i,comments:a,leftOpen:o,leftWidth:s,leftMinWidth:te,leftMaxWidth:c,onOpenLeft:ne,onCloseLeft:re,onLeftWidthChange:l,commentsOpen:u,commentsWidth:ie,commentsMinWidth:d,commentsMaxWidth:f,onOpenComments:ae,onCloseComments:oe,onCommentsWidthChange:p}=e,[se,h]=(0,y.useState)(o??!0),[ce,le]=(0,y.useState)(s??240),[g,_]=(0,y.useState)(u??!0),[ue,v]=(0,y.useState)(ie??300);return(0,b.jsxs)(m.Root,{worktrees:{isOpen:se,width:ce,minWidth:te,maxWidth:c,onOpen:()=>{h(!0),ne?.()},onClose:()=>{h(!1),re?.()},onWidthChange:e=>{le(e),l?.(e)}},comments:{isOpen:g,width:ue,minWidth:d,maxWidth:f,onOpen:()=>{_(!0),ae?.()},onClose:()=>{_(!1),oe?.()},onWidthChange:e=>{v(e),p?.(e)}},children:[(0,b.jsx)(m.Toolbar,{children:t}),(0,b.jsx)(m.Worktrees,{header:n,children:r}),(0,b.jsx)(m.ModeNavigation,{children:ee}),(0,b.jsx)(m.Content,{children:i}),(0,b.jsx)(m.Comments,{children:a})]})}async function g(e){let t=w(e);await x(t.getByRole(`textbox`,{name:`PATH`})).toHaveValue(D),await x(t.getByRole(`treeitem`,{name:new RegExp(E)})).toHaveAttribute(`aria-current`,`page`),await x(t.getByRole(`button`,{name:`${E}を開く`})).toHaveAttribute(`aria-current`,`location`)}async function _(e){let t=w(e),n=t.getByRole(`treeitem`,{name:/root/}),r=t.getByRole(`tab`,{name:`Specs`}),ee=t.getByRole(`tab`,{name:`Diff`}),i=t.getAllByRole(`separator`);await x(n).toHaveAttribute(`aria-current`,`page`),await x(r).toHaveAttribute(`aria-selected`,`true`),await x(i).toHaveLength(3);for(let e of i)await x(e).toHaveAttribute(`aria-valuenow`);await C.click(r),await C.keyboard(`{ArrowRight}`),await x(ee).toHaveFocus(),await C.click(t.getByRole(`button`,{name:`仕様一覧を閉じる`}));let a=t.getByRole(`button`,{name:`仕様一覧を開く`});await x(a).toHaveFocus(),await C.click(a),await x(t.getByRole(`button`,{name:`仕様一覧を閉じる`})).toHaveFocus();let o=e.querySelector(`.app-shell__comments-close`);await x(o).toBeInstanceOf(HTMLButtonElement),await C.click(o);let s=t.getByRole(`button`,{name:`サイドバーを開く`});await x(s).toHaveFocus(),await C.click(s)}async function ue(e){let t=e.querySelector(`.app-shell__mode-navigation .spec-tree__list`);await x(t).toBeInstanceOf(HTMLElement);let n=t;await x(n.scrollWidth).toBeLessThanOrEqual(n.clientWidth)}function v({treeState:e,documentState:t,selectedSpec:n,selectedFileKey:i,workspaceInput:a,workspaceStatusPath:s,workspaceErrorMessage:te=void 0,isWorkspaceLoading:c=!1,archivingSpecId:l=null,viewMode:u=`specs`,activeWorktreeName:d=null}){let f=n?.files.find(e=>e.key===i)??null,p;p=u===`diff`?(0,b.jsx)(ae,{selectedPath:null,preview:null,availability:{status:`ready`}}):(0,b.jsxs)(`section`,{className:`specs-workspace__document`,"aria-label":`Spec document`,children:[(0,b.jsx)(ne,{spec:n,selectedFileKey:i,onSelectFile:S()}),(0,b.jsx)(`div`,{className:`specs-workspace__viewer`,children:(0,b.jsx)(o,{state:t,selectedSpecLabel:n?.label??null,selectedFileLabel:f?.label??null,comments:I,activeCommentId:O(`cmt_story_open_1`),onReload:S(),onSelectComment:S()})})]});let m=d===null?{path:`/workspace/plugin-manager`,displayName:`plugin-manager`,kind:`plugin-worktree`,lastOpenedAt:`2026-05-05T00:00:00.000Z`}:{path:s??D,displayName:d,kind:`plugin-worktree`,lastOpenedAt:`2026-05-05T00:00:00.000Z`};return{leftOpen:!0,leftHeader:null,toolbar:(0,b.jsxs)(b.Fragment,{children:[(0,b.jsx)(ee,{children:(0,b.jsx)(h,{workspacePath:s,inputValue:a,isLoading:c,isBrowsing:!1,errorMessage:te??null,canRefresh:n!==null&&i!==null,onInputChange:S(),onBrowse:S(),onLoad:S(),onRefresh:S(),onReset:S()})}),(0,b.jsx)(oe,{mode:u,activeItemLabel:n!==null&&f!==null?n.label+` / `+f.fileName:`ファイル未選択`,onModeChange:S()})]}),sidebar:(0,b.jsxs)(`div`,{className:`left-navigation-panel`,children:[(0,b.jsx)(se,{currentWorkspacePath:s,isOpen:!0,isBusy:c,recentWorkspaces:[{path:`/workspace/spec-board`,displayName:`spec-board`,kind:`plugin-workspace`,lastOpenedAt:`2026-05-07T00:00:00.000Z`},{path:T,displayName:`pdfmod`,kind:`plugin-workspace`,lastOpenedAt:`2026-05-06T00:00:00.000Z`},m],onBrowse:S(),onToggleOpen:S(),onOpenWorkspace:S(),onRemoveWorkspace:S()}),(0,b.jsx)(de,{activeWorktreeName:d})]}),tabs:u===`specs`?(0,b.jsx)(re,{state:e,selectedSpecId:n?.id??null,archivingSpecId:l,isLoading:l!==null,onSelectSpec:S(),onArchiveSpec:S(),onReload:S()}):(0,b.jsx)(ie,{items:[],selectedId:null,availability:{status:`unavailable`,reason:`data-source-not-connected`},onSelect:S()}),viewer:p,comments:(0,b.jsx)(r,{listState:{status:`ready`,comments:I,error:null},operationState:{status:`idle`,operation:null,commentId:null,error:null},activeCommentId:O(`cmt_story_open_1`),onSelectComment:S(),onResolveComment:S(),onReopenComment:S(),onDeleteComment:S(),onUpdateComment:S(),onReload:S()})}}function de({activeWorktreeName:e}){let t=e??`root`;return(0,b.jsxs)(`section`,{className:`story-worktree-tree`,"aria-label":`Worktrees`,children:[(0,b.jsx)(`input`,{"aria-label":`Filter worktrees`,placeholder:`Filter worktrees...`}),(0,b.jsxs)(`div`,{className:`story-worktree-tree__header`,children:[(0,b.jsxs)(`span`,{children:[`ROOT / WORKTREES `,fe.length]}),(0,b.jsx)(`span`,{"aria-hidden":`true`,children:`↻`})]}),(0,b.jsx)(ce,{nodes:fe.map(e=>({kind:`worktree`,id:e.name,label:e.icon+` `+e.name,count:{kind:`changed-file-count`,value:e.changeCount}})),selectedWorktreeId:t,emptyLabel:`Worktree はありません`,onSelectWorktree:S()})]})}var y,b,x,S,C,w,T,E,D,O,fe,k,pe,A,me,j,M,N,P,F,I,he,L,R,z,B,V,H,U,W,G,K,q,J,Y,X,Z,Q,$,ge;t((()=>{y=e(n(),1),f(),te(),u(),i(),l(),d(),p(),b=a(),{expect:x,fn:S,userEvent:C,within:w}=__STORYBOOK_MODULE_TEST__,T=`/workspace/pdfmod`,E=`agent-a1b3ff42`,D=`/workspace/pdfmod/.worktrees/${E}`,O=c.fromString,fe=[{name:`root`,icon:`⌂`,changeCount:0},{name:`549`,icon:`▣`,changeCount:2},{name:E,icon:`⑂`,changeCount:4},{name:`agent-a049b1c8`,icon:`⑂`,changeCount:0},{name:`agent-a395fbe1`,icon:`⑂`,changeCount:1},{name:`agent-a5b8a0d3`,icon:`⑂`,changeCount:2},{name:`agent-a65ad1a4`,icon:`⑂`,changeCount:7},{name:`archive`,icon:`▱`,changeCount:12,isMuted:!0}],k={id:`041-preview-task`,label:`041-preview-task`,files:[{key:`exploration`,label:`exploration.md`,fileName:`exploration.md`,status:`present`},{key:`hearing`,label:`hearing.md`,fileName:`hearing.md`,status:`present`},{key:`impl`,label:`impl.md`,fileName:`impl.md`,status:`present`},{key:`tasks`,label:`tasks.md`,fileName:`tasks.md`,status:`missing`}],children:[]},pe={specs:[{id:`040-delete-task-flow`,label:`040-delete-task-flow`,files:k.files,children:[]},k,{id:`042-cache-invalidation`,label:`042-cache-invalidation`,files:k.files.slice(0,3),children:[]},{id:`archive`,label:`archive`,files:[],children:[{id:`archive/039-legacy-preview`,label:`039-legacy-preview`,files:k.files,children:[]}]}]},A=`Implementation`,me=[{blockType:`heading`,blockIndex:0,textHash:s(`Implementation`),textSnippet:`Implementation`,sourceRange:null},{blockType:`paragraph`,blockIndex:1,textHash:s(`041-preview-task · impl`),textSnippet:`041-preview-task · impl`,sourceRange:null},{blockType:`paragraph`,blockIndex:2,textHash:s(`タスクプレビューの実装方針を、既存の QuickView 相当機能との統合方針を含めて決める。認証と描画性能の 2 軸で判断する。`),textSnippet:`タスクプレビューの実装方針を、既存の QuickView 相当機能との統合方針を含めて決める。認証と描画性能の 2 軸で判断する。`,sourceRange:null},{blockType:`heading`,blockIndex:3,textHash:s(`現状の課題`),textSnippet:`現状の課題`,sourceRange:null},{blockType:`list_item`,blockIndex:4,textHash:s(`プレビュー起動フローが複数入口に散らばっている`),textSnippet:`プレビュー起動フローが複数入口に散らばっている`,sourceRange:null},{blockType:`list_item`,blockIndex:5,textHash:s(`大きなタスクを開いたときの描画コストが線形に増える`),textSnippet:`大きなタスクを開いたときの描画コストが線形に増える`,sourceRange:null},{blockType:`list_item`,blockIndex:6,textHash:s(`権限のないタスクを掴んだときのエラーハンドリングが弱い`),textSnippet:`権限のないタスクを掴んだときのエラーハンドリングが弱い`,sourceRange:null},{blockType:`heading`,blockIndex:7,textHash:s(`検討した選択肢`),textSnippet:`検討した選択肢`,sourceRange:null},{blockType:`table`,blockIndex:8,textHash:s(`OPTION VERDICT A 既存 QuickView をそのままタスクにも流用 rejected B QuickView をラップした TaskPreview を新規に薄く作る accepted C プレビュー基盤ごと書き直す deferred`),textSnippet:`OPTION VERDICT A 既存 QuickView をそのままタスクにも流用 rejected B QuickView をラップした TaskPreview を新規に薄く作る accepted C プレビュー基盤ごと書き直す deferred`,sourceRange:null},{blockType:`heading`,blockIndex:9,textHash:s(`決定事項`),textSnippet:`決定事項`,sourceRange:null},{blockType:`paragraph`,blockIndex:10,textHash:s(`選択肢 B を採用する。既存の QuickView をラップした TaskPreview を薄く作り、タスク固有の権限チェックと空状態のみを新規実装する。描画は既存パスに委譲。`),textSnippet:`選択肢 B を採用する。既存の QuickView をラップした TaskPreview を薄く作り、タスク固有の権限チェックと空状態のみを新規実装する。描画は既存パスに委譲。`,sourceRange:null}],j={key:`impl`,path:`${T}/.plugin-workspace/.specs/041-preview-task/impl.md`,contents:[`# Implementation`,``,"`041-preview-task · impl`",``,"タスクプレビューの実装方針を、既存の `QuickView` 相当機能との統合方針を含めて決める。認証と描画性能の 2 軸で判断する。",``,`## 現状の課題`,``,`- プレビュー起動フローが複数入口に散らばっている`,`- 大きなタスクを開いたときの描画コストが線形に増える`,`- 権限のないタスクを掴んだときのエラーハンドリングが弱い`,``,`## 検討した選択肢`,``,`| OPTION | | VERDICT |`,`| --- | --- | --- |`,`| A | 既存 QuickView をそのままタスクにも流用 | rejected |`,`| B | **QuickView をラップした TaskPreview を新規に薄く作る** | accepted |`,`| C | プレビュー基盤ごと書き直す | deferred |`,``,`## 決定事項`,``,"選択肢 B を採用する。既存の QuickView をラップした `TaskPreview` を薄く作り、タスク固有の権限チェックと空状態のみを新規実装する。描画は既存パスに委譲。"].join(`
`),missing:!1,blocks:me},M={status:`ready`,workspacePath:T,tree:pe,error:null},N={status:`ready`,workspacePath:T,specId:k.id,fileKey:`impl`,document:j,error:null},P={...M,workspacePath:D},F={...N,workspacePath:D,document:{...j,path:`${D}/.plugin-workspace/.specs/041-preview-task/impl.md`}},I=[{id:O(`cmt_story_open_1`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:s(A),textSnippet:`scorer.ts L16 · calcFu`,charRange:{start:0,end:14}},body:`ctx が undefined のとき落ちる。null チェックいる?`,status:`open`,createdAt:`2026-07-25T12:00:00Z`,updatedAt:`2026-07-25T12:00:00Z`},{id:O(`cmt_story_open_2`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:s(A),textSnippet:`pinfu.ts L10 · checkAllRuns`,charRange:{start:0,end:14}},body:`agent-a5b8a0d3 は shapes を Map で持ってた。どっちが速いか計測したい`,status:`open`,createdAt:`2026-07-25T10:00:00Z`,updatedAt:`2026-07-25T10:00:00Z`},{id:O(`cmt_story_open_3`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:s(A),textSnippet:`scorer.ts L14 · score()`,charRange:{start:0,end:14}},body:`戻り値の Result 型、hands/*.ts と重複してるフィールドあり`,status:`open`,createdAt:`2026-07-25T08:00:00Z`,updatedAt:`2026-07-25T08:00:00Z`},{id:O(`cmt_story_resolved`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:s(A),textSnippet:`implementation decision`,charRange:{start:0,end:14}},body:`描画経路の統合方針を反映済み。`,status:`resolved`,createdAt:`2026-07-24T08:00:00Z`,updatedAt:`2026-07-24T09:00:00Z`}],he={component:le,parameters:{layout:`fullscreen`,viewport:{options:Object.fromEntries([1200,1199,900,899,761,760].map(e=>[`width-`+e,{name:e+`px`,styles:{width:e+`px`,height:`800px`}}]))}},decorators:[e=>(0,b.jsx)(`div`,{style:{height:`100vh`},children:(0,b.jsx)(e,{})})],argTypes:{toolbar:{control:!1},sidebar:{control:!1},tabs:{control:!1},viewer:{control:!1},comments:{control:!1}}},L=v({treeState:M,documentState:N,selectedSpec:k,selectedFileKey:`impl`,workspaceInput:T,workspaceStatusPath:T}),R={name:`Specs`,args:L,play:async({canvasElement:e})=>{await ue(e),await _(e)}},z={args:{...L,leftWidth:420,commentsWidth:560}},B={args:{...L,leftOpen:!1,commentsOpen:!1}},V={args:L,parameters:{viewport:{defaultViewport:`width-1200`}}},H={args:L,parameters:{viewport:{defaultViewport:`width-1199`}}},U={args:L,parameters:{viewport:{defaultViewport:`width-900`}}},W={args:L,parameters:{viewport:{defaultViewport:`width-899`}}},G={args:L,parameters:{viewport:{defaultViewport:`width-761`}}},K={args:L,parameters:{viewport:{defaultViewport:`width-760`}},play:async({canvasElement:e})=>{let t=w(e);await C.click(t.getByRole(`button`,{name:`仕様一覧を閉じる`}));let n=e.querySelector(`.app-shell__comments-close`);await x(n).toBeInstanceOf(HTMLButtonElement),await C.click(n),await C.click(t.getByRole(`tab`,{name:`Specs`})),await C.click(t.getByRole(`region`,{name:`Spec document`})),await C.click(t.getByRole(`button`,{name:`サイドバーを開く`}))}},q={args:v({treeState:M,documentState:N,selectedSpec:k,selectedFileKey:`impl`,workspaceInput:T,workspaceStatusPath:T,viewMode:`diff`})},J={args:v({treeState:P,documentState:F,selectedSpec:k,selectedFileKey:`impl`,workspaceInput:D,workspaceStatusPath:D,activeWorktreeName:E}),play:async({canvasElement:e})=>{await g(e)}},Y={args:v({treeState:P,documentState:F,selectedSpec:k,selectedFileKey:`impl`,workspaceInput:D,workspaceStatusPath:D,activeWorktreeName:E,viewMode:`diff`}),play:async({canvasElement:e})=>{await g(e)}},X={args:v({treeState:M,documentState:N,selectedSpec:k,selectedFileKey:`impl`,workspaceInput:T,workspaceStatusPath:T,archivingSpecId:k.id})},Z={args:v({treeState:{status:`loading`,workspacePath:T,tree:null,error:null},documentState:{status:`loading`,workspacePath:T,specId:k.id,fileKey:`impl`,document:null,error:null},selectedSpec:k,selectedFileKey:`impl`,workspaceInput:T,workspaceStatusPath:T,isWorkspaceLoading:!0})},Q={args:v({treeState:{status:`empty`,workspacePath:T,tree:{specs:[]},error:null},documentState:{status:`idle`,workspacePath:T,specId:null,fileKey:null,document:null,error:null},selectedSpec:null,selectedFileKey:null,workspaceInput:T,workspaceStatusPath:T})},$={args:v({treeState:{status:`error`,workspacePath:T,tree:null,error:{feature:`specs`,code:`specTreeScan`,message:`Spec directory could not be scanned.`,cause:{command:`list_specs`,code:`specTreeScan`,message:`Spec directory could not be scanned.`,raw:`Spec directory could not be scanned.`}}},documentState:{status:`error`,workspacePath:T,specId:k.id,fileKey:`impl`,document:null,error:{feature:`specs`,code:`markdownRead`,message:`Markdown file could not be read.`,cause:{command:`read_spec_file`,code:`markdownRead`,message:`Markdown file could not be read.`,raw:`Markdown file could not be read.`}}},selectedSpec:k,selectedFileKey:`impl`,workspaceInput:T,workspaceStatusPath:T,workspaceErrorMessage:`Workspace loaded with file warnings.`})},R.parameters={...R.parameters,docs:{...R.parameters?.docs,source:{originalSource:`{
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
    await expect(closeComments).toBeInstanceOf(HTMLButtonElement);
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
}`,...$.parameters?.docs?.source}}},ge=[`Default`,`AllProps`,`EdgeCases`,`Viewport1200`,`Viewport1199`,`Viewport900`,`Viewport899`,`Viewport761`,`Viewport760`,`Diff`,`WorktreeOpen`,`WorktreeDiff`,`Archiving`,`Loading`,`Empty`,`Error`]}))();export{z as AllProps,X as Archiving,R as Default,q as Diff,B as EdgeCases,Q as Empty,$ as Error,Z as Loading,H as Viewport1199,V as Viewport1200,K as Viewport760,G as Viewport761,W as Viewport899,U as Viewport900,Y as WorktreeDiff,J as WorktreeOpen,ge as __namedExportsOrder,he as default};