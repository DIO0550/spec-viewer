import{a as e,n as t}from"./chunk-DnJy8xQt.js";import{n}from"./iframe-DjI-EJrE.js";import{t as r}from"./CommentSidebar-Cwaa9Qna.js";import{r as ee,t as i}from"./preferences-hsX36770.js";import{t as a}from"./jsx-runtime-BpX3lQ6F.js";import{t as te}from"./MarkdownViewer-DQRfdL8p.js";import{a as o,n as s,t as c}from"./commentId-D2JE7cv5.js";import{t as l}from"./SpecTabs-2uOXd3jw.js";import{s as u}from"./specTreeState-DN_u8uUL.js";import{a as d,o as f,t as p}from"./workspace-DV5wFs-o.js";import{t as m}from"./comments-Bn6CQ_Xi.js";import{t as h}from"./DiffWorkspace-ee-eDc4z.js";import{t as ne}from"./ReviewModeToolbar-BkeNbttq.js";import{n as g,t as _}from"./WorkspaceLayout-CZPfX96v.js";import{t as re}from"./WorkspaceSidebarSection-JbVaOach.js";import{t as ie}from"./WorkspaceToolbar-DExfPeEx.js";function v(e){let{toolbar:t,leftHeader:n,sidebar:r,tabs:ee,viewer:i,comments:a,leftOpen:te,leftWidth:o,leftMinWidth:s,leftMaxWidth:c,onOpenLeft:l,onCloseLeft:u,onLeftWidthChange:d,commentsOpen:f,commentsWidth:p,commentsMinWidth:m,commentsMaxWidth:h,onOpenComments:ne,onCloseComments:g,onCommentsWidthChange:re}=e,[ie,v]=(0,S.useState)(te??!0),[y,b]=(0,S.useState)(o??240),[x,w]=(0,S.useState)(f??!0),[T,E]=(0,S.useState)(p??300);return(0,C.jsxs)(_.Root,{leftNavigation:{isOpen:ie,width:y,minWidth:s,maxWidth:c,onOpen:()=>{v(!0),l?.()},onClose:()=>{v(!1),u?.()},onWidthChange:e=>{b(e),d?.(e)}},commentsSidebar:{isOpen:x,width:T,minWidth:m,maxWidth:h,onOpen:()=>{w(!0),ne?.()},onClose:()=>{w(!1),g?.()},onWidthChange:e=>{E(e),re?.(e)}},children:[(0,C.jsx)(_.Pathbar,{children:t}),(0,C.jsx)(_.LeftNavigation,{header:n,children:r}),(0,C.jsxs)(_.Main,{children:[(0,C.jsx)(_.Tabs,{children:ee}),(0,C.jsx)(_.Viewer,{children:i})]}),(0,C.jsx)(_.Comments,{children:a})]})}async function y(e){let t=E(e);await w(t.getByRole(`textbox`,{name:`PATH`})).toHaveValue(k),await w(t.getByRole(`treeitem`,{name:new RegExp(O)})).toHaveAttribute(`aria-current`,`location`),await w(t.getByRole(`button`,{name:`${O}を開く`})).toHaveAttribute(`aria-current`,`location`)}function b({treeState:e,documentState:t,selectedSpec:n,selectedFileKey:i,workspaceInput:a,workspaceStatusPath:o,workspaceErrorMessage:s=void 0,isWorkspaceLoading:c=!1,archivingSpecId:d=null,reviewMode:f=`specs`,activeWorktreeName:p=null}){let m=n?.files.find(e=>e.key===i)??null,g;g=f===`diff`?(0,C.jsx)(h,{}):(0,C.jsxs)(`div`,{className:`specs-workspace`,children:[(0,C.jsx)(`aside`,{className:`specs-workspace__navigation`,"aria-label":`Specs`,children:(0,C.jsx)(u,{state:e,selectedSpecId:n?.id??null,archivingSpecId:d,isLoading:d!==null,onSelectSpec:T(),onArchiveSpec:T(),onReload:T()})}),(0,C.jsxs)(`section`,{className:`specs-workspace__document`,"aria-label":`Spec document`,children:[(0,C.jsx)(l,{spec:n,selectedFileKey:i,onSelectFile:T()}),(0,C.jsx)(`div`,{className:`specs-workspace__viewer`,children:(0,C.jsx)(te,{state:t,selectedSpecLabel:n?.label??null,selectedFileLabel:m?.label??null,comments:V,activeCommentId:A(`cmt_story_open_1`),onReload:T(),onSelectComment:T()})})]})]});let _=p===null?{path:`/workspace/plugin-manager`,displayName:`plugin-manager`,kind:`plugin-worktree`,lastOpenedAt:`2026-05-05T00:00:00.000Z`}:{path:o??k,displayName:p,kind:`plugin-worktree`,lastOpenedAt:`2026-05-05T00:00:00.000Z`};return{leftOpen:!0,leftHeader:null,toolbar:(0,C.jsx)(ee,{children:(0,C.jsx)(ie,{workspacePath:o,inputValue:a,isLoading:c,isBrowsing:!1,errorMessage:s??null,canRefresh:n!==null&&i!==null,onInputChange:T(),onBrowse:T(),onLoad:T(),onRefresh:T(),onReset:T()})}),sidebar:(0,C.jsxs)(`div`,{className:`left-navigation-panel`,children:[(0,C.jsx)(re,{currentWorkspacePath:o,isOpen:!0,isBusy:c,recentWorkspaces:[{path:`/workspace/spec-board`,displayName:`spec-board`,kind:`plugin-workspace`,lastOpenedAt:`2026-05-07T00:00:00.000Z`},{path:D,displayName:`pdfmod`,kind:`plugin-workspace`,lastOpenedAt:`2026-05-06T00:00:00.000Z`},_],onBrowse:T(),onToggleOpen:T(),onOpenWorkspace:T(),onRemoveWorkspace:T()}),(0,C.jsx)(x,{activeWorktreeName:p})]}),tabs:(0,C.jsx)(ne,{mode:f,fileLabel:n!==null&&m!==null?`${n.label} / ${m.fileName}`:`ファイル未選択`,onModeChange:T()}),viewer:g,comments:(0,C.jsx)(r,{listState:{status:`ready`,comments:V,error:null},operationState:{status:`idle`,operation:null,commentId:null,error:null},activeCommentId:A(`cmt_story_open_1`),onSelectComment:T(),onResolveComment:T(),onReopenComment:T(),onDeleteComment:T(),onUpdateComment:T(),onReload:T()})}}function x({activeWorktreeName:e}){let t=e??`root`;return(0,C.jsxs)(`section`,{className:`story-worktree-tree`,"aria-label":`Worktrees`,children:[(0,C.jsx)(`input`,{"aria-label":`Filter worktrees`,placeholder:`Filter worktrees...`}),(0,C.jsxs)(`div`,{className:`story-worktree-tree__header`,children:[(0,C.jsxs)(`span`,{children:[`ROOT / WORKTREES `,j.length]}),(0,C.jsx)(`span`,{"aria-hidden":`true`,children:`↻`})]}),(0,C.jsx)(`div`,{role:`tree`,"aria-label":`Workspace worktrees`,children:j.map(e=>{let n=e.name===t;return(0,C.jsxs)(`div`,{className:[`story-worktree-tree__row`,n?`story-worktree-tree__row--active`:``,e.isMuted?`story-worktree-tree__row--muted`:``].filter(Boolean).join(` `),role:`treeitem`,"aria-current":n?`location`:void 0,children:[e.icon,` `,e.name,(0,C.jsx)(`span`,{children:e.changeCount})]},e.name)})})]})}var S,C,w,T,E,D,O,k,A,j,M,N,P,F,I,L,R,z,B,V,H,U,W,G,K,q,J,Y,X,Z,Q,$,ae;t((()=>{S=e(n(),1),m(),s(),d(),i(),f(),p(),g(),C=a(),{expect:w,fn:T,within:E}=__STORYBOOK_MODULE_TEST__,D=`/workspace/pdfmod`,O=`agent-a1b3ff42`,k=`/workspace/pdfmod/.worktrees/${O}`,A=c.fromString,j=[{name:`root`,icon:`⌂`,changeCount:0},{name:`549`,icon:`▣`,changeCount:2},{name:O,icon:`⑂`,changeCount:4},{name:`agent-a049b1c8`,icon:`⑂`,changeCount:0},{name:`agent-a395fbe1`,icon:`⑂`,changeCount:1},{name:`agent-a5b8a0d3`,icon:`⑂`,changeCount:2},{name:`agent-a65ad1a4`,icon:`⑂`,changeCount:7},{name:`archive`,icon:`▱`,changeCount:12,isMuted:!0}],M={id:`041-preview-task`,label:`041-preview-task`,files:[{key:`exploration`,label:`exploration.md`,fileName:`exploration.md`,status:`present`},{key:`hearing`,label:`hearing.md`,fileName:`hearing.md`,status:`present`},{key:`impl`,label:`impl.md`,fileName:`impl.md`,status:`present`},{key:`tasks`,label:`tasks.md`,fileName:`tasks.md`,status:`missing`}],children:[]},N={specs:[{id:`040-delete-task-flow`,label:`040-delete-task-flow`,files:M.files,children:[]},M,{id:`042-cache-invalidation`,label:`042-cache-invalidation`,files:M.files.slice(0,3),children:[]},{id:`archive`,label:`archive`,files:[],children:[{id:`archive/039-legacy-preview`,label:`039-legacy-preview`,files:M.files,children:[]}]}]},P=`Implementation`,F=[{blockType:`heading`,blockIndex:0,textHash:o(`Implementation`),textSnippet:`Implementation`,sourceRange:null},{blockType:`paragraph`,blockIndex:1,textHash:o(`041-preview-task · impl`),textSnippet:`041-preview-task · impl`,sourceRange:null},{blockType:`paragraph`,blockIndex:2,textHash:o(`タスクプレビューの実装方針を、既存の QuickView 相当機能との統合方針を含めて決める。認証と描画性能の 2 軸で判断する。`),textSnippet:`タスクプレビューの実装方針を、既存の QuickView 相当機能との統合方針を含めて決める。認証と描画性能の 2 軸で判断する。`,sourceRange:null},{blockType:`heading`,blockIndex:3,textHash:o(`現状の課題`),textSnippet:`現状の課題`,sourceRange:null},{blockType:`list_item`,blockIndex:4,textHash:o(`プレビュー起動フローが複数入口に散らばっている`),textSnippet:`プレビュー起動フローが複数入口に散らばっている`,sourceRange:null},{blockType:`list_item`,blockIndex:5,textHash:o(`大きなタスクを開いたときの描画コストが線形に増える`),textSnippet:`大きなタスクを開いたときの描画コストが線形に増える`,sourceRange:null},{blockType:`list_item`,blockIndex:6,textHash:o(`権限のないタスクを掴んだときのエラーハンドリングが弱い`),textSnippet:`権限のないタスクを掴んだときのエラーハンドリングが弱い`,sourceRange:null},{blockType:`heading`,blockIndex:7,textHash:o(`検討した選択肢`),textSnippet:`検討した選択肢`,sourceRange:null},{blockType:`table`,blockIndex:8,textHash:o(`OPTION VERDICT A 既存 QuickView をそのままタスクにも流用 rejected B QuickView をラップした TaskPreview を新規に薄く作る accepted C プレビュー基盤ごと書き直す deferred`),textSnippet:`OPTION VERDICT A 既存 QuickView をそのままタスクにも流用 rejected B QuickView をラップした TaskPreview を新規に薄く作る accepted C プレビュー基盤ごと書き直す deferred`,sourceRange:null},{blockType:`heading`,blockIndex:9,textHash:o(`決定事項`),textSnippet:`決定事項`,sourceRange:null},{blockType:`paragraph`,blockIndex:10,textHash:o(`選択肢 B を採用する。既存の QuickView をラップした TaskPreview を薄く作り、タスク固有の権限チェックと空状態のみを新規実装する。描画は既存パスに委譲。`),textSnippet:`選択肢 B を採用する。既存の QuickView をラップした TaskPreview を薄く作り、タスク固有の権限チェックと空状態のみを新規実装する。描画は既存パスに委譲。`,sourceRange:null}],I={key:`impl`,path:`${D}/.plugin-workspace/.specs/041-preview-task/impl.md`,contents:[`# Implementation`,``,"`041-preview-task · impl`",``,"タスクプレビューの実装方針を、既存の `QuickView` 相当機能との統合方針を含めて決める。認証と描画性能の 2 軸で判断する。",``,`## 現状の課題`,``,`- プレビュー起動フローが複数入口に散らばっている`,`- 大きなタスクを開いたときの描画コストが線形に増える`,`- 権限のないタスクを掴んだときのエラーハンドリングが弱い`,``,`## 検討した選択肢`,``,`| OPTION | | VERDICT |`,`| --- | --- | --- |`,`| A | 既存 QuickView をそのままタスクにも流用 | rejected |`,`| B | **QuickView をラップした TaskPreview を新規に薄く作る** | accepted |`,`| C | プレビュー基盤ごと書き直す | deferred |`,``,`## 決定事項`,``,"選択肢 B を採用する。既存の QuickView をラップした `TaskPreview` を薄く作り、タスク固有の権限チェックと空状態のみを新規実装する。描画は既存パスに委譲。"].join(`
`),missing:!1,blocks:F},L={status:`ready`,workspacePath:D,tree:N,error:null},R={status:`ready`,workspacePath:D,specId:M.id,fileKey:`impl`,document:I,error:null},z={...L,workspacePath:k},B={...R,workspacePath:k,document:{...I,path:`${k}/.plugin-workspace/.specs/041-preview-task/impl.md`}},V=[{id:A(`cmt_story_open_1`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:o(P),textSnippet:`scorer.ts L16 · calcFu`,charRange:{start:0,end:14}},body:`ctx が undefined のとき落ちる。null チェックいる?`,status:`open`,createdAt:`2026-07-25T12:00:00Z`,updatedAt:`2026-07-25T12:00:00Z`},{id:A(`cmt_story_open_2`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:o(P),textSnippet:`pinfu.ts L10 · checkAllRuns`,charRange:{start:0,end:14}},body:`agent-a5b8a0d3 は shapes を Map で持ってた。どっちが速いか計測したい`,status:`open`,createdAt:`2026-07-25T10:00:00Z`,updatedAt:`2026-07-25T10:00:00Z`},{id:A(`cmt_story_open_3`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:o(P),textSnippet:`scorer.ts L14 · score()`,charRange:{start:0,end:14}},body:`戻り値の Result 型、hands/*.ts と重複してるフィールドあり`,status:`open`,createdAt:`2026-07-25T08:00:00Z`,updatedAt:`2026-07-25T08:00:00Z`},{id:A(`cmt_story_resolved`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:o(P),textSnippet:`implementation decision`,charRange:{start:0,end:14}},body:`描画経路の統合方針を反映済み。`,status:`resolved`,createdAt:`2026-07-24T08:00:00Z`,updatedAt:`2026-07-24T09:00:00Z`}],H={component:v,parameters:{layout:`fullscreen`},decorators:[e=>(0,C.jsx)(`div`,{style:{height:`100vh`},children:(0,C.jsx)(e,{})})],argTypes:{toolbar:{control:!1},sidebar:{control:!1},tabs:{control:!1},viewer:{control:!1},comments:{control:!1}}},U=b({treeState:L,documentState:R,selectedSpec:M,selectedFileKey:`impl`,workspaceInput:D,workspaceStatusPath:D}),W={name:`Specs`,args:U},G={args:{...U,leftWidth:420,commentsWidth:560}},K={args:{...U,leftOpen:!1,commentsOpen:!1}},q={args:b({treeState:L,documentState:R,selectedSpec:M,selectedFileKey:`impl`,workspaceInput:D,workspaceStatusPath:D,reviewMode:`diff`})},J={args:b({treeState:z,documentState:B,selectedSpec:M,selectedFileKey:`impl`,workspaceInput:k,workspaceStatusPath:k,activeWorktreeName:O}),play:async({canvasElement:e})=>{await y(e)}},Y={args:b({treeState:z,documentState:B,selectedSpec:M,selectedFileKey:`impl`,workspaceInput:k,workspaceStatusPath:k,activeWorktreeName:O,reviewMode:`diff`}),play:async({canvasElement:e})=>{await y(e)}},X={args:b({treeState:L,documentState:R,selectedSpec:M,selectedFileKey:`impl`,workspaceInput:D,workspaceStatusPath:D,archivingSpecId:M.id})},Z={args:b({treeState:{status:`loading`,workspacePath:D,tree:null,error:null},documentState:{status:`loading`,workspacePath:D,specId:M.id,fileKey:`impl`,document:null,error:null},selectedSpec:M,selectedFileKey:`impl`,workspaceInput:D,workspaceStatusPath:D,isWorkspaceLoading:!0})},Q={args:b({treeState:{status:`empty`,workspacePath:D,tree:{specs:[]},error:null},documentState:{status:`idle`,workspacePath:D,specId:null,fileKey:null,document:null,error:null},selectedSpec:null,selectedFileKey:null,workspaceInput:D,workspaceStatusPath:D})},$={args:b({treeState:{status:`error`,workspacePath:D,tree:null,error:{feature:`specs`,code:`specTreeScan`,message:`Spec directory could not be scanned.`,cause:{command:`list_specs`,code:`specTreeScan`,message:`Spec directory could not be scanned.`,raw:`Spec directory could not be scanned.`}}},documentState:{status:`error`,workspacePath:D,specId:M.id,fileKey:`impl`,document:null,error:{feature:`specs`,code:`markdownRead`,message:`Markdown file could not be read.`,cause:{command:`read_spec_file`,code:`markdownRead`,message:`Markdown file could not be read.`,raw:`Markdown file could not be read.`}}},selectedSpec:M,selectedFileKey:`impl`,workspaceInput:D,workspaceStatusPath:D,workspaceErrorMessage:`Workspace loaded with file warnings.`})},W.parameters={...W.parameters,docs:{...W.parameters?.docs,source:{originalSource:`{
  name: "Specs",
  args: readySpecsArgs
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
}`,...$.parameters?.docs?.source}}},ae=[`Default`,`AllProps`,`EdgeCases`,`Diff`,`WorktreeOpen`,`WorktreeDiff`,`Archiving`,`Loading`,`Empty`,`Error`]}))();export{G as AllProps,X as Archiving,W as Default,q as Diff,K as EdgeCases,Q as Empty,$ as Error,Z as Loading,Y as WorktreeDiff,J as WorktreeOpen,ae as __namedExportsOrder,H as default};