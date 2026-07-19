import{a as e,n as t}from"./chunk-DnJy8xQt.js";import{n}from"./iframe-DRQZHJbP.js";import{t as r}from"./CommentSidebar-HolnpTvQ.js";import{r as i,t as a}from"./preferences-DPvkbDim.js";import{t as o}from"./jsx-runtime-BpX3lQ6F.js";import{t as s}from"./MarkdownViewer-DJoyxRIi.js";import{a as c,n as l,t as u}from"./commentId-D2JE7cv5.js";import{t as d}from"./SpecTabs-SsYxI6Wo.js";import{s as f}from"./specTreeState-CpXvwble.js";import{t as p}from"./comments-BHnLzz5F.js";import{a as m,t as h}from"./workspace-DXHOcNBW.js";import{n as g,t as _}from"./WorkspaceLayout-CwI7mSnf.js";import{t as v}from"./WorkspaceSidebarSection-BpNC58BI.js";import{t as y}from"./WorkspaceToolbar-DnC7EESw.js";function b(e){let{toolbar:t,leftHeader:n,sidebar:r,tabs:i,viewer:a,comments:o,leftOpen:s,leftWidth:c,leftMinWidth:l,leftMaxWidth:u,onOpenLeft:d,onCloseLeft:f,onLeftWidthChange:p,commentsOpen:m,commentsWidth:h,commentsMinWidth:g,commentsMaxWidth:v,onOpenComments:y,onCloseComments:b,onCommentsWidthChange:x}=e,[w,T]=(0,S.useState)(s??!0),[E,D]=(0,S.useState)(c??268),[O,k]=(0,S.useState)(m??!0),[A,j]=(0,S.useState)(h??360);return(0,C.jsxs)(_.Root,{leftNavigation:{isOpen:w,width:E,minWidth:l,maxWidth:u,onOpen:()=>{T(!0),d?.()},onClose:()=>{T(!1),f?.()},onWidthChange:e=>{D(e),p?.(e)}},commentsSidebar:{isOpen:O,width:A,minWidth:g,maxWidth:v,onOpen:()=>{k(!0),y?.()},onClose:()=>{k(!1),b?.()},onWidthChange:e=>{j(e),x?.(e)}},children:[(0,C.jsx)(_.LeftNavigation,{header:n,children:r}),(0,C.jsxs)(_.Main,{children:[(0,C.jsx)(_.Toolbar,{children:t}),(0,C.jsx)(_.Tabs,{children:i}),(0,C.jsx)(_.Viewer,{children:a})]}),(0,C.jsx)(_.Comments,{children:o})]})}function x({treeState:e,documentState:t,selectedSpec:n,selectedFileKey:a,workspaceInput:o,workspaceStatusPath:c,workspaceErrorMessage:l=void 0,isWorkspaceLoading:u=!1,archivingSpecId:p=null}){let m=n?.files.find(e=>e.key===a)??null;return{leftOpen:!0,leftHeader:(0,C.jsxs)(`div`,{className:`left-navigation-brand`,children:[(0,C.jsx)(`span`,{className:`left-navigation-brand__mark`,"aria-hidden":`true`,children:`S`}),(0,C.jsxs)(`span`,{className:`left-navigation-brand__copy`,children:[(0,C.jsx)(`strong`,{children:`Spec Reviewer`}),(0,C.jsx)(`span`,{title:c??`ワークスペース未選択`,children:c??`ワークスペース未選択`})]})]}),toolbar:(0,C.jsx)(i,{children:(0,C.jsx)(y,{workspacePath:c,inputValue:o,isLoading:u,isBrowsing:!1,errorMessage:l??null,canRefresh:n!==null&&a!==null,onInputChange:w(),onBrowse:w(),onLoad:w(),onRefresh:w(),onReset:w()})}),sidebar:(0,C.jsxs)(`div`,{className:`left-navigation-panel`,children:[(0,C.jsx)(v,{currentWorkspacePath:c,isOpen:!0,isBusy:u,recentWorkspaces:[{path:T,displayName:`plugin-workspace`,kind:`plugin-workspace`,lastOpenedAt:`2026-05-06T00:00:00.000Z`},{path:`/workspace/spec-reviewer-worktree`,displayName:`plugin-worktree`,kind:`plugin-worktree`,lastOpenedAt:`2026-05-05T00:00:00.000Z`}],onBrowse:w(),onToggleOpen:w(),onOpenWorkspace:w(),onRemoveWorkspace:w()}),(0,C.jsx)(f,{state:e,selectedSpecId:n?.id??null,archivingSpecId:p,isLoading:p!==null,onSelectSpec:w(),onArchiveSpec:w(),onReload:w()})]}),tabs:(0,C.jsx)(d,{spec:n,selectedFileKey:a,onSelectFile:w()}),viewer:(0,C.jsx)(s,{state:t,selectedSpecLabel:n?.label??null,selectedFileLabel:m?.label??null,comments:N,activeCommentId:E(`cmt_story_open`),onReload:w(),onSelectComment:w()}),comments:(0,C.jsx)(r,{listState:{status:`ready`,comments:N,error:null},operationState:{status:`idle`,operation:null,commentId:null,error:null},activeCommentId:E(`cmt_story_open`),onSelectComment:w(),onResolveComment:w(),onReopenComment:w(),onDeleteComment:w(),onUpdateComment:w(),onReload:w()})}}var S,C,w,T,E,D,O,k,A,j,M,N,P,F,I,L,R,z,B;t((()=>{S=e(n(),1),p(),l(),a(),m(),h(),g(),C=o(),{fn:w}=__STORYBOOK_MODULE_TEST__,T=`/workspace/spec-reviewer`,E=u.fromString,D={id:`phase-1-viewer`,label:`Phase 1 Viewer`,files:[{key:`impl`,label:`Implementation`,fileName:`implementation-plan.md`,status:`missing`},{key:`tasks`,label:`Tasks`,fileName:`tasks.md`,status:`present`},{key:`tech-reference`,label:`Tech Reference`,fileName:`tech-reference.html`,status:`missing`,format:`html`},{key:`test-cases`,label:`Test Cases`,fileName:`test-cases.html`,status:`missing`,format:`html`},{key:`requirements`,label:`Requirements`,fileName:`requirements.html`,status:`present`}],children:[{id:`phase-1-comments`,label:`Phase 1 Comments`,files:[{key:`requirements`,label:`Requirements`,fileName:`requirements.md`,status:`present`}],children:[]}]},O={specs:[D]},k=[{blockType:`heading`,blockIndex:0,textHash:c(`P1.14 Markdown Rendering`),textSnippet:`P1.14 Markdown Rendering`,sourceRange:null},{blockType:`block_quote`,blockIndex:1,textHash:c(`Render review planning documents with anchors ready for comments.`),textSnippet:`Render review planning documents with anchors ready for comments.`,sourceRange:null},{blockType:`heading`,blockIndex:2,textHash:c(`Acceptance`),textSnippet:`Acceptance`,sourceRange:null},{blockType:`list_item`,blockIndex:3,textHash:c(`Headings and lists`),textSnippet:`Headings and lists`,sourceRange:null},{blockType:`list_item`,blockIndex:4,textHash:c(`Fenced code blocks`),textSnippet:`Fenced code blocks`,sourceRange:null},{blockType:`list_item`,blockIndex:5,textHash:c(`Comment behavior follows in P1.15`),textSnippet:`Comment behavior follows in P1.15`,sourceRange:null},{blockType:`code_block`,blockIndex:6,textHash:c(`const blockType = "heading";`),textSnippet:`const blockType = "heading";`,sourceRange:null},{blockType:`table`,blockIndex:7,textHash:c(`Element Status GFM table Ready External link Docs`),textSnippet:`Element Status GFM table Ready External link Docs`,sourceRange:null}],A={key:`tasks`,path:`/workspace/spec-reviewer/docs/plans/tasks/phase-1-viewer/p1-13-layout-components.md`,contents:[`# P1.14 Markdown Rendering`,``,`> Render review planning documents with anchors ready for comments.`,``,`## Acceptance`,``,`- [x] Headings and lists`,`- [x] Fenced code blocks`,`- [ ] Comment behavior follows in P1.15`,``,"```ts",`const blockType = "heading";`,"```",``,`| Element | Status |`,`| --- | --- |`,`| GFM table | Ready |`,`| External link | [Docs](https://example.com/docs) |`].join(`
`),missing:!1,blocks:k},j={status:`ready`,workspacePath:T,tree:O,error:null},M={status:`ready`,workspacePath:T,specId:D.id,fileKey:`tasks`,document:A,error:null},N=[{id:E(`cmt_story_open`),anchor:{fileKey:`tasks`,blockType:`list_item`,blockIndex:5,textHash:c(`Comment behavior follows in P1.15`),textSnippet:`Comment behavior follows in P1.15`,charRange:{start:0,end:34}},body:`Check whether this note should move to Phase 2.`,status:`open`,createdAt:`2026-05-05T10:00:00Z`,updatedAt:`2026-05-05T10:15:00Z`},{id:E(`cmt_story_resolved`),anchor:{fileKey:`tasks`,blockType:`heading`,blockIndex:0,textHash:c(`P1.14 Markdown Rendering`),textSnippet:`P1.14 Markdown Rendering`,charRange:{start:0,end:25}},body:`Rendering checklist is already reflected in the plan.`,status:`resolved`,createdAt:`2026-05-05T11:00:00Z`,updatedAt:`2026-05-05T11:30:00Z`}],P={component:b,argTypes:{toolbar:{control:!1},sidebar:{control:!1},tabs:{control:!1},viewer:{control:!1},comments:{control:!1}}},F={args:x({treeState:j,documentState:M,selectedSpec:D,selectedFileKey:`tasks`,workspaceInput:T,workspaceStatusPath:T})},I={args:x({treeState:j,documentState:M,selectedSpec:D,selectedFileKey:`tasks`,workspaceInput:T,workspaceStatusPath:T,archivingSpecId:D.id})},L={args:x({treeState:{status:`loading`,workspacePath:T,tree:null,error:null},documentState:{status:`loading`,workspacePath:T,specId:D.id,fileKey:`tasks`,document:null,error:null},selectedSpec:D,selectedFileKey:`tasks`,workspaceInput:T,workspaceStatusPath:T,isWorkspaceLoading:!0})},R={args:x({treeState:{status:`empty`,workspacePath:T,tree:{specs:[]},error:null},documentState:{status:`idle`,workspacePath:T,specId:null,fileKey:null,document:null,error:null},selectedSpec:null,selectedFileKey:null,workspaceInput:T,workspaceStatusPath:T})},z={args:x({treeState:{status:`error`,workspacePath:T,tree:null,error:{feature:`specs`,code:`specTreeScan`,message:`Spec directory could not be scanned.`,cause:{command:`list_specs`,code:`specTreeScan`,message:`Spec directory could not be scanned.`,raw:`Spec directory could not be scanned.`}}},documentState:{status:`error`,workspacePath:T,specId:D.id,fileKey:`tasks`,document:null,error:{feature:`specs`,code:`markdownRead`,message:`Markdown file could not be read.`,cause:{command:`read_spec_file`,code:`markdownRead`,message:`Markdown file could not be read.`,raw:`Markdown file could not be read.`}}},selectedSpec:D,selectedFileKey:`tasks`,workspaceInput:T,workspaceStatusPath:T,workspaceErrorMessage:`Workspace loaded with file warnings.`})},F.parameters={...F.parameters,docs:{...F.parameters?.docs,source:{originalSource:`{
  args: createShellArgs({
    treeState: readyTreeState,
    documentState: readyDocumentState,
    selectedSpec: sampleSpec,
    selectedFileKey: "tasks",
    workspaceInput: workspacePath,
    workspaceStatusPath: workspacePath
  })
}`,...F.parameters?.docs?.source}}},I.parameters={...I.parameters,docs:{...I.parameters?.docs,source:{originalSource:`{
  args: createShellArgs({
    treeState: readyTreeState,
    documentState: readyDocumentState,
    selectedSpec: sampleSpec,
    selectedFileKey: "tasks",
    workspaceInput: workspacePath,
    workspaceStatusPath: workspacePath,
    archivingSpecId: sampleSpec.id
  })
}`,...I.parameters?.docs?.source}}},L.parameters={...L.parameters,docs:{...L.parameters?.docs,source:{originalSource:`{
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
}`,...L.parameters?.docs?.source}}},R.parameters={...R.parameters,docs:{...R.parameters?.docs,source:{originalSource:`{
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
}`,...R.parameters?.docs?.source}}},z.parameters={...z.parameters,docs:{...z.parameters?.docs,source:{originalSource:`{
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
}`,...z.parameters?.docs?.source}}},B=[`Default`,`Archiving`,`Loading`,`Empty`,`Error`]}))();export{I as Archiving,F as Default,R as Empty,z as Error,L as Loading,B as __namedExportsOrder,P as default};