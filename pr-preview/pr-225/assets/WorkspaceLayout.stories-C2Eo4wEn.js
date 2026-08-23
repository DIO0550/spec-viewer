import{a as e,n as t}from"./chunk-DnJy8xQt.js";import{i as n}from"./iframe-BL9YdAjS.js";import{d as r,t as i}from"./lucide-react-CUI8qIF6.js";import{t as a}from"./CommentSidebar-Ctx6YRGU.js";import{n as o,t as s}from"./preferences-CioAqxAh.js";import{t as c}from"./jsx-runtime-B3THDwZN.js";import{t as l}from"./MarkdownViewer-BM0JHw4v.js";import{r as u}from"./comment-anchor-draft-S-IhD0W8.js";import{t as ee}from"./SpecTabs-CfJYi_Is.js";import{r as te}from"./specTreeState-DVXnXeJK.js";import{l as d,p as f,t as p}from"./workspace-Bt9Jmqul.js";import{t as m}from"./comments-KPH6W4gS.js";import{n as h,t as g}from"./commentId-DUnCNnnS.js";import{n as ne,t as _}from"./WorkspaceLayout-Dz9_zeAN.js";import{t as re}from"./ChangesNavigation-3WvedAZN.js";import{t as ie}from"./DiffViewer-DCRhxmyV.js";import{t as ae}from"./DiffWorkspace-CrrBfPtI.js";import{t as oe}from"./ViewModeToolbar-DD9j5QCh.js";import{t as se}from"./WorkspaceSidebarSection-CcmoGKeD.js";import{t as ce}from"./WorkspaceToolbar-DVylpL7Q.js";import{t as le}from"./WorktreeTree-CL8jmK1c.js";import{r as ue,t as de}from"./testFixtures-Bhkbu1WV.js";function fe(e){let{pathbar:t,toolbar:n,leftHeader:r,sidebar:i,tabs:a,viewer:o,comments:s,leftOpen:c,leftWidth:l,leftMinWidth:u,leftMaxWidth:ee,onOpenLeft:te,onCloseLeft:d,onLeftWidthChange:f,commentsOpen:p,commentsWidth:m,commentsMinWidth:h,commentsMaxWidth:g,onOpenComments:ne,onCloseComments:re,onCommentsWidthChange:ie}=e,[ae,oe]=(0,y.useState)(c??!0),[se,ce]=(0,y.useState)(l??240),[le,ue]=(0,y.useState)(p??!0),[de,fe]=(0,y.useState)(m??300);return(0,b.jsxs)(_.Root,{worktrees:{isOpen:ae,width:se,minWidth:u,maxWidth:ee,onOpen:()=>{oe(!0),te?.()},onClose:()=>{oe(!1),d?.()},onWidthChange:e=>{ce(e),f?.(e)}},comments:{isOpen:le,width:de,minWidth:h,maxWidth:g,onOpen:()=>{ue(!0),ne?.()},onClose:()=>{ue(!1),re?.()},onWidthChange:e=>{fe(e),ie?.(e)}},children:[(0,b.jsx)(_.Pathbar,{children:t}),(0,b.jsx)(_.Toolbar,{children:n}),(0,b.jsx)(_.Worktrees,{header:r,children:i}),(0,b.jsx)(_.ModeNavigation,{children:a}),(0,b.jsx)(_.Content,{children:o}),(0,b.jsx)(_.Comments,{children:s})]})}async function pe(e){let t=T(e);await x(t.getByRole(`textbox`,{name:`PATH`})).toHaveValue(O),await x(t.getByRole(`treeitem`,{name:new RegExp(D)})).toHaveAttribute(`aria-current`,`page`),await x(t.getByRole(`button`,{name:`${D}を開く`})).toHaveAttribute(`aria-current`,`location`)}async function me(e){let t=T(e),n=t.getByRole(`treeitem`,{name:/root/}),r=t.getByRole(`tab`,{name:`Specs`}),i=t.getByRole(`tab`,{name:`Diff`}),a=t.getAllByRole(`separator`),o=e.querySelector(`.app-shell__toolbar`),s=e.querySelector(`.app-shell__toolbar-content`);await x(getComputedStyle(o).overflowX).toBe(`hidden`),await x(getComputedStyle(s).gridColumnStart).toBe(`2`),await x(s.clientWidth).toBe(o.clientWidth),await x(n).toHaveAttribute(`aria-current`,`page`),await x(r).toHaveAttribute(`aria-selected`,`true`),await x(a).toHaveLength(3);for(let e of a)await x(e).toHaveAttribute(`aria-valuenow`);await C.click(r),await C.keyboard(`{ArrowRight}`),await x(i).toHaveFocus(),await C.click(t.getByRole(`button`,{name:`仕様一覧を閉じる`}));let c=t.getByRole(`button`,{name:`仕様一覧を開く`});await w(async()=>{await x(c).toHaveFocus()}),await C.click(c),await w(async()=>{await x(t.getByRole(`button`,{name:`仕様一覧を閉じる`})).toHaveFocus()});let l=e.querySelector(`.app-shell__comments-close`);await x(l).toBeVisible(),await C.click(l);let u=t.getByRole(`button`,{name:`サイドバーを開く`});await w(async()=>{await x(u).toHaveFocus()}),await C.click(u),await w(async()=>{await x(l).toHaveFocus()})}async function he(e){let t=e.querySelector(`.app-shell__mode-navigation .spec-tree__list`);await x(t).toBeInstanceOf(HTMLElement);let n=t;await x(n.scrollWidth).toBeLessThanOrEqual(n.clientWidth)}function v({treeState:e,documentState:t,selectedSpec:n,selectedFileKey:r,workspaceInput:i,workspaceStatusPath:s,workspaceErrorMessage:c=void 0,isWorkspaceLoading:u=!1,archivingSpecId:d=null,viewMode:f=`specs`,activeWorktreeName:p=null,changedFiles:m=[]}){let h=n?.files.find(e=>e.key===r)??null,g=m[0]??null,ne;ne=f===`diff`?(0,b.jsx)(ae,{selectedPath:g?.path??null,preview:g===null?null:(0,b.jsx)(ie,{fileDiff:ye,mode:`unified`,activeChangeId:null,onActiveChangeIdChange:S()}),availability:{status:`ready`}}):(0,b.jsxs)(`section`,{className:`specs-workspace__document`,"aria-label":`Spec document`,children:[(0,b.jsx)(ee,{spec:n,selectedFileKey:r,onSelectFile:S()}),(0,b.jsx)(`div`,{className:`specs-workspace__viewer`,children:(0,b.jsx)(l,{state:t,selectedSpecLabel:n?.label??null,selectedFileLabel:h?.label??null,comments:Ce,activeCommentId:k(`cmt_story_open_1`),onReload:S(),onSelectComment:S()})})]});let _=p===null?{path:`/workspace/plugin-manager`,displayName:`plugin-manager`,kind:`plugin-worktree`,lastOpenedAt:`2026-05-05T00:00:00.000Z`}:{path:s??O,displayName:p,kind:`plugin-worktree`,lastOpenedAt:`2026-05-05T00:00:00.000Z`};return{leftOpen:!0,leftHeader:null,pathbar:(0,b.jsx)(o,{children:(0,b.jsx)(ce,{workspacePath:s,inputValue:i,isLoading:u,isBrowsing:!1,errorMessage:c??null,canRefresh:n!==null&&r!==null,onInputChange:S(),onBrowse:S(),onLoad:S(),onRefresh:S(),onReset:S()})}),toolbar:(0,b.jsx)(oe,{mode:f,activeItemLabel:f===`diff`?g?.path??`ファイル未選択`:n!==null&&h!==null?n.label+` / `+h.fileName:`ファイル未選択`,onModeChange:S()}),sidebar:(0,b.jsxs)(`div`,{className:`left-navigation-panel`,children:[(0,b.jsx)(se,{currentWorkspacePath:s,isOpen:!0,isBusy:u,recentWorkspaces:[{path:`/workspace/spec-board`,displayName:`spec-board`,kind:`plugin-workspace`,lastOpenedAt:`2026-05-07T00:00:00.000Z`},{path:E,displayName:`pdfmod`,kind:`plugin-workspace`,lastOpenedAt:`2026-05-06T00:00:00.000Z`},_],onBrowse:S(),onToggleOpen:S(),onOpenWorkspace:S(),onRemoveWorkspace:S()}),(0,b.jsx)(ge,{activeWorktreeName:p})]}),tabs:f===`specs`?(0,b.jsx)(te,{state:e,selectedSpecId:n?.id??null,archivingSpecId:d,isLoading:d!==null,onSelectSpec:S(),onArchiveSpec:S(),onReload:S()}):(0,b.jsx)(re,{items:m,selectedId:g?.id??null,availability:m.length===0?{status:`unavailable`,reason:`data-source-not-connected`}:{status:`ready`},onSelect:S()}),viewer:ne,comments:(0,b.jsx)(a,{listState:{status:`ready`,comments:Ce,error:null},operationState:{status:`idle`,operation:null,commentId:null,error:null},activeCommentId:k(`cmt_story_open_1`),onSelectComment:S(),onResolveComment:S(),onReopenComment:S(),onDeleteComment:S(),onUpdateComment:S(),onReload:S()})}}function ge({activeWorktreeName:e}){let t=e??`root`;return(0,b.jsxs)(`section`,{className:`story-worktree-tree`,"aria-label":`Worktrees`,children:[(0,b.jsx)(`input`,{"aria-label":`Filter worktrees`,placeholder:`Filter worktrees...`}),(0,b.jsxs)(`div`,{className:`story-worktree-tree__header`,children:[(0,b.jsxs)(`span`,{children:[`ROOT / WORKTREES `,_e.length]}),(0,b.jsx)(`button`,{className:`icon-button worktree-navigation__refresh`,type:`button`,"aria-label":`Worktree一覧を再読み込み`,title:`Worktree一覧を再読み込み`,onClick:S(),children:(0,b.jsx)(r,{"aria-hidden":`true`,size:12})})]}),(0,b.jsx)(le,{nodes:_e.map(e=>({kind:`worktree`,id:e.name,label:e.icon+` `+e.name,count:{kind:`changed-file-count`,value:e.changeCount}})),selectedWorktreeId:t,emptyLabel:`Worktree はありません`,onSelectWorktree:S()})]})}var y,b,x,S,C,w,T,E,D,O,k,_e,ve,ye,A,be,j,xe,Se,M,N,P,F,Ce,we,I,L,R,z,B,V,H,U,W,G,K,q,J,Y,X,Z,Q,$,Te;t((()=>{i(),y=e(n(),1),ne(),m(),h(),d(),ue(),s(),f(),p(),b=c(),{expect:x,fn:S,userEvent:C,waitFor:w,within:T}=__STORYBOOK_MODULE_TEST__,E=`/workspace/pdfmod`,D=`agent-a1b3ff42`,O=`/workspace/pdfmod/.worktrees/${D}`,k=g.fromString,_e=[{name:`root`,icon:`⌂`,changeCount:0},{name:`549`,icon:`▣`,changeCount:2},{name:D,icon:`⑂`,changeCount:4},{name:`agent-a049b1c8`,icon:`⑂`,changeCount:0},{name:`agent-a395fbe1`,icon:`⑂`,changeCount:1},{name:`agent-a5b8a0d3`,icon:`⑂`,changeCount:2},{name:`agent-a65ad1a4`,icon:`⑂`,changeCount:7},{name:`archive`,icon:`▱`,changeCount:12,isMuted:!0}],ve=[{id:`src/app/App.tsx`,path:`src/app/App.tsx`,change:`modified`},{id:`src/features/workspace/components/WorktreeTree/index.tsx`,path:`src/features/workspace/components/WorktreeTree/index.tsx`,change:`modified`},{id:`src/features/workspace/hooks/useWorkspaceWorktrees/index.ts`,path:`src/features/workspace/hooks/useWorkspaceWorktrees/index.ts`,change:`added`},{id:`docs/worktree-navigation.md`,path:`docs/worktree-navigation.md`,change:`untracked`}],ye=de({fileKey:`src/app/App.tsx`,oldPath:`src/app/App.tsx`,newPath:`src/app/App.tsx`,lines:[{kind:`context`,text:`import { WorkspaceLayout } from "@/components/WorkspaceLayout";`},{kind:`removed`,text:`const emptyState = true;`},{kind:`added`,text:`const emptyState = false;`},{kind:`context`,text:`const changedFiles = [`},{kind:`removed`,text:`  "src/app/App.tsx",`},{kind:`added`,text:`  "src/features/workspace/components/WorktreeTree/index.tsx",`},{kind:`context`,text:`];`}]}),A={id:`041-preview-task`,label:`041-preview-task`,kind:`spec`,sourceGroupId:`primary`,relativeId:`041-preview-task`,presentDocumentCount:3,descendantSpecCount:0,files:[{key:`exploration`,label:`exploration.md`,fileName:`exploration.md`,status:`present`},{key:`hearing`,label:`hearing.md`,fileName:`hearing.md`,status:`present`},{key:`impl`,label:`impl.md`,fileName:`impl.md`,status:`present`},{key:`tasks`,label:`tasks.md`,fileName:`tasks.md`,status:`missing`}],children:[]},be={specs:[{id:`040-delete-task-flow`,label:`040-delete-task-flow`,kind:`spec`,sourceGroupId:`primary`,relativeId:`040-delete-task-flow`,presentDocumentCount:3,descendantSpecCount:0,files:A.files,children:[]},A,{id:`042-cache-invalidation`,label:`042-cache-invalidation`,kind:`spec`,sourceGroupId:`primary`,relativeId:`042-cache-invalidation`,presentDocumentCount:3,descendantSpecCount:0,files:A.files.slice(0,3),children:[]},{id:`primary/.archive`,label:`Archive`,kind:`archive`,sourceGroupId:`primary`,relativeId:`.archive`,presentDocumentCount:0,descendantSpecCount:1,files:[],children:[{id:`primary/.archive/039-legacy-preview`,label:`039-legacy-preview`,kind:`spec`,sourceGroupId:`primary`,relativeId:`.archive/039-legacy-preview`,presentDocumentCount:3,descendantSpecCount:0,files:A.files,children:[]}]},{id:`secondary`,label:`agent-a1b3ff42 (.plugin-worktree)`,kind:`sourceGroup`,sourceGroupId:`secondary`,relativeId:`.`,presentDocumentCount:0,descendantSpecCount:1,files:[],children:[{...A,id:`secondary/041-preview-task`,sourceGroupId:`secondary`,relativeId:`041-preview-task`}]}]},j=`Implementation`,xe=[{blockType:`heading`,blockIndex:0,textHash:u(`Implementation`),textSnippet:`Implementation`,sourceRange:null},{blockType:`paragraph`,blockIndex:1,textHash:u(`041-preview-task · impl`),textSnippet:`041-preview-task · impl`,sourceRange:null},{blockType:`paragraph`,blockIndex:2,textHash:u(`タスクプレビューの実装方針を、既存の QuickView 相当機能との統合方針を含めて決める。認証と描画性能の 2 軸で判断する。`),textSnippet:`タスクプレビューの実装方針を、既存の QuickView 相当機能との統合方針を含めて決める。認証と描画性能の 2 軸で判断する。`,sourceRange:null},{blockType:`heading`,blockIndex:3,textHash:u(`現状の課題`),textSnippet:`現状の課題`,sourceRange:null},{blockType:`list_item`,blockIndex:4,textHash:u(`プレビュー起動フローが複数入口に散らばっている`),textSnippet:`プレビュー起動フローが複数入口に散らばっている`,sourceRange:null},{blockType:`list_item`,blockIndex:5,textHash:u(`大きなタスクを開いたときの描画コストが線形に増える`),textSnippet:`大きなタスクを開いたときの描画コストが線形に増える`,sourceRange:null},{blockType:`list_item`,blockIndex:6,textHash:u(`権限のないタスクを掴んだときのエラーハンドリングが弱い`),textSnippet:`権限のないタスクを掴んだときのエラーハンドリングが弱い`,sourceRange:null},{blockType:`heading`,blockIndex:7,textHash:u(`検討した選択肢`),textSnippet:`検討した選択肢`,sourceRange:null},{blockType:`table`,blockIndex:8,textHash:u(`OPTION VERDICT A 既存 QuickView をそのままタスクにも流用 rejected B QuickView をラップした TaskPreview を新規に薄く作る accepted C プレビュー基盤ごと書き直す deferred`),textSnippet:`OPTION VERDICT A 既存 QuickView をそのままタスクにも流用 rejected B QuickView をラップした TaskPreview を新規に薄く作る accepted C プレビュー基盤ごと書き直す deferred`,sourceRange:null},{blockType:`heading`,blockIndex:9,textHash:u(`決定事項`),textSnippet:`決定事項`,sourceRange:null},{blockType:`paragraph`,blockIndex:10,textHash:u(`選択肢 B を採用する。既存の QuickView をラップした TaskPreview を薄く作り、タスク固有の権限チェックと空状態のみを新規実装する。描画は既存パスに委譲。`),textSnippet:`選択肢 B を採用する。既存の QuickView をラップした TaskPreview を薄く作り、タスク固有の権限チェックと空状態のみを新規実装する。描画は既存パスに委譲。`,sourceRange:null}],Se={key:`impl`,path:`${E}/.plugin-workspace/.specs/041-preview-task/impl.md`,contents:[`# Implementation`,``,"`041-preview-task · impl`",``,"タスクプレビューの実装方針を、既存の `QuickView` 相当機能との統合方針を含めて決める。認証と描画性能の 2 軸で判断する。",``,`## 現状の課題`,``,`- プレビュー起動フローが複数入口に散らばっている`,`- 大きなタスクを開いたときの描画コストが線形に増える`,`- 権限のないタスクを掴んだときのエラーハンドリングが弱い`,``,`## 検討した選択肢`,``,`| OPTION | | VERDICT |`,`| --- | --- | --- |`,`| A | 既存 QuickView をそのままタスクにも流用 | rejected |`,`| B | **QuickView をラップした TaskPreview を新規に薄く作る** | accepted |`,`| C | プレビュー基盤ごと書き直す | deferred |`,``,`## 決定事項`,``,"選択肢 B を採用する。既存の QuickView をラップした `TaskPreview` を薄く作り、タスク固有の権限チェックと空状態のみを新規実装する。描画は既存パスに委譲。"].join(`
`),missing:!1,blocks:xe},M={status:`ready`,workspacePath:E,tree:be,error:null},N={status:`ready`,workspacePath:E,specId:A.id,fileKey:`impl`,document:Se,error:null},P={...M,workspacePath:O},F={...N,workspacePath:O,document:{...Se,path:`${O}/.plugin-workspace/.specs/041-preview-task/impl.md`}},Ce=[{id:k(`cmt_story_open_1`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:u(j),textSnippet:`scorer.ts L16 · calcFu`,charRange:{start:0,end:14}},body:`ctx が undefined のとき落ちる。null チェックいる?`,status:`open`,createdAt:`2026-07-25T12:00:00Z`,updatedAt:`2026-07-25T12:00:00Z`},{id:k(`cmt_story_open_2`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:u(j),textSnippet:`pinfu.ts L10 · checkAllRuns`,charRange:{start:0,end:14}},body:`agent-a5b8a0d3 は shapes を Map で持ってた。どっちが速いか計測したい`,status:`open`,createdAt:`2026-07-25T10:00:00Z`,updatedAt:`2026-07-25T10:00:00Z`},{id:k(`cmt_story_open_3`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:u(j),textSnippet:`scorer.ts L14 · score()`,charRange:{start:0,end:14}},body:`戻り値の Result 型、hands/*.ts と重複してるフィールドあり`,status:`open`,createdAt:`2026-07-25T08:00:00Z`,updatedAt:`2026-07-25T08:00:00Z`},{id:k(`cmt_story_resolved`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:u(j),textSnippet:`implementation decision`,charRange:{start:0,end:14}},body:`描画経路の統合方針を反映済み。`,status:`resolved`,createdAt:`2026-07-24T08:00:00Z`,updatedAt:`2026-07-24T09:00:00Z`}],we={component:fe,parameters:{layout:`fullscreen`,viewport:{options:Object.fromEntries([1200,1199,900,899,761,760].map(e=>[`width-`+e,{name:e+`px`,styles:{width:e+`px`,height:`800px`}}]))}},decorators:[e=>(0,b.jsx)(`div`,{style:{height:`100vh`},children:(0,b.jsx)(e,{})})],argTypes:{pathbar:{control:!1},toolbar:{control:!1},sidebar:{control:!1},tabs:{control:!1},viewer:{control:!1},comments:{control:!1}}},I=v({treeState:M,documentState:N,selectedSpec:A,selectedFileKey:`impl`,workspaceInput:E,workspaceStatusPath:E}),L={name:`Specs`,args:I,play:async({canvasElement:e})=>{await he(e),await me(e)}},R={args:{...I,leftWidth:420,commentsWidth:560}},z={args:{...I,leftOpen:!1,commentsOpen:!1}},B={args:I,parameters:{viewport:{defaultViewport:`width-1200`}}},V={args:I,parameters:{viewport:{defaultViewport:`width-1199`}}},H={args:I,parameters:{viewport:{defaultViewport:`width-900`}}},U={args:I,parameters:{viewport:{defaultViewport:`width-899`}}},W={args:I,parameters:{viewport:{defaultViewport:`width-761`}}},G={args:I,parameters:{viewport:{defaultViewport:`width-760`}},play:async({canvasElement:e})=>{let t=T(e);await C.click(t.getByRole(`button`,{name:`仕様一覧を閉じる`}));let n=e.querySelector(`.app-shell__comments-close`);await x(n).toBeVisible(),await C.click(n),await C.click(t.getByRole(`tab`,{name:`Specs`})),await C.click(t.getByRole(`region`,{name:`Spec document`})),await C.click(t.getByRole(`button`,{name:`サイドバーを開く`}))}},K={args:v({treeState:M,documentState:N,selectedSpec:A,selectedFileKey:`impl`,workspaceInput:E,workspaceStatusPath:E,viewMode:`diff`})},q={args:v({treeState:P,documentState:F,selectedSpec:A,selectedFileKey:`impl`,workspaceInput:O,workspaceStatusPath:O,activeWorktreeName:D}),play:async({canvasElement:e})=>{await pe(e)}},J={args:v({treeState:P,documentState:F,selectedSpec:A,selectedFileKey:`impl`,workspaceInput:O,workspaceStatusPath:O,activeWorktreeName:D,viewMode:`diff`}),play:async({canvasElement:e})=>{await pe(e)}},Y={args:v({treeState:P,documentState:F,selectedSpec:A,selectedFileKey:`impl`,workspaceInput:O,workspaceStatusPath:O,activeWorktreeName:D,viewMode:`diff`,changedFiles:ve}),play:async({canvasElement:e})=>{await pe(e);let t=T(e);await x(t.getByRole(`navigation`,{name:`変更ファイル`})).toBeVisible(),await x(t.getByRole(`button`,{name:/src\/app\/App\.tsx/})).toHaveAttribute(`aria-current`,`page`),await x(t.getByRole(`region`,{name:`src/app/App.tsx の差分`})).toBeVisible(),await x(e.querySelector(`.diff-viewer__cell[data-kind="added"]`)).not.toBeNull(),await x(e.querySelector(`.diff-viewer__cell[data-kind="removed"]`)).not.toBeNull(),await x(e.querySelectorAll(`.diff-viewer__line-number`).length).toBeGreaterThan(0);let n=Array.from(e.querySelectorAll(`.diff-viewer__marker`),e=>e.textContent);await x(n.includes(` `)).toBe(!0),await x(n.includes(`+`)).toBe(!0),await x(n.includes(`-`)).toBe(!0)}},X={args:v({treeState:M,documentState:N,selectedSpec:A,selectedFileKey:`impl`,workspaceInput:E,workspaceStatusPath:E,archivingSpecId:A.id})},Z={args:v({treeState:{status:`loading`,workspacePath:E,tree:null,error:null},documentState:{status:`loading`,workspacePath:E,specId:A.id,fileKey:`impl`,document:null,error:null},selectedSpec:A,selectedFileKey:`impl`,workspaceInput:E,workspaceStatusPath:E,isWorkspaceLoading:!0})},Q={args:v({treeState:{status:`empty`,workspacePath:E,tree:{specs:[]},error:null},documentState:{status:`idle`,workspacePath:E,specId:null,fileKey:null,document:null,error:null},selectedSpec:null,selectedFileKey:null,workspaceInput:E,workspaceStatusPath:E})},$={args:v({treeState:{status:`error`,workspacePath:E,tree:null,error:{feature:`specs`,code:`specTreeScan`,message:`Spec directory could not be scanned.`,cause:{command:`list_specs`,code:`specTreeScan`,message:`Spec directory could not be scanned.`,raw:`Spec directory could not be scanned.`}}},documentState:{status:`error`,workspacePath:E,specId:A.id,fileKey:`impl`,document:null,error:{feature:`specs`,code:`markdownRead`,message:`Markdown file could not be read.`,cause:{command:`read_spec_file`,code:`markdownRead`,message:`Markdown file could not be read.`,raw:`Markdown file could not be read.`}}},selectedSpec:A,selectedFileKey:`impl`,workspaceInput:E,workspaceStatusPath:E,workspaceErrorMessage:`Workspace loaded with file warnings.`})},L.parameters={...L.parameters,docs:{...L.parameters?.docs,source:{originalSource:`{
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
}`,...L.parameters?.docs?.source}}},R.parameters={...R.parameters,docs:{...R.parameters?.docs,source:{originalSource:`{
  args: {
    ...readySpecsArgs,
    leftWidth: 420,
    commentsWidth: 560
  }
}`,...R.parameters?.docs?.source}}},z.parameters={...z.parameters,docs:{...z.parameters?.docs,source:{originalSource:`{
  args: {
    ...readySpecsArgs,
    leftOpen: false,
    commentsOpen: false
  }
}`,...z.parameters?.docs?.source}}},B.parameters={...B.parameters,docs:{...B.parameters?.docs,source:{originalSource:`{
  args: readySpecsArgs,
  parameters: {
    viewport: {
      defaultViewport: "width-1200"
    }
  }
}`,...B.parameters?.docs?.source}}},V.parameters={...V.parameters,docs:{...V.parameters?.docs,source:{originalSource:`{
  args: readySpecsArgs,
  parameters: {
    viewport: {
      defaultViewport: "width-1199"
    }
  }
}`,...V.parameters?.docs?.source}}},H.parameters={...H.parameters,docs:{...H.parameters?.docs,source:{originalSource:`{
  args: readySpecsArgs,
  parameters: {
    viewport: {
      defaultViewport: "width-900"
    }
  }
}`,...H.parameters?.docs?.source}}},U.parameters={...U.parameters,docs:{...U.parameters?.docs,source:{originalSource:`{
  args: readySpecsArgs,
  parameters: {
    viewport: {
      defaultViewport: "width-899"
    }
  }
}`,...U.parameters?.docs?.source}}},W.parameters={...W.parameters,docs:{...W.parameters?.docs,source:{originalSource:`{
  args: readySpecsArgs,
  parameters: {
    viewport: {
      defaultViewport: "width-761"
    }
  }
}`,...W.parameters?.docs?.source}}},G.parameters={...G.parameters,docs:{...G.parameters?.docs,source:{originalSource:`{
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
}`,...G.parameters?.docs?.source}}},K.parameters={...K.parameters,docs:{...K.parameters?.docs,source:{originalSource:`{
  args: createShellArgs({
    treeState: readyTreeState,
    documentState: readyDocumentState,
    selectedSpec: sampleSpec,
    selectedFileKey: "impl",
    workspaceInput: workspacePath,
    workspaceStatusPath: workspacePath,
    viewMode: "diff"
  })
}`,...K.parameters?.docs?.source}}},q.parameters={...q.parameters,docs:{...q.parameters?.docs,source:{originalSource:`{
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
}`,...q.parameters?.docs?.source}}},J.parameters={...J.parameters,docs:{...J.parameters?.docs,source:{originalSource:`{
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
}`,...J.parameters?.docs?.source}}},Y.parameters={...Y.parameters,docs:{...Y.parameters?.docs,source:{originalSource:`{
  args: createShellArgs({
    treeState: readyWorktreeTreeState,
    documentState: readyWorktreeDocumentState,
    selectedSpec: sampleSpec,
    selectedFileKey: "impl",
    workspaceInput: worktreeWorkspacePath,
    workspaceStatusPath: worktreeWorkspacePath,
    activeWorktreeName: worktreeName,
    viewMode: "diff",
    changedFiles: worktreeChangedFiles
  }),
  /**
   * Verifies that a populated worktree exposes its changed files and preview.
   *
   * @param canvasElement - Rendered Storybook canvas.
   */
  play: async ({
    canvasElement
  }) => {
    await verifyWorktreeOpenStory(canvasElement);
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("navigation", {
      name: "変更ファイル"
    })).toBeVisible();
    await expect(canvas.getByRole("button", {
      name: /src\\/app\\/App\\.tsx/
    })).toHaveAttribute("aria-current", "page");
    await expect(canvas.getByRole("region", {
      name: "src/app/App.tsx の差分"
    })).toBeVisible();
    await expect(canvasElement.querySelector('.diff-viewer__cell[data-kind="added"]')).not.toBeNull();
    await expect(canvasElement.querySelector('.diff-viewer__cell[data-kind="removed"]')).not.toBeNull();
    await expect(canvasElement.querySelectorAll(".diff-viewer__line-number").length).toBeGreaterThan(0);
    const markers = Array.from(canvasElement.querySelectorAll(".diff-viewer__marker"), marker => marker.textContent);
    await expect(markers.includes(" ")).toBe(true);
    await expect(markers.includes("+")).toBe(true);
    await expect(markers.includes("-")).toBe(true);
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
}`,...$.parameters?.docs?.source}}},Te=[`Default`,`AllProps`,`EdgeCases`,`Viewport1200`,`Viewport1199`,`Viewport900`,`Viewport899`,`Viewport761`,`Viewport760`,`Diff`,`WorktreeOpen`,`WorktreeDiff`,`WorktreeDiffWithFiles`,`Archiving`,`Loading`,`Empty`,`Error`]}))();export{R as AllProps,X as Archiving,L as Default,K as Diff,z as EdgeCases,Q as Empty,$ as Error,Z as Loading,V as Viewport1199,B as Viewport1200,G as Viewport760,W as Viewport761,U as Viewport899,H as Viewport900,J as WorktreeDiff,Y as WorktreeDiffWithFiles,q as WorktreeOpen,Te as __namedExportsOrder,we as default};