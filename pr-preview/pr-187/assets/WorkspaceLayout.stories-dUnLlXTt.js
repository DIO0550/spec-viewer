import{a as e,n as t}from"./chunk-DnJy8xQt.js";import{n}from"./iframe-BicWbx1l.js";import{t as r}from"./CommentSidebar-CIraRbrN.js";import{r as i,t as a}from"./preferences-CqlV54KV.js";import{t as o}from"./jsx-runtime-BpX3lQ6F.js";import{t as s}from"./MarkdownViewer-GkNlsgPr.js";import{a as c,n as l,t as u}from"./commentId-D2JE7cv5.js";import{t as d}from"./SpecTabs-j3YcurP_.js";import{s as f}from"./specTreeState-oP9aznci.js";import{a as p,o as m,t as h}from"./workspace-B64c-auy.js";import{t as g}from"./comments-CRWRlOst.js";import{t as _}from"./DiffWorkspace-DVXEJ8ki.js";import{t as v}from"./ReviewModeToolbar-BkeNbttq.js";import{n as y,t as b}from"./WorkspaceLayout-0OjaUUl5.js";import{t as x}from"./WorkspaceSidebarSection-BMOJBU6z.js";import{t as S}from"./WorkspaceToolbar-E2gRiKWN.js";function C(e){let{toolbar:t,leftHeader:n,sidebar:r,tabs:i,viewer:a,comments:o,leftOpen:s,leftWidth:c,leftMinWidth:l,leftMaxWidth:u,onOpenLeft:d,onCloseLeft:f,onLeftWidthChange:p,commentsOpen:m,commentsWidth:h,commentsMinWidth:g,commentsMaxWidth:_,onOpenComments:v,onCloseComments:y,onCommentsWidthChange:x}=e,[S,C]=(0,T.useState)(s??!0),[w,D]=(0,T.useState)(c??240),[O,k]=(0,T.useState)(m??!0),[A,j]=(0,T.useState)(h??300);return(0,E.jsxs)(b.Root,{leftNavigation:{isOpen:S,width:w,minWidth:l,maxWidth:u,onOpen:()=>{C(!0),d?.()},onClose:()=>{C(!1),f?.()},onWidthChange:e=>{D(e),p?.(e)}},commentsSidebar:{isOpen:O,width:A,minWidth:g,maxWidth:_,onOpen:()=>{k(!0),v?.()},onClose:()=>{k(!1),y?.()},onWidthChange:e=>{j(e),x?.(e)}},children:[(0,E.jsx)(b.Pathbar,{children:t}),(0,E.jsx)(b.LeftNavigation,{header:n,children:r}),(0,E.jsxs)(b.Main,{children:[(0,E.jsx)(b.Tabs,{children:i}),(0,E.jsx)(b.Viewer,{children:a})]}),(0,E.jsx)(b.Comments,{children:o})]})}function w({treeState:e,documentState:t,selectedSpec:n,selectedFileKey:a,workspaceInput:o,workspaceStatusPath:c,workspaceErrorMessage:l=void 0,isWorkspaceLoading:u=!1,archivingSpecId:p=null,reviewMode:m=`specs`}){let h=n?.files.find(e=>e.key===a)??null,g;return g=m===`diff`?(0,E.jsx)(_,{}):(0,E.jsxs)(`div`,{className:`specs-workspace`,children:[(0,E.jsx)(`aside`,{className:`specs-workspace__navigation`,"aria-label":`Specs`,children:(0,E.jsx)(f,{state:e,selectedSpecId:n?.id??null,archivingSpecId:p,isLoading:p!==null,onSelectSpec:D(),onArchiveSpec:D(),onReload:D()})}),(0,E.jsxs)(`section`,{className:`specs-workspace__document`,"aria-label":`Spec document`,children:[(0,E.jsx)(d,{spec:n,selectedFileKey:a,onSelectFile:D()}),(0,E.jsx)(`div`,{className:`specs-workspace__viewer`,children:(0,E.jsx)(s,{state:t,selectedSpecLabel:n?.label??null,selectedFileLabel:h?.label??null,comments:L,activeCommentId:k(`cmt_story_open_1`),onReload:D(),onSelectComment:D()})})]})]}),{leftOpen:!0,leftHeader:null,toolbar:(0,E.jsx)(i,{children:(0,E.jsx)(S,{workspacePath:c,inputValue:o,isLoading:u,isBrowsing:!1,errorMessage:l??null,canRefresh:n!==null&&a!==null,onInputChange:D(),onBrowse:D(),onLoad:D(),onRefresh:D(),onReset:D()})}),sidebar:(0,E.jsxs)(`div`,{className:`left-navigation-panel`,children:[(0,E.jsx)(x,{currentWorkspacePath:c,isOpen:!0,isBusy:u,recentWorkspaces:[{path:`/Users/dio/work/spec-board`,displayName:`spec-board`,kind:`plugin-workspace`,lastOpenedAt:`2026-05-07T00:00:00.000Z`},{path:O,displayName:`pdfmod`,kind:`plugin-workspace`,lastOpenedAt:`2026-05-06T00:00:00.000Z`},{path:`/Users/dio/work/plugin-manager`,displayName:`plugin-manager`,kind:`plugin-worktree`,lastOpenedAt:`2026-05-05T00:00:00.000Z`}],onBrowse:D(),onToggleOpen:D(),onOpenWorkspace:D(),onRemoveWorkspace:D()}),(0,E.jsxs)(`div`,{className:`story-worktree-tree`,"aria-label":`Worktrees`,children:[(0,E.jsx)(`input`,{"aria-label":`Filter worktrees`,placeholder:`Filter worktrees...`}),(0,E.jsxs)(`div`,{className:`story-worktree-tree__header`,children:[(0,E.jsx)(`span`,{children:`ROOT / WORKTREES 8`}),(0,E.jsx)(`span`,{"aria-hidden":`true`,children:`↻`})]}),(0,E.jsxs)(`div`,{className:`story-worktree-tree__row`,children:[`⌂ root `,(0,E.jsx)(`span`,{children:`0`})]}),(0,E.jsxs)(`div`,{className:`story-worktree-tree__row`,children:[`▣ 549 `,(0,E.jsx)(`span`,{children:`2`})]}),(0,E.jsxs)(`div`,{className:`story-worktree-tree__row story-worktree-tree__row--active`,children:[`⑂ agent-a1b3ff42 `,(0,E.jsx)(`span`,{children:`4`})]}),(0,E.jsxs)(`div`,{className:`story-worktree-tree__row`,children:[`⑂ agent-a049b1c8 `,(0,E.jsx)(`span`,{children:`0`})]}),(0,E.jsxs)(`div`,{className:`story-worktree-tree__row`,children:[`⑂ agent-a395fbe1 `,(0,E.jsx)(`span`,{children:`1`})]}),(0,E.jsxs)(`div`,{className:`story-worktree-tree__row`,children:[`⑂ agent-a5b8a0d3 `,(0,E.jsx)(`span`,{children:`2`})]}),(0,E.jsxs)(`div`,{className:`story-worktree-tree__row`,children:[`⑂ agent-a65ad1a4 `,(0,E.jsx)(`span`,{children:`7`})]}),(0,E.jsxs)(`div`,{className:`story-worktree-tree__row story-worktree-tree__row--muted`,children:[`▱ archive `,(0,E.jsx)(`span`,{children:`12`})]})]})]}),tabs:(0,E.jsx)(v,{mode:m,fileLabel:n!==null&&h!==null?`${n.label} / ${h.fileName}`:`ファイル未選択`,onModeChange:D()}),viewer:g,comments:(0,E.jsx)(r,{listState:{status:`ready`,comments:L,error:null},operationState:{status:`idle`,operation:null,commentId:null,error:null},activeCommentId:k(`cmt_story_open_1`),onSelectComment:D(),onResolveComment:D(),onReopenComment:D(),onDeleteComment:D(),onUpdateComment:D(),onReload:D()})}}var T,E,D,O,k,A,j,M,N,P,F,I,L,R,z,B,V,H,U,W,G,K,q,J;t((()=>{T=e(n(),1),g(),l(),p(),a(),m(),h(),y(),E=o(),{fn:D}=__STORYBOOK_MODULE_TEST__,O=`/Users/dio/work/pdfmod`,k=u.fromString,A={id:`041-preview-task`,label:`041-preview-task`,files:[{key:`exploration`,label:`exploration.md`,fileName:`exploration.md`,status:`present`},{key:`hearing`,label:`hearing.md`,fileName:`hearing.md`,status:`present`},{key:`impl`,label:`impl.md`,fileName:`impl.md`,status:`present`},{key:`tasks`,label:`tasks.md`,fileName:`tasks.md`,status:`missing`}],children:[]},j={specs:[{id:`040-delete-task-flow`,label:`040-delete-task-flow`,files:A.files,children:[]},A,{id:`042-cache-invalidation`,label:`042-cache-invalidation`,files:A.files.slice(0,3),children:[]},{id:`archive`,label:`archive`,files:[],children:[{id:`archive/039-legacy-preview`,label:`039-legacy-preview`,files:A.files,children:[]}]}]},M=`Implementation`,N=[{blockType:`heading`,blockIndex:0,textHash:c(`Implementation`),textSnippet:`Implementation`,sourceRange:null},{blockType:`paragraph`,blockIndex:1,textHash:c(`041-preview-task · impl`),textSnippet:`041-preview-task · impl`,sourceRange:null},{blockType:`paragraph`,blockIndex:2,textHash:c(`タスクプレビューの実装方針を、既存の QuickView 相当機能との統合方針を含めて決める。認証と描画性能の 2 軸で判断する。`),textSnippet:`タスクプレビューの実装方針を、既存の QuickView 相当機能との統合方針を含めて決める。認証と描画性能の 2 軸で判断する。`,sourceRange:null},{blockType:`heading`,blockIndex:3,textHash:c(`現状の課題`),textSnippet:`現状の課題`,sourceRange:null},{blockType:`list_item`,blockIndex:4,textHash:c(`プレビュー起動フローが複数入口に散らばっている`),textSnippet:`プレビュー起動フローが複数入口に散らばっている`,sourceRange:null},{blockType:`list_item`,blockIndex:5,textHash:c(`大きなタスクを開いたときの描画コストが線形に増える`),textSnippet:`大きなタスクを開いたときの描画コストが線形に増える`,sourceRange:null},{blockType:`list_item`,blockIndex:6,textHash:c(`権限のないタスクを掴んだときのエラーハンドリングが弱い`),textSnippet:`権限のないタスクを掴んだときのエラーハンドリングが弱い`,sourceRange:null},{blockType:`heading`,blockIndex:7,textHash:c(`検討した選択肢`),textSnippet:`検討した選択肢`,sourceRange:null},{blockType:`table`,blockIndex:8,textHash:c(`OPTION VERDICT A 既存 QuickView をそのままタスクにも流用 rejected B QuickView をラップした TaskPreview を新規に薄く作る accepted C プレビュー基盤ごと書き直す deferred`),textSnippet:`OPTION VERDICT A 既存 QuickView をそのままタスクにも流用 rejected B QuickView をラップした TaskPreview を新規に薄く作る accepted C プレビュー基盤ごと書き直す deferred`,sourceRange:null},{blockType:`heading`,blockIndex:9,textHash:c(`決定事項`),textSnippet:`決定事項`,sourceRange:null},{blockType:`paragraph`,blockIndex:10,textHash:c(`選択肢 B を採用する。既存の QuickView をラップした TaskPreview を薄く作り、タスク固有の権限チェックと空状態のみを新規実装する。描画は既存パスに委譲。`),textSnippet:`選択肢 B を採用する。既存の QuickView をラップした TaskPreview を薄く作り、タスク固有の権限チェックと空状態のみを新規実装する。描画は既存パスに委譲。`,sourceRange:null}],P={key:`impl`,path:`${O}/.plugin-workspace/.specs/041-preview-task/impl.md`,contents:[`# Implementation`,``,"`041-preview-task · impl`",``,"タスクプレビューの実装方針を、既存の `QuickView` 相当機能との統合方針を含めて決める。認証と描画性能の 2 軸で判断する。",``,`## 現状の課題`,``,`- プレビュー起動フローが複数入口に散らばっている`,`- 大きなタスクを開いたときの描画コストが線形に増える`,`- 権限のないタスクを掴んだときのエラーハンドリングが弱い`,``,`## 検討した選択肢`,``,`| OPTION | | VERDICT |`,`| --- | --- | --- |`,`| A | 既存 QuickView をそのままタスクにも流用 | rejected |`,`| B | **QuickView をラップした TaskPreview を新規に薄く作る** | accepted |`,`| C | プレビュー基盤ごと書き直す | deferred |`,``,`## 決定事項`,``,"選択肢 B を採用する。既存の QuickView をラップした `TaskPreview` を薄く作り、タスク固有の権限チェックと空状態のみを新規実装する。描画は既存パスに委譲。"].join(`
`),missing:!1,blocks:N},F={status:`ready`,workspacePath:O,tree:j,error:null},I={status:`ready`,workspacePath:O,specId:A.id,fileKey:`impl`,document:P,error:null},L=[{id:k(`cmt_story_open_1`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:c(M),textSnippet:`scorer.ts L16 · calcFu`,charRange:{start:0,end:14}},body:`ctx が undefined のとき落ちる。null チェックいる?`,status:`open`,createdAt:`2026-07-25T12:00:00Z`,updatedAt:`2026-07-25T12:00:00Z`},{id:k(`cmt_story_open_2`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:c(M),textSnippet:`pinfu.ts L10 · checkAllRuns`,charRange:{start:0,end:14}},body:`agent-a5b8a0d3 は shapes を Map で持ってた。どっちが速いか計測したい`,status:`open`,createdAt:`2026-07-25T10:00:00Z`,updatedAt:`2026-07-25T10:00:00Z`},{id:k(`cmt_story_open_3`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:c(M),textSnippet:`scorer.ts L14 · score()`,charRange:{start:0,end:14}},body:`戻り値の Result 型、hands/*.ts と重複してるフィールドあり`,status:`open`,createdAt:`2026-07-25T08:00:00Z`,updatedAt:`2026-07-25T08:00:00Z`},{id:k(`cmt_story_resolved`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:c(M),textSnippet:`implementation decision`,charRange:{start:0,end:14}},body:`描画経路の統合方針を反映済み。`,status:`resolved`,createdAt:`2026-07-24T08:00:00Z`,updatedAt:`2026-07-24T09:00:00Z`}],R={component:C,parameters:{layout:`fullscreen`},decorators:[e=>(0,E.jsx)(`div`,{style:{height:`100vh`},children:(0,E.jsx)(e,{})})],argTypes:{toolbar:{control:!1},sidebar:{control:!1},tabs:{control:!1},viewer:{control:!1},comments:{control:!1}}},z=w({treeState:F,documentState:I,selectedSpec:A,selectedFileKey:`impl`,workspaceInput:O,workspaceStatusPath:O}),B={name:`Specs`,args:z},V={args:{...z,leftWidth:420,commentsWidth:560}},H={args:{...z,leftOpen:!1,commentsOpen:!1}},U={args:w({treeState:F,documentState:I,selectedSpec:A,selectedFileKey:`impl`,workspaceInput:O,workspaceStatusPath:O,reviewMode:`diff`})},W={args:w({treeState:F,documentState:I,selectedSpec:A,selectedFileKey:`impl`,workspaceInput:O,workspaceStatusPath:O,archivingSpecId:A.id})},G={args:w({treeState:{status:`loading`,workspacePath:O,tree:null,error:null},documentState:{status:`loading`,workspacePath:O,specId:A.id,fileKey:`impl`,document:null,error:null},selectedSpec:A,selectedFileKey:`impl`,workspaceInput:O,workspaceStatusPath:O,isWorkspaceLoading:!0})},K={args:w({treeState:{status:`empty`,workspacePath:O,tree:{specs:[]},error:null},documentState:{status:`idle`,workspacePath:O,specId:null,fileKey:null,document:null,error:null},selectedSpec:null,selectedFileKey:null,workspaceInput:O,workspaceStatusPath:O})},q={args:w({treeState:{status:`error`,workspacePath:O,tree:null,error:{feature:`specs`,code:`specTreeScan`,message:`Spec directory could not be scanned.`,cause:{command:`list_specs`,code:`specTreeScan`,message:`Spec directory could not be scanned.`,raw:`Spec directory could not be scanned.`}}},documentState:{status:`error`,workspacePath:O,specId:A.id,fileKey:`impl`,document:null,error:{feature:`specs`,code:`markdownRead`,message:`Markdown file could not be read.`,cause:{command:`read_spec_file`,code:`markdownRead`,message:`Markdown file could not be read.`,raw:`Markdown file could not be read.`}}},selectedSpec:A,selectedFileKey:`impl`,workspaceInput:O,workspaceStatusPath:O,workspaceErrorMessage:`Workspace loaded with file warnings.`})},B.parameters={...B.parameters,docs:{...B.parameters?.docs,source:{originalSource:`{
  name: "Specs",
  args: readySpecsArgs
}`,...B.parameters?.docs?.source}}},V.parameters={...V.parameters,docs:{...V.parameters?.docs,source:{originalSource:`{
  args: {
    ...readySpecsArgs,
    leftWidth: 420,
    commentsWidth: 560
  }
}`,...V.parameters?.docs?.source}}},H.parameters={...H.parameters,docs:{...H.parameters?.docs,source:{originalSource:`{
  args: {
    ...readySpecsArgs,
    leftOpen: false,
    commentsOpen: false
  }
}`,...H.parameters?.docs?.source}}},U.parameters={...U.parameters,docs:{...U.parameters?.docs,source:{originalSource:`{
  args: createShellArgs({
    treeState: readyTreeState,
    documentState: readyDocumentState,
    selectedSpec: sampleSpec,
    selectedFileKey: "impl",
    workspaceInput: workspacePath,
    workspaceStatusPath: workspacePath,
    reviewMode: "diff"
  })
}`,...U.parameters?.docs?.source}}},W.parameters={...W.parameters,docs:{...W.parameters?.docs,source:{originalSource:`{
  args: createShellArgs({
    treeState: readyTreeState,
    documentState: readyDocumentState,
    selectedSpec: sampleSpec,
    selectedFileKey: "impl",
    workspaceInput: workspacePath,
    workspaceStatusPath: workspacePath,
    archivingSpecId: sampleSpec.id
  })
}`,...W.parameters?.docs?.source}}},G.parameters={...G.parameters,docs:{...G.parameters?.docs,source:{originalSource:`{
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
}`,...G.parameters?.docs?.source}}},K.parameters={...K.parameters,docs:{...K.parameters?.docs,source:{originalSource:`{
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
}`,...K.parameters?.docs?.source}}},q.parameters={...q.parameters,docs:{...q.parameters?.docs,source:{originalSource:`{
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
}`,...q.parameters?.docs?.source}}},J=[`Default`,`AllProps`,`EdgeCases`,`Diff`,`Archiving`,`Loading`,`Empty`,`Error`]}))();export{V as AllProps,W as Archiving,B as Default,U as Diff,H as EdgeCases,K as Empty,q as Error,G as Loading,J as __namedExportsOrder,R as default};