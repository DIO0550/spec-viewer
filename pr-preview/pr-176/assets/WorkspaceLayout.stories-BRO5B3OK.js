import{a as e,n as t}from"./chunk-DnJy8xQt.js";import{n}from"./iframe-C4nrLJKr.js";import{M as r,N as i,P as a,a as o,b as s,d as c,h as l,j as u,l as d,o as f,t as p,u as m}from"./workspace-BJApp5f4.js";import{t as h}from"./jsx-runtime-B-hFyic3.js";import{l as g,n as _,r as v,t as y}from"./comment-CvI1irwS.js";function b(e){let{toolbar:t,leftHeader:n,sidebar:r,tabs:i,viewer:a,comments:o,leftOpen:s,leftWidth:c,leftMinWidth:l,leftMaxWidth:u,onOpenLeft:f,onCloseLeft:p,onLeftWidthChange:m,commentsOpen:h,commentsWidth:g,commentsMinWidth:_,commentsMaxWidth:v,onOpenComments:y,onCloseComments:b,onCommentsWidthChange:x}=e,[w,T]=(0,S.useState)(s??!0),[E,D]=(0,S.useState)(c??268),[O,k]=(0,S.useState)(h??!0),[A,j]=(0,S.useState)(g??360);return(0,C.jsxs)(d.Root,{leftNavigation:{isOpen:w,width:E,minWidth:l,maxWidth:u,onOpen:()=>{T(!0),f?.()},onClose:()=>{T(!1),p?.()},onWidthChange:e=>{D(e),m?.(e)}},commentsSidebar:{isOpen:O,width:A,minWidth:_,maxWidth:v,onOpen:()=>{k(!0),y?.()},onClose:()=>{k(!1),b?.()},onWidthChange:e=>{j(e),x?.(e)}},children:[(0,C.jsx)(d.LeftNavigation,{header:n,children:r}),(0,C.jsxs)(d.Main,{children:[(0,C.jsx)(d.Toolbar,{children:t}),(0,C.jsx)(d.Tabs,{children:i}),(0,C.jsx)(d.Viewer,{children:a})]}),(0,C.jsx)(d.Comments,{children:o})]})}function x({treeState:e,documentState:t,selectedSpec:n,selectedFileKey:i,workspaceInput:s,workspaceStatusPath:c,workspaceErrorMessage:d=void 0,isWorkspaceLoading:p=!1,archivingSpecId:m=null}){let h=n?.files.find(e=>e.key===i)??null;return{leftOpen:!0,leftHeader:(0,C.jsxs)(`div`,{className:`left-navigation-brand`,children:[(0,C.jsx)(`span`,{className:`left-navigation-brand__mark`,"aria-hidden":`true`,children:`S`}),(0,C.jsxs)(`span`,{className:`left-navigation-brand__copy`,children:[(0,C.jsx)(`strong`,{children:`Spec Reviewer`}),(0,C.jsx)(`span`,{title:c??`ワークスペース未選択`,children:c??`ワークスペース未選択`})]})]}),toolbar:(0,C.jsx)(a,{children:(0,C.jsx)(o,{workspacePath:c,inputValue:s,isLoading:p,isBrowsing:!1,errorMessage:d??null,canRefresh:n!==null&&i!==null,onInputChange:w(),onBrowse:w(),onLoad:w(),onRefresh:w(),onReset:w()})}),sidebar:(0,C.jsxs)(`div`,{className:`left-navigation-panel`,children:[(0,C.jsx)(f,{currentWorkspacePath:c,isOpen:!1,isBusy:p,recentWorkspaces:[{path:T,displayName:`spec-reviewer`,kind:`plugin-workspace`,lastOpenedAt:`2026-05-06T00:00:00.000Z`},{path:`/workspace/legacy-spec-skill`,displayName:`legacy-spec-skill`,kind:`spec-skill`,lastOpenedAt:`2026-05-05T00:00:00.000Z`}],onBrowse:w(),onToggleOpen:w(),onOpenWorkspace:w(),onRemoveWorkspace:w()}),(0,C.jsx)(u,{state:e,selectedSpecId:n?.id??null,archivingSpecId:m,isLoading:m!==null,onSelectSpec:w(),onArchiveSpec:w(),onReload:w()})]}),tabs:(0,C.jsx)(r,{spec:n,selectedFileKey:i,onSelectFile:w()}),viewer:(0,C.jsx)(v,{state:t,selectedSpecLabel:n?.label??null,selectedFileLabel:h?.label??null,comments:M,activeCommentId:E(`cmt_story_open`),onReload:w(),onSelectComment:w()}),comments:(0,C.jsx)(l,{listState:{status:`ready`,comments:M,error:null},operationState:{status:`idle`,operation:null,commentId:null,error:null},activeCommentId:E(`cmt_story_open`),onSelectComment:w(),onResolveComment:w(),onReopenComment:w(),onDeleteComment:w(),onUpdateComment:w(),onReload:w()})}}var S,C,w,T,E,D,O,k,A,j,M,N,P,F,I,L,R,z;t((()=>{S=e(n(),1),c(),_(),i(),s(),p(),m(),C=h(),{fn:w}=__STORYBOOK_MODULE_TEST__,T=`/workspace/spec-reviewer`,E=y.fromString,D={id:`phase-1-viewer`,label:`Phase 1 Viewer`,files:[{key:`impl`,label:`Implementation`,fileName:`implementation-plan.md`,status:`missing`},{key:`tasks`,label:`Tasks`,fileName:`tasks.md`,status:`present`},{key:`tech-reference`,label:`Tech Reference`,fileName:`tech-reference.html`,status:`missing`,format:`html`},{key:`test-cases`,label:`Test Cases`,fileName:`test-cases.html`,status:`missing`,format:`html`},{key:`design`,label:`Design`,fileName:`design.md`,status:`present`}],children:[{id:`phase-1-comments`,label:`Phase 1 Comments`,files:[{key:`requirements`,label:`Requirements`,fileName:`requirements.md`,status:`present`}],children:[]}]},O={specs:[D]},k={key:`tasks`,path:`/workspace/spec-reviewer/docs/plans/tasks/phase-1-viewer/p1-13-layout-components.md`,contents:[`# P1.14 Markdown Rendering`,``,`> Render review planning documents with anchors ready for comments.`,``,`## Acceptance`,``,`- [x] Headings and lists`,`- [x] Fenced code blocks`,`- [ ] Comment behavior follows in P1.15`,``,"```ts",`const blockType = "heading";`,"```",``,`| Element | Status |`,`| --- | --- |`,`| GFM table | Ready |`,`| External link | [Docs](https://example.com/docs) |`].join(`
`),missing:!1,blocks:[]},A={status:`ready`,workspacePath:T,tree:O,error:null},j={status:`ready`,workspacePath:T,specId:D.id,fileKey:`tasks`,document:k,error:null},M=[{id:E(`cmt_story_open`),anchor:{fileKey:`tasks`,blockType:`list_item`,blockIndex:5,textHash:g(`Comment behavior follows in P1.15`),textSnippet:`Comment behavior follows in P1.15`,charRange:{start:0,end:34}},body:`Check whether this note should move to Phase 2.`,status:`open`,resolved:!1,createdAt:`2026-05-05T10:00:00Z`,updatedAt:`2026-05-05T10:15:00Z`},{id:E(`cmt_story_resolved`),anchor:{fileKey:`tasks`,blockType:`heading`,blockIndex:0,textHash:g(`P1.14 Markdown Rendering`),textSnippet:`P1.14 Markdown Rendering`,charRange:{start:0,end:25}},body:`Rendering checklist is already reflected in the plan.`,status:`resolved`,resolved:!0,createdAt:`2026-05-05T11:00:00Z`,updatedAt:`2026-05-05T11:30:00Z`}],N={component:b,argTypes:{toolbar:{control:!1},sidebar:{control:!1},tabs:{control:!1},viewer:{control:!1},comments:{control:!1}}},P={args:x({treeState:A,documentState:j,selectedSpec:D,selectedFileKey:`tasks`,workspaceInput:T,workspaceStatusPath:T})},F={args:x({treeState:A,documentState:j,selectedSpec:D,selectedFileKey:`tasks`,workspaceInput:T,workspaceStatusPath:T,archivingSpecId:D.id})},I={args:x({treeState:{status:`loading`,workspacePath:T,tree:null,error:null},documentState:{status:`loading`,workspacePath:T,specId:D.id,fileKey:`tasks`,document:null,error:null},selectedSpec:D,selectedFileKey:`tasks`,workspaceInput:T,workspaceStatusPath:T,isWorkspaceLoading:!0})},L={args:x({treeState:{status:`empty`,workspacePath:T,tree:{specs:[]},error:null},documentState:{status:`idle`,workspacePath:T,specId:null,fileKey:null,document:null,error:null},selectedSpec:null,selectedFileKey:null,workspaceInput:T,workspaceStatusPath:T})},R={args:x({treeState:{status:`error`,workspacePath:T,tree:null,error:{code:`specTreeScan`,message:`Spec directory could not be scanned.`,raw:`Spec directory could not be scanned.`}},documentState:{status:`error`,workspacePath:T,specId:D.id,fileKey:`tasks`,document:null,error:{code:`markdownRead`,message:`Markdown file could not be read.`,raw:`Markdown file could not be read.`}},selectedSpec:D,selectedFileKey:`tasks`,workspaceInput:T,workspaceStatusPath:T,workspaceErrorMessage:`Workspace loaded with file warnings.`})},P.parameters={...P.parameters,docs:{...P.parameters?.docs,source:{originalSource:`{
  args: createShellArgs({
    treeState: readyTreeState,
    documentState: readyDocumentState,
    selectedSpec: sampleSpec,
    selectedFileKey: "tasks",
    workspaceInput: workspacePath,
    workspaceStatusPath: workspacePath
  })
}`,...P.parameters?.docs?.source}}},F.parameters={...F.parameters,docs:{...F.parameters?.docs,source:{originalSource:`{
  args: createShellArgs({
    treeState: readyTreeState,
    documentState: readyDocumentState,
    selectedSpec: sampleSpec,
    selectedFileKey: "tasks",
    workspaceInput: workspacePath,
    workspaceStatusPath: workspacePath,
    archivingSpecId: sampleSpec.id
  })
}`,...F.parameters?.docs?.source}}},I.parameters={...I.parameters,docs:{...I.parameters?.docs,source:{originalSource:`{
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
}`,...I.parameters?.docs?.source}}},L.parameters={...L.parameters,docs:{...L.parameters?.docs,source:{originalSource:`{
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
}`,...L.parameters?.docs?.source}}},R.parameters={...R.parameters,docs:{...R.parameters?.docs,source:{originalSource:`{
  args: createShellArgs({
    treeState: {
      status: "error",
      workspacePath,
      tree: null,
      error: {
        code: "specTreeScan",
        message: "Spec directory could not be scanned.",
        raw: "Spec directory could not be scanned."
      }
    },
    documentState: {
      status: "error",
      workspacePath,
      specId: sampleSpec.id,
      fileKey: "tasks",
      document: null,
      error: {
        code: "markdownRead",
        message: "Markdown file could not be read.",
        raw: "Markdown file could not be read."
      }
    },
    selectedSpec: sampleSpec,
    selectedFileKey: "tasks",
    workspaceInput: workspacePath,
    workspaceStatusPath: workspacePath,
    workspaceErrorMessage: "Workspace loaded with file warnings."
  })
}`,...R.parameters?.docs?.source}}},z=[`Default`,`Archiving`,`Loading`,`Empty`,`Error`]}))();export{F as Archiving,P as Default,L as Empty,R as Error,I as Loading,z as __namedExportsOrder,N as default};