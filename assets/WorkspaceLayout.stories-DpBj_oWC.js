import{a as e,n as t}from"./chunk-DnJy8xQt.js";import{n}from"./iframe-4trgloh_.js";import{t as r}from"./CommentSidebar-A3CQ_w9P.js";import{r as ee,t as i}from"./preferences-D5PEmHDQ.js";import{t as a}from"./jsx-runtime-BpX3lQ6F.js";import{t as o}from"./MarkdownViewer-BxdBp1MA.js";import{r as s}from"./comment-anchor-draft-CZ_exnwN.js";import{t as c}from"./SpecTabs-C05Shwsf.js";import{r as l}from"./specTreeState-D4KWc0Vs.js";import{c as te,f as u,t as d}from"./workspace-D67HivcZ.js";import{t as f}from"./comments-Bzi0NYZ9.js";import{n as p,t as m}from"./commentId-BzcUTf6f.js";import{n as h,t as g}from"./WorkspaceLayout-0AqydTCR.js";import{t as ne}from"./ChangesNavigation-DH-1-t5s.js";import{t as re}from"./DiffWorkspace-CFId2aet.js";import{t as ie}from"./ViewModeToolbar-B4pSPThE.js";import{t as ae}from"./WorkspaceSidebarSection-DQFuQsds.js";import{t as oe}from"./WorkspaceToolbar-DmXvUCMb.js";import{t as se}from"./WorktreeTree-um8IekG-.js";function ce(e){let{pathbar:t,toolbar:n,leftHeader:r,sidebar:ee,tabs:i,viewer:a,comments:o,leftOpen:s,leftWidth:c,leftMinWidth:l,leftMaxWidth:te,onOpenLeft:u,onCloseLeft:d,onLeftWidthChange:f,commentsOpen:p,commentsWidth:m,commentsMinWidth:h,commentsMaxWidth:ne,onOpenComments:re,onCloseComments:ie,onCommentsWidthChange:ae}=e,[oe,se]=(0,b.useState)(s??!0),[ce,_]=(0,b.useState)(c??240),[le,v]=(0,b.useState)(p??!0),[y,ue]=(0,b.useState)(m??300);return(0,x.jsxs)(g.Root,{worktrees:{isOpen:oe,width:ce,minWidth:l,maxWidth:te,onOpen:()=>{se(!0),u?.()},onClose:()=>{se(!1),d?.()},onWidthChange:e=>{_(e),f?.(e)}},comments:{isOpen:le,width:y,minWidth:h,maxWidth:ne,onOpen:()=>{v(!0),re?.()},onClose:()=>{v(!1),ie?.()},onWidthChange:e=>{ue(e),ae?.(e)}},children:[(0,x.jsx)(g.Pathbar,{children:t}),(0,x.jsx)(g.Toolbar,{children:n}),(0,x.jsx)(g.Worktrees,{header:r,children:ee}),(0,x.jsx)(g.ModeNavigation,{children:i}),(0,x.jsx)(g.Content,{children:a}),(0,x.jsx)(g.Comments,{children:o})]})}async function _(e){let t=E(e);await S(t.getByRole(`textbox`,{name:`PATH`})).toHaveValue(k),await S(t.getByRole(`treeitem`,{name:new RegExp(O)})).toHaveAttribute(`aria-current`,`page`),await S(t.getByRole(`button`,{name:`${O}を開く`})).toHaveAttribute(`aria-current`,`location`)}async function le(e){let t=E(e),n=t.getByRole(`treeitem`,{name:/root/}),r=t.getByRole(`tab`,{name:`Specs`}),ee=t.getByRole(`tab`,{name:`Diff`}),i=t.getAllByRole(`separator`),a=e.querySelector(`.app-shell__toolbar`),o=e.querySelector(`.app-shell__toolbar-content`);await S(getComputedStyle(a).overflowX).toBe(`hidden`),await S(getComputedStyle(o).gridColumnStart).toBe(`2`),await S(o.clientWidth).toBe(a.clientWidth),await S(n).toHaveAttribute(`aria-current`,`page`),await S(r).toHaveAttribute(`aria-selected`,`true`),await S(i).toHaveLength(3);for(let e of i)await S(e).toHaveAttribute(`aria-valuenow`);await w.click(r),await w.keyboard(`{ArrowRight}`),await S(ee).toHaveFocus(),await w.click(t.getByRole(`button`,{name:`仕様一覧を閉じる`}));let s=t.getByRole(`button`,{name:`仕様一覧を開く`});await T(async()=>{await S(s).toHaveFocus()}),await w.click(s),await T(async()=>{await S(t.getByRole(`button`,{name:`仕様一覧を閉じる`})).toHaveFocus()});let c=e.querySelector(`.app-shell__comments-close`);await S(c).toBeVisible(),await w.click(c);let l=t.getByRole(`button`,{name:`サイドバーを開く`});await T(async()=>{await S(l).toHaveFocus()}),await w.click(l),await T(async()=>{await S(c).toHaveFocus()})}async function v(e){let t=e.querySelector(`.app-shell__mode-navigation .spec-tree__list`);await S(t).toBeInstanceOf(HTMLElement);let n=t;await S(n.scrollWidth).toBeLessThanOrEqual(n.clientWidth)}function y({treeState:e,documentState:t,selectedSpec:n,selectedFileKey:i,workspaceInput:a,workspaceStatusPath:s,workspaceErrorMessage:te=void 0,isWorkspaceLoading:u=!1,archivingSpecId:d=null,viewMode:f=`specs`,activeWorktreeName:p=null}){let m=n?.files.find(e=>e.key===i)??null,h;h=f===`diff`?(0,x.jsx)(re,{selectedPath:null,preview:null,availability:{status:`ready`}}):(0,x.jsxs)(`section`,{className:`specs-workspace__document`,"aria-label":`Spec document`,children:[(0,x.jsx)(c,{spec:n,selectedFileKey:i,onSelectFile:C()}),(0,x.jsx)(`div`,{className:`specs-workspace__viewer`,children:(0,x.jsx)(o,{state:t,selectedSpecLabel:n?.label??null,selectedFileLabel:m?.label??null,comments:he,activeCommentId:A(`cmt_story_open_1`),onReload:C(),onSelectComment:C()})})]});let g=p===null?{path:`/workspace/plugin-manager`,displayName:`plugin-manager`,kind:`plugin-worktree`,lastOpenedAt:`2026-05-05T00:00:00.000Z`}:{path:s??k,displayName:p,kind:`plugin-worktree`,lastOpenedAt:`2026-05-05T00:00:00.000Z`};return{leftOpen:!0,leftHeader:null,pathbar:(0,x.jsx)(ee,{children:(0,x.jsx)(oe,{workspacePath:s,inputValue:a,isLoading:u,isBrowsing:!1,errorMessage:te??null,canRefresh:n!==null&&i!==null,onInputChange:C(),onBrowse:C(),onLoad:C(),onRefresh:C(),onReset:C()})}),toolbar:(0,x.jsx)(ie,{mode:f,activeItemLabel:n!==null&&m!==null?n.label+` / `+m.fileName:`ファイル未選択`,onModeChange:C()}),sidebar:(0,x.jsxs)(`div`,{className:`left-navigation-panel`,children:[(0,x.jsx)(ae,{currentWorkspacePath:s,isOpen:!0,isBusy:u,recentWorkspaces:[{path:`/workspace/spec-board`,displayName:`spec-board`,kind:`plugin-workspace`,lastOpenedAt:`2026-05-07T00:00:00.000Z`},{path:D,displayName:`pdfmod`,kind:`plugin-workspace`,lastOpenedAt:`2026-05-06T00:00:00.000Z`},g],onBrowse:C(),onToggleOpen:C(),onOpenWorkspace:C(),onRemoveWorkspace:C()}),(0,x.jsx)(ue,{activeWorktreeName:p})]}),tabs:f===`specs`?(0,x.jsx)(l,{state:e,selectedSpecId:n?.id??null,archivingSpecId:d,isLoading:d!==null,onSelectSpec:C(),onArchiveSpec:C(),onReload:C()}):(0,x.jsx)(ne,{items:[],selectedId:null,availability:{status:`unavailable`,reason:`data-source-not-connected`},onSelect:C()}),viewer:h,comments:(0,x.jsx)(r,{listState:{status:`ready`,comments:he,error:null},operationState:{status:`idle`,operation:null,commentId:null,error:null},activeCommentId:A(`cmt_story_open_1`),onSelectComment:C(),onResolveComment:C(),onReopenComment:C(),onDeleteComment:C(),onUpdateComment:C(),onReload:C()})}}function ue({activeWorktreeName:e}){let t=e??`root`;return(0,x.jsxs)(`section`,{className:`story-worktree-tree`,"aria-label":`Worktrees`,children:[(0,x.jsx)(`input`,{"aria-label":`Filter worktrees`,placeholder:`Filter worktrees...`}),(0,x.jsxs)(`div`,{className:`story-worktree-tree__header`,children:[(0,x.jsxs)(`span`,{children:[`ROOT / WORKTREES `,de.length]}),(0,x.jsx)(`span`,{"aria-hidden":`true`,children:`↻`})]}),(0,x.jsx)(se,{nodes:de.map(e=>({kind:`worktree`,id:e.name,label:e.icon+` `+e.name,count:{kind:`changed-file-count`,value:e.changeCount}})),selectedWorktreeId:t,emptyLabel:`Worktree はありません`,onSelectWorktree:C()})]})}var b,x,S,C,w,T,E,D,O,k,A,de,j,fe,M,pe,N,P,F,I,me,he,ge,L,R,z,B,V,H,U,W,G,K,q,J,Y,X,Z,Q,$,_e;t((()=>{b=e(n(),1),h(),f(),p(),te(),i(),u(),d(),x=a(),{expect:S,fn:C,userEvent:w,waitFor:T,within:E}=__STORYBOOK_MODULE_TEST__,D=`/workspace/pdfmod`,O=`agent-a1b3ff42`,k=`/workspace/pdfmod/.worktrees/${O}`,A=m.fromString,de=[{name:`root`,icon:`⌂`,changeCount:0},{name:`549`,icon:`▣`,changeCount:2},{name:O,icon:`⑂`,changeCount:4},{name:`agent-a049b1c8`,icon:`⑂`,changeCount:0},{name:`agent-a395fbe1`,icon:`⑂`,changeCount:1},{name:`agent-a5b8a0d3`,icon:`⑂`,changeCount:2},{name:`agent-a65ad1a4`,icon:`⑂`,changeCount:7},{name:`archive`,icon:`▱`,changeCount:12,isMuted:!0}],j={id:`041-preview-task`,label:`041-preview-task`,kind:`spec`,sourceGroupId:`primary`,relativeId:`041-preview-task`,presentDocumentCount:3,descendantSpecCount:0,files:[{key:`exploration`,label:`exploration.md`,fileName:`exploration.md`,status:`present`},{key:`hearing`,label:`hearing.md`,fileName:`hearing.md`,status:`present`},{key:`impl`,label:`impl.md`,fileName:`impl.md`,status:`present`},{key:`tasks`,label:`tasks.md`,fileName:`tasks.md`,status:`missing`}],children:[]},fe={specs:[{id:`040-delete-task-flow`,label:`040-delete-task-flow`,kind:`spec`,sourceGroupId:`primary`,relativeId:`040-delete-task-flow`,presentDocumentCount:3,descendantSpecCount:0,files:j.files,children:[]},j,{id:`042-cache-invalidation`,label:`042-cache-invalidation`,kind:`spec`,sourceGroupId:`primary`,relativeId:`042-cache-invalidation`,presentDocumentCount:3,descendantSpecCount:0,files:j.files.slice(0,3),children:[]},{id:`primary/.archive`,label:`Archive`,kind:`archive`,sourceGroupId:`primary`,relativeId:`.archive`,presentDocumentCount:0,descendantSpecCount:1,files:[],children:[{id:`primary/.archive/039-legacy-preview`,label:`039-legacy-preview`,kind:`spec`,sourceGroupId:`primary`,relativeId:`.archive/039-legacy-preview`,presentDocumentCount:3,descendantSpecCount:0,files:j.files,children:[]}]},{id:`secondary`,label:`agent-a1b3ff42 (.plugin-worktree)`,kind:`sourceGroup`,sourceGroupId:`secondary`,relativeId:`.`,presentDocumentCount:0,descendantSpecCount:1,files:[],children:[{...j,id:`secondary/041-preview-task`,sourceGroupId:`secondary`,relativeId:`041-preview-task`}]}]},M=`Implementation`,pe=[{blockType:`heading`,blockIndex:0,textHash:s(`Implementation`),textSnippet:`Implementation`,sourceRange:null},{blockType:`paragraph`,blockIndex:1,textHash:s(`041-preview-task · impl`),textSnippet:`041-preview-task · impl`,sourceRange:null},{blockType:`paragraph`,blockIndex:2,textHash:s(`タスクプレビューの実装方針を、既存の QuickView 相当機能との統合方針を含めて決める。認証と描画性能の 2 軸で判断する。`),textSnippet:`タスクプレビューの実装方針を、既存の QuickView 相当機能との統合方針を含めて決める。認証と描画性能の 2 軸で判断する。`,sourceRange:null},{blockType:`heading`,blockIndex:3,textHash:s(`現状の課題`),textSnippet:`現状の課題`,sourceRange:null},{blockType:`list_item`,blockIndex:4,textHash:s(`プレビュー起動フローが複数入口に散らばっている`),textSnippet:`プレビュー起動フローが複数入口に散らばっている`,sourceRange:null},{blockType:`list_item`,blockIndex:5,textHash:s(`大きなタスクを開いたときの描画コストが線形に増える`),textSnippet:`大きなタスクを開いたときの描画コストが線形に増える`,sourceRange:null},{blockType:`list_item`,blockIndex:6,textHash:s(`権限のないタスクを掴んだときのエラーハンドリングが弱い`),textSnippet:`権限のないタスクを掴んだときのエラーハンドリングが弱い`,sourceRange:null},{blockType:`heading`,blockIndex:7,textHash:s(`検討した選択肢`),textSnippet:`検討した選択肢`,sourceRange:null},{blockType:`table`,blockIndex:8,textHash:s(`OPTION VERDICT A 既存 QuickView をそのままタスクにも流用 rejected B QuickView をラップした TaskPreview を新規に薄く作る accepted C プレビュー基盤ごと書き直す deferred`),textSnippet:`OPTION VERDICT A 既存 QuickView をそのままタスクにも流用 rejected B QuickView をラップした TaskPreview を新規に薄く作る accepted C プレビュー基盤ごと書き直す deferred`,sourceRange:null},{blockType:`heading`,blockIndex:9,textHash:s(`決定事項`),textSnippet:`決定事項`,sourceRange:null},{blockType:`paragraph`,blockIndex:10,textHash:s(`選択肢 B を採用する。既存の QuickView をラップした TaskPreview を薄く作り、タスク固有の権限チェックと空状態のみを新規実装する。描画は既存パスに委譲。`),textSnippet:`選択肢 B を採用する。既存の QuickView をラップした TaskPreview を薄く作り、タスク固有の権限チェックと空状態のみを新規実装する。描画は既存パスに委譲。`,sourceRange:null}],N={key:`impl`,path:`${D}/.plugin-workspace/.specs/041-preview-task/impl.md`,contents:[`# Implementation`,``,"`041-preview-task · impl`",``,"タスクプレビューの実装方針を、既存の `QuickView` 相当機能との統合方針を含めて決める。認証と描画性能の 2 軸で判断する。",``,`## 現状の課題`,``,`- プレビュー起動フローが複数入口に散らばっている`,`- 大きなタスクを開いたときの描画コストが線形に増える`,`- 権限のないタスクを掴んだときのエラーハンドリングが弱い`,``,`## 検討した選択肢`,``,`| OPTION | | VERDICT |`,`| --- | --- | --- |`,`| A | 既存 QuickView をそのままタスクにも流用 | rejected |`,`| B | **QuickView をラップした TaskPreview を新規に薄く作る** | accepted |`,`| C | プレビュー基盤ごと書き直す | deferred |`,``,`## 決定事項`,``,"選択肢 B を採用する。既存の QuickView をラップした `TaskPreview` を薄く作り、タスク固有の権限チェックと空状態のみを新規実装する。描画は既存パスに委譲。"].join(`
`),missing:!1,blocks:pe},P={status:`ready`,workspacePath:D,tree:fe,error:null},F={status:`ready`,workspacePath:D,specId:j.id,fileKey:`impl`,document:N,error:null},I={...P,workspacePath:k},me={...F,workspacePath:k,document:{...N,path:`${k}/.plugin-workspace/.specs/041-preview-task/impl.md`}},he=[{id:A(`cmt_story_open_1`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:s(M),textSnippet:`scorer.ts L16 · calcFu`,charRange:{start:0,end:14}},body:`ctx が undefined のとき落ちる。null チェックいる?`,status:`open`,createdAt:`2026-07-25T12:00:00Z`,updatedAt:`2026-07-25T12:00:00Z`},{id:A(`cmt_story_open_2`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:s(M),textSnippet:`pinfu.ts L10 · checkAllRuns`,charRange:{start:0,end:14}},body:`agent-a5b8a0d3 は shapes を Map で持ってた。どっちが速いか計測したい`,status:`open`,createdAt:`2026-07-25T10:00:00Z`,updatedAt:`2026-07-25T10:00:00Z`},{id:A(`cmt_story_open_3`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:s(M),textSnippet:`scorer.ts L14 · score()`,charRange:{start:0,end:14}},body:`戻り値の Result 型、hands/*.ts と重複してるフィールドあり`,status:`open`,createdAt:`2026-07-25T08:00:00Z`,updatedAt:`2026-07-25T08:00:00Z`},{id:A(`cmt_story_resolved`),anchor:{fileKey:`impl`,blockType:`heading`,blockIndex:0,textHash:s(M),textSnippet:`implementation decision`,charRange:{start:0,end:14}},body:`描画経路の統合方針を反映済み。`,status:`resolved`,createdAt:`2026-07-24T08:00:00Z`,updatedAt:`2026-07-24T09:00:00Z`}],ge={component:ce,parameters:{layout:`fullscreen`,viewport:{options:Object.fromEntries([1200,1199,900,899,761,760].map(e=>[`width-`+e,{name:e+`px`,styles:{width:e+`px`,height:`800px`}}]))}},decorators:[e=>(0,x.jsx)(`div`,{style:{height:`100vh`},children:(0,x.jsx)(e,{})})],argTypes:{pathbar:{control:!1},toolbar:{control:!1},sidebar:{control:!1},tabs:{control:!1},viewer:{control:!1},comments:{control:!1}}},L=y({treeState:P,documentState:F,selectedSpec:j,selectedFileKey:`impl`,workspaceInput:D,workspaceStatusPath:D}),R={name:`Specs`,args:L,play:async({canvasElement:e})=>{await v(e),await le(e)}},z={args:{...L,leftWidth:420,commentsWidth:560}},B={args:{...L,leftOpen:!1,commentsOpen:!1}},V={args:L,parameters:{viewport:{defaultViewport:`width-1200`}}},H={args:L,parameters:{viewport:{defaultViewport:`width-1199`}}},U={args:L,parameters:{viewport:{defaultViewport:`width-900`}}},W={args:L,parameters:{viewport:{defaultViewport:`width-899`}}},G={args:L,parameters:{viewport:{defaultViewport:`width-761`}}},K={args:L,parameters:{viewport:{defaultViewport:`width-760`}},play:async({canvasElement:e})=>{let t=E(e);await w.click(t.getByRole(`button`,{name:`仕様一覧を閉じる`}));let n=e.querySelector(`.app-shell__comments-close`);await S(n).toBeVisible(),await w.click(n),await w.click(t.getByRole(`tab`,{name:`Specs`})),await w.click(t.getByRole(`region`,{name:`Spec document`})),await w.click(t.getByRole(`button`,{name:`サイドバーを開く`}))}},q={args:y({treeState:P,documentState:F,selectedSpec:j,selectedFileKey:`impl`,workspaceInput:D,workspaceStatusPath:D,viewMode:`diff`})},J={args:y({treeState:I,documentState:me,selectedSpec:j,selectedFileKey:`impl`,workspaceInput:k,workspaceStatusPath:k,activeWorktreeName:O}),play:async({canvasElement:e})=>{await _(e)}},Y={args:y({treeState:I,documentState:me,selectedSpec:j,selectedFileKey:`impl`,workspaceInput:k,workspaceStatusPath:k,activeWorktreeName:O,viewMode:`diff`}),play:async({canvasElement:e})=>{await _(e)}},X={args:y({treeState:P,documentState:F,selectedSpec:j,selectedFileKey:`impl`,workspaceInput:D,workspaceStatusPath:D,archivingSpecId:j.id})},Z={args:y({treeState:{status:`loading`,workspacePath:D,tree:null,error:null},documentState:{status:`loading`,workspacePath:D,specId:j.id,fileKey:`impl`,document:null,error:null},selectedSpec:j,selectedFileKey:`impl`,workspaceInput:D,workspaceStatusPath:D,isWorkspaceLoading:!0})},Q={args:y({treeState:{status:`empty`,workspacePath:D,tree:{specs:[]},error:null},documentState:{status:`idle`,workspacePath:D,specId:null,fileKey:null,document:null,error:null},selectedSpec:null,selectedFileKey:null,workspaceInput:D,workspaceStatusPath:D})},$={args:y({treeState:{status:`error`,workspacePath:D,tree:null,error:{feature:`specs`,code:`specTreeScan`,message:`Spec directory could not be scanned.`,cause:{command:`list_specs`,code:`specTreeScan`,message:`Spec directory could not be scanned.`,raw:`Spec directory could not be scanned.`}}},documentState:{status:`error`,workspacePath:D,specId:j.id,fileKey:`impl`,document:null,error:{feature:`specs`,code:`markdownRead`,message:`Markdown file could not be read.`,cause:{command:`read_spec_file`,code:`markdownRead`,message:`Markdown file could not be read.`,raw:`Markdown file could not be read.`}}},selectedSpec:j,selectedFileKey:`impl`,workspaceInput:D,workspaceStatusPath:D,workspaceErrorMessage:`Workspace loaded with file warnings.`})},R.parameters={...R.parameters,docs:{...R.parameters?.docs,source:{originalSource:`{
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