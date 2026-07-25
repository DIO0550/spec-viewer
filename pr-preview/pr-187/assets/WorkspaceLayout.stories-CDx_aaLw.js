import{a as e,n as t}from"./chunk-DnJy8xQt.js";import{n}from"./iframe-D2_4M7Bq.js";import{t as r}from"./CommentSidebar-DSzCETrX.js";import{r as i,t as a}from"./preferences-A03gPv9G.js";import{t as o}from"./jsx-runtime-BpX3lQ6F.js";import{t as s}from"./MarkdownViewer-BJut_Thn.js";import{a as c,n as l,t as u}from"./commentId-D2JE7cv5.js";import{t as d}from"./SpecTabs-CnZsAMvN.js";import{s as f}from"./specTreeState-NGLpRvIY.js";import{a as p,o as m,t as h}from"./workspace-driSInU-.js";import{t as g}from"./comments-DkRpjNiW.js";import{t as _}from"./DiffWorkspace-C76TcOG7.js";import{t as v}from"./ReviewModeToolbar-BkeNbttq.js";import{n as y,t as b}from"./WorkspaceLayout-BC2Fei5g.js";import{t as x}from"./WorkspaceSidebarSection-CQ-KePKV.js";import{t as S}from"./WorkspaceToolbar-ChF3DIbA.js";function C(e){let{toolbar:t,leftHeader:n,sidebar:r,tabs:i,viewer:a,comments:o,leftOpen:s,leftWidth:c,leftMinWidth:l,leftMaxWidth:u,onOpenLeft:d,onCloseLeft:f,onLeftWidthChange:p,commentsOpen:m,commentsWidth:h,commentsMinWidth:g,commentsMaxWidth:_,onOpenComments:v,onCloseComments:y,onCommentsWidthChange:x}=e,[S,C]=(0,T.useState)(s??!0),[w,D]=(0,T.useState)(c??240),[O,k]=(0,T.useState)(m??!0),[A,j]=(0,T.useState)(h??300);return(0,E.jsxs)(b.Root,{leftNavigation:{isOpen:S,width:w,minWidth:l,maxWidth:u,onOpen:()=>{C(!0),d?.()},onClose:()=>{C(!1),f?.()},onWidthChange:e=>{D(e),p?.(e)}},commentsSidebar:{isOpen:O,width:A,minWidth:g,maxWidth:_,onOpen:()=>{k(!0),v?.()},onClose:()=>{k(!1),y?.()},onWidthChange:e=>{j(e),x?.(e)}},children:[(0,E.jsx)(b.LeftNavigation,{header:n,children:r}),(0,E.jsxs)(b.Main,{children:[(0,E.jsx)(b.Toolbar,{children:t}),(0,E.jsx)(b.Tabs,{children:i}),(0,E.jsx)(b.Viewer,{children:a})]}),(0,E.jsx)(b.Comments,{children:o})]})}function w({treeState:e,documentState:t,selectedSpec:n,selectedFileKey:a,workspaceInput:o,workspaceStatusPath:c,workspaceErrorMessage:l=void 0,isWorkspaceLoading:u=!1,archivingSpecId:p=null,reviewMode:m=`specs`}){let h=n?.files.find(e=>e.key===a)??null,g;return g=m===`diff`?(0,E.jsx)(_,{}):(0,E.jsxs)(`div`,{className:`specs-workspace`,children:[(0,E.jsx)(`aside`,{className:`specs-workspace__navigation`,"aria-label":`Specs`,children:(0,E.jsx)(f,{state:e,selectedSpecId:n?.id??null,archivingSpecId:p,isLoading:p!==null,onSelectSpec:D(),onArchiveSpec:D(),onReload:D()})}),(0,E.jsxs)(`section`,{className:`specs-workspace__document`,"aria-label":`Spec document`,children:[(0,E.jsx)(d,{spec:n,selectedFileKey:a,onSelectFile:D()}),(0,E.jsx)(`div`,{className:`specs-workspace__viewer`,children:(0,E.jsx)(s,{state:t,selectedSpecLabel:n?.label??null,selectedFileLabel:h?.label??null,comments:I,activeCommentId:k(`cmt_story_open`),onReload:D(),onSelectComment:D()})})]})]}),{leftOpen:!0,leftHeader:(0,E.jsxs)(`div`,{className:`left-navigation-brand`,children:[(0,E.jsx)(`span`,{className:`left-navigation-brand__mark`,"aria-hidden":`true`,children:`S`}),(0,E.jsxs)(`span`,{className:`left-navigation-brand__copy`,children:[(0,E.jsx)(`strong`,{children:`Spec Reviewer`}),(0,E.jsx)(`span`,{title:c??`ワークスペース未選択`,children:c??`ワークスペース未選択`})]})]}),toolbar:(0,E.jsx)(i,{children:(0,E.jsx)(S,{workspacePath:c,inputValue:o,isLoading:u,isBrowsing:!1,errorMessage:l??null,canRefresh:n!==null&&a!==null,onInputChange:D(),onBrowse:D(),onLoad:D(),onRefresh:D(),onReset:D()})}),sidebar:(0,E.jsx)(`div`,{className:`left-navigation-panel`,children:(0,E.jsx)(x,{currentWorkspacePath:c,isOpen:!0,isBusy:u,recentWorkspaces:[{path:O,displayName:`plugin-workspace`,kind:`plugin-workspace`,lastOpenedAt:`2026-05-06T00:00:00.000Z`},{path:`/workspace/spec-reviewer-worktree`,displayName:`plugin-worktree`,kind:`plugin-worktree`,lastOpenedAt:`2026-05-05T00:00:00.000Z`}],onBrowse:D(),onToggleOpen:D(),onOpenWorkspace:D(),onRemoveWorkspace:D()})}),tabs:(0,E.jsx)(v,{mode:m,fileLabel:h?.label??`ファイル未選択`,onModeChange:D()}),viewer:g,comments:(0,E.jsx)(r,{listState:{status:`ready`,comments:I,error:null},operationState:{status:`idle`,operation:null,commentId:null,error:null},activeCommentId:k(`cmt_story_open`),onSelectComment:D(),onResolveComment:D(),onReopenComment:D(),onDeleteComment:D(),onUpdateComment:D(),onReload:D()})}}var T,E,D,O,k,A,j,M,N,P,F,I,L,R,z,B,V,H,U,W,G,K,q;t((()=>{T=e(n(),1),g(),l(),p(),a(),m(),h(),y(),E=o(),{fn:D}=__STORYBOOK_MODULE_TEST__,O=`/workspace/spec-reviewer`,k=u.fromString,A={id:`phase-1-viewer`,label:`Phase 1 Viewer`,files:[{key:`impl`,label:`Implementation`,fileName:`implementation-plan.md`,status:`missing`},{key:`tasks`,label:`Tasks`,fileName:`tasks.md`,status:`present`},{key:`tech-reference`,label:`Tech Reference`,fileName:`tech-reference.html`,status:`missing`,format:`html`},{key:`test-cases`,label:`Test Cases`,fileName:`test-cases.html`,status:`missing`,format:`html`},{key:`requirements`,label:`Requirements`,fileName:`requirements.html`,status:`present`}],children:[{id:`phase-1-comments`,label:`Phase 1 Comments`,files:[{key:`requirements`,label:`Requirements`,fileName:`requirements.md`,status:`present`}],children:[]}]},j={specs:[A]},M=[{blockType:`heading`,blockIndex:0,textHash:c(`P1.14 Markdown Rendering`),textSnippet:`P1.14 Markdown Rendering`,sourceRange:null},{blockType:`block_quote`,blockIndex:1,textHash:c(`Render review planning documents with anchors ready for comments.`),textSnippet:`Render review planning documents with anchors ready for comments.`,sourceRange:null},{blockType:`heading`,blockIndex:2,textHash:c(`Acceptance`),textSnippet:`Acceptance`,sourceRange:null},{blockType:`list_item`,blockIndex:3,textHash:c(`Headings and lists`),textSnippet:`Headings and lists`,sourceRange:null},{blockType:`list_item`,blockIndex:4,textHash:c(`Fenced code blocks`),textSnippet:`Fenced code blocks`,sourceRange:null},{blockType:`list_item`,blockIndex:5,textHash:c(`Comment behavior follows in P1.15`),textSnippet:`Comment behavior follows in P1.15`,sourceRange:null},{blockType:`code_block`,blockIndex:6,textHash:c(`const blockType = "heading";`),textSnippet:`const blockType = "heading";`,sourceRange:null},{blockType:`table`,blockIndex:7,textHash:c(`Element Status GFM table Ready External link Docs`),textSnippet:`Element Status GFM table Ready External link Docs`,sourceRange:null}],N={key:`tasks`,path:`/workspace/spec-reviewer/docs/plans/tasks/phase-1-viewer/p1-13-layout-components.md`,contents:[`# P1.14 Markdown Rendering`,``,`> Render review planning documents with anchors ready for comments.`,``,`## Acceptance`,``,`- [x] Headings and lists`,`- [x] Fenced code blocks`,`- [ ] Comment behavior follows in P1.15`,``,"```ts",`const blockType = "heading";`,"```",``,`| Element | Status |`,`| --- | --- |`,`| GFM table | Ready |`,`| External link | [Docs](https://example.com/docs) |`].join(`
`),missing:!1,blocks:M},P={status:`ready`,workspacePath:O,tree:j,error:null},F={status:`ready`,workspacePath:O,specId:A.id,fileKey:`tasks`,document:N,error:null},I=[{id:k(`cmt_story_open`),anchor:{fileKey:`tasks`,blockType:`list_item`,blockIndex:5,textHash:c(`Comment behavior follows in P1.15`),textSnippet:`Comment behavior follows in P1.15`,charRange:{start:0,end:34}},body:`Check whether this note should move to Phase 2.`,status:`open`,createdAt:`2026-05-05T10:00:00Z`,updatedAt:`2026-05-05T10:15:00Z`},{id:k(`cmt_story_resolved`),anchor:{fileKey:`tasks`,blockType:`heading`,blockIndex:0,textHash:c(`P1.14 Markdown Rendering`),textSnippet:`P1.14 Markdown Rendering`,charRange:{start:0,end:25}},body:`Rendering checklist is already reflected in the plan.`,status:`resolved`,createdAt:`2026-05-05T11:00:00Z`,updatedAt:`2026-05-05T11:30:00Z`}],L={component:C,parameters:{layout:`fullscreen`},decorators:[e=>(0,E.jsx)(`div`,{style:{height:`100vh`},children:(0,E.jsx)(e,{})})],argTypes:{toolbar:{control:!1},sidebar:{control:!1},tabs:{control:!1},viewer:{control:!1},comments:{control:!1}}},R=w({treeState:P,documentState:F,selectedSpec:A,selectedFileKey:`tasks`,workspaceInput:O,workspaceStatusPath:O}),z={name:`Specs`,args:R},B={args:{...R,leftWidth:420,commentsWidth:560}},V={args:{...R,leftOpen:!1,commentsOpen:!1}},H={args:w({treeState:P,documentState:F,selectedSpec:A,selectedFileKey:`tasks`,workspaceInput:O,workspaceStatusPath:O,reviewMode:`diff`})},U={args:w({treeState:P,documentState:F,selectedSpec:A,selectedFileKey:`tasks`,workspaceInput:O,workspaceStatusPath:O,archivingSpecId:A.id})},W={args:w({treeState:{status:`loading`,workspacePath:O,tree:null,error:null},documentState:{status:`loading`,workspacePath:O,specId:A.id,fileKey:`tasks`,document:null,error:null},selectedSpec:A,selectedFileKey:`tasks`,workspaceInput:O,workspaceStatusPath:O,isWorkspaceLoading:!0})},G={args:w({treeState:{status:`empty`,workspacePath:O,tree:{specs:[]},error:null},documentState:{status:`idle`,workspacePath:O,specId:null,fileKey:null,document:null,error:null},selectedSpec:null,selectedFileKey:null,workspaceInput:O,workspaceStatusPath:O})},K={args:w({treeState:{status:`error`,workspacePath:O,tree:null,error:{feature:`specs`,code:`specTreeScan`,message:`Spec directory could not be scanned.`,cause:{command:`list_specs`,code:`specTreeScan`,message:`Spec directory could not be scanned.`,raw:`Spec directory could not be scanned.`}}},documentState:{status:`error`,workspacePath:O,specId:A.id,fileKey:`tasks`,document:null,error:{feature:`specs`,code:`markdownRead`,message:`Markdown file could not be read.`,cause:{command:`read_spec_file`,code:`markdownRead`,message:`Markdown file could not be read.`,raw:`Markdown file could not be read.`}}},selectedSpec:A,selectedFileKey:`tasks`,workspaceInput:O,workspaceStatusPath:O,workspaceErrorMessage:`Workspace loaded with file warnings.`})},z.parameters={...z.parameters,docs:{...z.parameters?.docs,source:{originalSource:`{
  name: "Specs",
  args: readySpecsArgs
}`,...z.parameters?.docs?.source}}},B.parameters={...B.parameters,docs:{...B.parameters?.docs,source:{originalSource:`{
  args: {
    ...readySpecsArgs,
    leftWidth: 420,
    commentsWidth: 560
  }
}`,...B.parameters?.docs?.source}}},V.parameters={...V.parameters,docs:{...V.parameters?.docs,source:{originalSource:`{
  args: {
    ...readySpecsArgs,
    leftOpen: false,
    commentsOpen: false
  }
}`,...V.parameters?.docs?.source}}},H.parameters={...H.parameters,docs:{...H.parameters?.docs,source:{originalSource:`{
  args: createShellArgs({
    treeState: readyTreeState,
    documentState: readyDocumentState,
    selectedSpec: sampleSpec,
    selectedFileKey: "tasks",
    workspaceInput: workspacePath,
    workspaceStatusPath: workspacePath,
    reviewMode: "diff"
  })
}`,...H.parameters?.docs?.source}}},U.parameters={...U.parameters,docs:{...U.parameters?.docs,source:{originalSource:`{
  args: createShellArgs({
    treeState: readyTreeState,
    documentState: readyDocumentState,
    selectedSpec: sampleSpec,
    selectedFileKey: "tasks",
    workspaceInput: workspacePath,
    workspaceStatusPath: workspacePath,
    archivingSpecId: sampleSpec.id
  })
}`,...U.parameters?.docs?.source}}},W.parameters={...W.parameters,docs:{...W.parameters?.docs,source:{originalSource:`{
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
      fileKey: "tasks",
      document: null,
      error: null
    },
    selectedSpec: sampleSpec,
    selectedFileKey: "tasks",
    workspaceInput: workspacePath,
    workspaceStatusPath: workspacePath,
    isWorkspaceLoading: true
  })
}`,...W.parameters?.docs?.source}}},G.parameters={...G.parameters,docs:{...G.parameters?.docs,source:{originalSource:`{
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
}`,...G.parameters?.docs?.source}}},K.parameters={...K.parameters,docs:{...K.parameters?.docs,source:{originalSource:`{
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
      fileKey: "tasks",
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
    selectedFileKey: "tasks",
    workspaceInput: workspacePath,
    workspaceStatusPath: workspacePath,
    workspaceErrorMessage: "Workspace loaded with file warnings."
  })
}`,...K.parameters?.docs?.source}}},q=[`Default`,`AllProps`,`EdgeCases`,`Diff`,`Archiving`,`Loading`,`Empty`,`Error`]}))();export{B as AllProps,U as Archiving,z as Default,H as Diff,V as EdgeCases,G as Empty,K as Error,W as Loading,q as __namedExportsOrder,L as default};