import{a as e,n as t}from"./chunk-DnJy8xQt.js";import{n}from"./iframe-Bh6IYHep.js";import{t as ee}from"./CommentSidebar-DDOAGm65.js";import{r as te,t as r}from"./preferences-DpZL5xCN.js";import{t as i}from"./jsx-runtime-BpX3lQ6F.js";import{t as a}from"./MarkdownViewer-B8NcmT_9.js";import{a as o,n as s,t as c}from"./commentId-D2JE7cv5.js";import{t as l}from"./SpecTabs-qRIZpXNY.js";import{s as u}from"./specTreeState-D-AMYA9R.js";import{a as d,o as f,t as p}from"./workspace-B7YmH3v-.js";import{t as m}from"./comments-1k-ff8c-.js";import{t as h}from"./DiffWorkspace-nza2wgn2.js";import{t as g}from"./ReviewModeToolbar-BkeNbttq.js";import{n as _,t as v}from"./WorkspaceLayout-DaAG_rs7.js";import{t as ne}from"./WorkspaceSidebarSection-32ju0h7P.js";import{t as re}from"./WorkspaceToolbar-CXa7bALE.js";function y(e){let{toolbar:t,leftHeader:n,sidebar:ee,tabs:te,viewer:r,comments:i,leftOpen:a,leftWidth:o,leftMinWidth:s,leftMaxWidth:c,onOpenLeft:l,onCloseLeft:u,onLeftWidthChange:d,commentsOpen:f,commentsWidth:p,commentsMinWidth:m,commentsMaxWidth:h,onOpenComments:g,onCloseComments:_,onCommentsWidthChange:ne}=e,[re,y]=(0,w.useState)(a??!0),[b,x]=(0,w.useState)(o??240),[S,C]=(0,w.useState)(f??!0),[E,D]=(0,w.useState)(p??300);return(0,T.jsxs)(v.Root,{leftNavigation:{isOpen:re,width:b,minWidth:s,maxWidth:c,onOpen:()=>{y(!0),l?.()},onClose:()=>{y(!1),u?.()},onWidthChange:e=>{x(e),d?.(e)}},commentsSidebar:{isOpen:S,width:E,minWidth:m,maxWidth:h,onOpen:()=>{C(!0),g?.()},onClose:()=>{C(!1),_?.()},onWidthChange:e=>{D(e),ne?.(e)}},children:[(0,T.jsx)(v.Pathbar,{children:t}),(0,T.jsx)(v.LeftNavigation,{header:n,children:ee}),(0,T.jsxs)(v.Main,{children:[(0,T.jsx)(v.Tabs,{children:te}),(0,T.jsx)(v.Viewer,{children:r})]}),(0,T.jsx)(v.Comments,{children:i})]})}async function b(e){let t=ie(e);await E(t.getByRole(`textbox`,{name:`PATH`})).toHaveValue(A),await E(t.getByRole(`treeitem`,{name:new RegExp(k)})).toHaveAttribute(`aria-current`,`location`),await E(t.getByRole(`button`,{name:`${k}を開く`})).toHaveAttribute(`aria-current`,`location`)}async function x(e){let t=e.querySelector(`.specs-workspace__navigation .spec-tree__list`);await E(t).toBeInstanceOf(HTMLElement);let n=t;await E(n.scrollWidth).toBeLessThanOrEqual(n.clientWidth)}function S({treeState:e,documentState:t,selectedSpec:n,selectedFileKey:r,workspaceInput:i,workspaceStatusPath:o,workspaceErrorMessage:s=void 0,isWorkspaceLoading:c=!1,archivingSpecId:d=null,reviewMode:f=`specs`,activeWorktreeName:p=null}){let m=n?.files.find(e=>e.key===r)??null,_;_=f===`diff`?(0,T.jsx)(h,{}):(0,T.jsxs)(`div`,{className:`specs-workspace`,children:[(0,T.jsx)(`aside`,{className:`specs-workspace__navigation`,"aria-label":`Specs`,children:(0,T.jsx)(u,{state:e,selectedSpecId:n?.id??null,archivingSpecId:d,isLoading:d!==null,onSelectSpec:D(),onArchiveSpec:D(),onReload:D()})}),(0,T.jsxs)(`section`,{className:`specs-workspace__document`,"aria-label":`Spec document`,children:[(0,T.jsx)(l,{spec:n,selectedFileKey:r,onSelectFile:D()}),(0,T.jsx)(`div`,{className:`specs-workspace__viewer`,children:(0,T.jsx)(a,{state:t,selectedSpecLabel:n?.label??null,selectedFileLabel:m?.label??null,comments:V,activeCommentId:j(`cmt_story_open_1`),onReload:D(),onSelectComment:D()})})]})]});let v=p===null?{path:`/workspace/plugin-manager`,displayName:`plugin-manager`,kind:`plugin-worktree`,lastOpenedAt:`2026-05-05T00:00:00.000Z`}:{path:o??A,displayName:p,kind:`plugin-worktree`,lastOpenedAt:`2026-05-05T00:00:00.000Z`};return{leftOpen:!0,leftHeader:null,toolbar:(0,T.jsx)(te,{children:(0,T.jsx)(re,{workspacePath:o,inputValue:i,isLoading:c,isBrowsing:!1,errorMessage:s??null,canRefresh:n!==null&&r!==null,onInputChange:D(),onBrowse:D(),onLoad:D(),onRefresh:D(),onReset:D()})}),sidebar:(0,T.jsxs)(`div`,{className:`left-navigation-panel`,children:[(0,T.jsx)(ne,{currentWorkspacePath:o,isOpen:!0,isBusy:c,recentWorkspaces:[{path:`/workspace/spec-board`,displayName:`spec-board`,kind:`plugin-workspace`,lastOpenedAt:`2026-05-07T00:00:00.000Z`},{path:O,displayName:`pdfmod`,kind:`plugin-workspace`,lastOpenedAt:`2026-05-06T00:00:00.000Z`},v],onBrowse:D(),onToggleOpen:D(),onOpenWorkspace:D(),onRemoveWorkspace:D()}),(0,T.jsx)(C,{activeWorktreeName:p})]}),tabs:(0,T.jsx)(g,{mode:f,fileLabel:n!==null&&m!==null?`${n.label} / ${m.fileName}`:`ファイル未選択`,onModeChange:D()}),viewer:_,comments:(0,T.jsx)(ee,{listState:{status:`ready`,comments:V,error:null},operationState:{status:`idle`,operation:null,commentId:null,error:null},activeCommentId:j(`cmt_story_open_1`),onSelectComment:D(),onResolveComment:D(),onReopenComment:D(),onDeleteComment:D(),onUpdateComment:D(),onReload:D()})}}function C({activeWorktreeName:e}){let t=e??`root`;return(0,T.jsxs)(`section`,{className:`story-worktree-tree`,"aria-label":`Worktrees`,children:[(0,T.jsx)(`input`,{"aria-label":`Filter worktrees`,placeholder:`Filter worktrees...`}),(0,T.jsxs)(`div`,{className:`story-worktree-tree__header`,children:[(0,T.jsxs)(`span`,{children:[`ROOT / WORKTREES `,M.length]}),(0,T.jsx)(`span`,{"aria-hidden":`true`,children:`↻`})]}),(0,T.jsx)(`div`,{role:`tree`,"aria-label":`Workspace worktrees`,children:M.map(e=>{let n=e.name===t;return(0,T.jsxs)(`div`,{className:[`story-worktree-tree__row`,n?`story-worktree-tree__row--active`:``,e.isMuted?`story-worktree-tree__row--muted`:``].filter(Boolean).join(` `),role:`treeitem`,"aria-current":n?`location`:void 0,children:[e.icon,` `,e.name,(0,T.jsx)(`span`,{children:e.changeCount})]},e.name)})})]})}var w,T,E,D,ie,O,k,A,j,M,N,ae,P,F,I,L,R,z,B,V,H,U,W,G,K,q,J,Y,X,Z,Q,$,oe;t((()=>{w=e(n(),1),m(),s(),d(),r(),f(),p(),_(),T=i(),{expect:E,fn:D,within:ie}=__STORYBOOK_MODULE_TEST__,O=`/workspace/pdfmod`,k=`agent-a1b3ff42`,A=`/workspace/pdfmod/.worktrees/${k}`,j=c.fromString,M=[{name:`root`,icon:`⌂`,changeCount:0},{name:`549`,icon:`▣`,changeCount:2},{name:k,icon:`⑂`,changeCount:4},{name:`agent-a049b1c8`,icon:`⑂`,changeCount:0},{name:`agent-a395fbe1`,icon:`⑂`,changeCount:1},{name:`agent-a5b8a0d3`,icon:`⑂`,changeCount:2},{name:`agent-a65ad1a4`,icon:`⑂`,changeCount:7},{name:`archive`,icon:`▱`,changeCount:12,isMuted:!0}],N={id:`041-preview-task`,label:`041-preview-task`,files:[{key:`exploration`,label:`exploration.md`,fileName:`exploration.md`,status:`present`},{key:`hearing`,label:`hearing.md`,fileName:`hearing.md`,status:`present`},{key:`impl`,label:`impl.md`,fileName:`impl.md`,status:`present`},{key:`tasks`,label:`tasks.md`,fileName:`tasks.md`,status:`missing`}],children:[]},ae={specs:[{id:`040-delete-task-flow`,label:`040-delete-task-flow`,files:N.files,children:[]},N,{id:`042-cache-invalidation`,label:`042-cache-invalidation`,files:N.files.slice(0,3),children:[]},{id:`archive`,label:`archive`,files:[],children:[{id:`archive/039-legacy-preview`,label:`039-legacy-preview`,files:N.files,children:[]}]}]},P=`Implementation`,F=[{blockType:`heading`,blockIndex:0,textHash:o(`Implementation`),textSnippet:`Implementation`,sourceRange:null},{blockType:`paragraph`,blockIndex:1,textHash:o(`041-preview-task · impl`),textSnippet:`041-preview-task · impl`,sourceRange:null},{blockType:`paragraph`,blockIndex:2,textHash:o(`タスクプレビューの実装方針を、既存の QuickView 相当機能との統合方針を含めて決める。認証と描画性能の 2 軸で判断する。`),textSnippet:`タスクプレビューの実装方針を、既存の QuickView 相当機能との統合方針を含めて決める。認証と描画性能の 2 軸で判断する。`,sourceRange:null},{blockType:`heading`,blockIndex:3,textHash:o(`現状の課題`),textSnippet:`現状の課題`,sourceRange:null},{blockType:`list_item`,blockIndex:4,textHash:o(`プレビュー起動フローが複数入口に散らばっている`),textSnippet:`プレビュー起動フローが複数入口に散らばっている`,sourceRange:null},{blockType:`list_item`,blockIndex:5,textHash:o(`大きなタスクを開いたときの描画コストが線形に増える`),textSnippet:`大きなタスクを開いたときの描画コストが線形に増える`,sourceRange:null},{blockType:`list_item`,blockIndex:6,textHash:o(`権限のないタスクを掴んだときのエラーハンドリングが弱い`),textSnippet:`権限のないタスクを掴んだときのエラーハンドリングが弱い`,sourceRange:null},{blockType:`heading`,blockIndex:7,textHash:o(`検討した選択肢`),textSnippet:`検討した選択肢`,sourceRange:null},{blockType:`table`,blockIndex:8,textHash:o(`OPTION VERDICT A 既存 QuickView をそのままタスクにも流用 rejected B QuickView をラップした TaskPreview を新規に薄く作る accepted C プレビュー基盤ごと書き直す deferred`),textSnippet:`OPTION VERDICT A 既存 QuickView をそのままタスクにも流用 rejected B QuickView をラップした TaskPreview を新規に薄く作る accepted C プレビュー基盤ごと書き直す deferred`,sourceRange:null},{blockType:`heading`,blockIndex:9,textHash:o(`決定事項`),textSnippet:`決定事項`,sourceRange:null},{blockType:`paragraph`,blockIndex:10,textHash:o(`選択肢 B を採用する。既存の QuickView をラップした TaskPreview を薄く作り、タスク固有の権限チェックと空状態のみを新規実装する。描画は既存パスに委譲。`),textSnippet:`選択肢 B を採用する。既存の QuickView をラップした TaskPreview を薄く作り、タスク固有の権限チェックと空状態のみを新規実装する。描画は既存パスに委譲。`,sourceRange:null}],I={key:`impl`,path:`${O}/.plugin-workspace/.specs/041-preview-task/impl.md`,contents:[`# Implementation`,``,"`041-preview-task · impl`",``,"タスクプレビューの実装方針を、既存の `QuickView` 相当機能との統合方針を含めて決める。認証と描画性能の 2 軸で判断する。",``,`## 現状の課題`,``,`- プレビュー起動フローが複数入口に散らばっている`,`- 大きなタスクを開いたときの描画コストが線形に増える`,`- 権限のないタスクを掴んだときのエラーハンドリングが弱い`,``,`## 検討した選択肢`,``,`| OPTION | | VERDICT |`,`| --- | --- | --- |`,`| A | 既存 QuickView をそのままタスクにも流用 | rejected |`,`| B | **QuickView をラップした TaskPreview を新規に薄く作る** | accepted |`,`| C | プレビュー基盤ごと書き直す | deferred |`,``,`## 決定事項`,``,"選択肢 B を採用する。既存の QuickView をラップした `TaskPreview` を薄く作り、タスク固有の権限チェックと空状態のみを新規実装する。描画は既存パスに委譲。"].join(`
`),missing:!1,blocks:F},L={status:`ready`,workspacePath:O,tree:ae,error:null},R={status:`ready`,workspacePath:O,specId:N.id,fileKey:`impl`,document:I,error:null},z={...L,workspacePath:A},B={...R,workspacePath:A,document:{...I,path:`${A}/.plugin-workspace/.specs/041-preview-task/impl.md`}},V=[{id:j(`cmt_story_open_1`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:o(P),textSnippet:`scorer.ts L16 · calcFu`,charRange:{start:0,end:14}},body:`ctx が undefined のとき落ちる。null チェックいる?`,status:`open`,createdAt:`2026-07-25T12:00:00Z`,updatedAt:`2026-07-25T12:00:00Z`},{id:j(`cmt_story_open_2`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:o(P),textSnippet:`pinfu.ts L10 · checkAllRuns`,charRange:{start:0,end:14}},body:`agent-a5b8a0d3 は shapes を Map で持ってた。どっちが速いか計測したい`,status:`open`,createdAt:`2026-07-25T10:00:00Z`,updatedAt:`2026-07-25T10:00:00Z`},{id:j(`cmt_story_open_3`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:o(P),textSnippet:`scorer.ts L14 · score()`,charRange:{start:0,end:14}},body:`戻り値の Result 型、hands/*.ts と重複してるフィールドあり`,status:`open`,createdAt:`2026-07-25T08:00:00Z`,updatedAt:`2026-07-25T08:00:00Z`},{id:j(`cmt_story_resolved`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:o(P),textSnippet:`implementation decision`,charRange:{start:0,end:14}},body:`描画経路の統合方針を反映済み。`,status:`resolved`,createdAt:`2026-07-24T08:00:00Z`,updatedAt:`2026-07-24T09:00:00Z`}],H={component:y,parameters:{layout:`fullscreen`},decorators:[e=>(0,T.jsx)(`div`,{style:{height:`100vh`},children:(0,T.jsx)(e,{})})],argTypes:{toolbar:{control:!1},sidebar:{control:!1},tabs:{control:!1},viewer:{control:!1},comments:{control:!1}}},U=S({treeState:L,documentState:R,selectedSpec:N,selectedFileKey:`impl`,workspaceInput:O,workspaceStatusPath:O}),W={name:`Specs`,args:U,play:async({canvasElement:e})=>{await x(e)}},G={args:{...U,leftWidth:420,commentsWidth:560}},K={args:{...U,leftOpen:!1,commentsOpen:!1}},q={args:S({treeState:L,documentState:R,selectedSpec:N,selectedFileKey:`impl`,workspaceInput:O,workspaceStatusPath:O,reviewMode:`diff`})},J={args:S({treeState:z,documentState:B,selectedSpec:N,selectedFileKey:`impl`,workspaceInput:A,workspaceStatusPath:A,activeWorktreeName:k}),play:async({canvasElement:e})=>{await b(e)}},Y={args:S({treeState:z,documentState:B,selectedSpec:N,selectedFileKey:`impl`,workspaceInput:A,workspaceStatusPath:A,activeWorktreeName:k,reviewMode:`diff`}),play:async({canvasElement:e})=>{await b(e)}},X={args:S({treeState:L,documentState:R,selectedSpec:N,selectedFileKey:`impl`,workspaceInput:O,workspaceStatusPath:O,archivingSpecId:N.id})},Z={args:S({treeState:{status:`loading`,workspacePath:O,tree:null,error:null},documentState:{status:`loading`,workspacePath:O,specId:N.id,fileKey:`impl`,document:null,error:null},selectedSpec:N,selectedFileKey:`impl`,workspaceInput:O,workspaceStatusPath:O,isWorkspaceLoading:!0})},Q={args:S({treeState:{status:`empty`,workspacePath:O,tree:{specs:[]},error:null},documentState:{status:`idle`,workspacePath:O,specId:null,fileKey:null,document:null,error:null},selectedSpec:null,selectedFileKey:null,workspaceInput:O,workspaceStatusPath:O})},$={args:S({treeState:{status:`error`,workspacePath:O,tree:null,error:{feature:`specs`,code:`specTreeScan`,message:`Spec directory could not be scanned.`,cause:{command:`list_specs`,code:`specTreeScan`,message:`Spec directory could not be scanned.`,raw:`Spec directory could not be scanned.`}}},documentState:{status:`error`,workspacePath:O,specId:N.id,fileKey:`impl`,document:null,error:{feature:`specs`,code:`markdownRead`,message:`Markdown file could not be read.`,cause:{command:`read_spec_file`,code:`markdownRead`,message:`Markdown file could not be read.`,raw:`Markdown file could not be read.`}}},selectedSpec:N,selectedFileKey:`impl`,workspaceInput:O,workspaceStatusPath:O,workspaceErrorMessage:`Workspace loaded with file warnings.`})},W.parameters={...W.parameters,docs:{...W.parameters?.docs,source:{originalSource:`{
  name: "Specs",
  args: readySpecsArgs,
  play: async ({
    canvasElement
  }) => {
    await verifySpecsListHasNoHorizontalOverflow(canvasElement);
  }
}`,...W.parameters?.docs?.source}}},G.parameters={...G.parameters,docs:{...G.parameters?.docs,source:{originalSource:`{
  args: {
    ...readySpecsArgs,
    leftWidth: 420,
    commentsWidth: 560
  }
}`,...G.parameters?.docs?.source}}},K.parameters={...K.parameters,docs:{...K.parameters?.docs,source:{originalSource:`{
  args: {
    ...readySpecsArgs,
    leftOpen: false,
    commentsOpen: false
  }
}`,...K.parameters?.docs?.source}}},q.parameters={...q.parameters,docs:{...q.parameters?.docs,source:{originalSource:`{
  args: createShellArgs({
    treeState: readyTreeState,
    documentState: readyDocumentState,
    selectedSpec: sampleSpec,
    selectedFileKey: "impl",
    workspaceInput: workspacePath,
    workspaceStatusPath: workspacePath,
    reviewMode: "diff"
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
    reviewMode: "diff"
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
}`,...$.parameters?.docs?.source}}},oe=[`Default`,`AllProps`,`EdgeCases`,`Diff`,`WorktreeOpen`,`WorktreeDiff`,`Archiving`,`Loading`,`Empty`,`Error`]}))();export{G as AllProps,X as Archiving,W as Default,q as Diff,K as EdgeCases,Q as Empty,$ as Error,Z as Loading,Y as WorktreeDiff,J as WorktreeOpen,oe as __namedExportsOrder,H as default};