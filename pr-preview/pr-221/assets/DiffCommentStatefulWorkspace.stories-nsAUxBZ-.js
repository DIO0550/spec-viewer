import{a as e,n as t}from"./chunk-DnJy8xQt.js";import{n}from"./iframe-Cc7ss8xC.js";import{t as r}from"./jsx-runtime-BpX3lQ6F.js";import{n as i,t as a}from"./DiffCommentComposer-B6TduauS.js";import{n as o,t as s}from"./DiffReviewSidebar-B9zcMhMA.js";function c({scenario:e}){let[t,n]=(0,l.useState)(`A`),[r,i]=(0,l.useState)({A:e===`base-editor`?`base draft`:``,B:``}),[o,c]=(0,l.useState)([]),[d,f]=(0,l.useState)(!1),[p,m]=(0,l.useState)(!0),[h,g]=(0,l.useState)(`ready`),_=e=>{c([...o,{id:`comment-${o.length+1}`,body:e,status:`open`,locationLabel:`implementation-plan.md current 2行目`,snippet:`current`,resolution:{status:`exact`}}]),i(e=>({...e,[t]:``}))};return(0,u.jsxs)(`main`,{"aria-label":`Stateful Diff comment workspace`,children:[(0,u.jsxs)(`nav`,{"aria-label":`Workspace fixture controls`,children:[(0,u.jsx)(`button`,{type:`button`,onClick:()=>n(`A`),children:`Worktree A`}),(0,u.jsx)(`button`,{type:`button`,onClick:()=>n(`B`),children:`Worktree B`}),(0,u.jsx)(`button`,{type:`button`,onClick:()=>g(`refreshed`),children:`Refresh`}),(0,u.jsx)(`button`,{type:`button`,onClick:()=>f(!0),children:`Snapshot changed`}),(0,u.jsx)(`button`,{type:`button`,onClick:()=>m(!1),children:`Editor`}),(0,u.jsx)(`button`,{type:`button`,onClick:()=>m(!0),children:`Unified`}),(0,u.jsx)(`button`,{type:`button`,onClick:()=>_(`unchanged persisted`),children:`Save unchanged`}),(0,u.jsx)(`button`,{type:`button`,onClick:()=>g(`reloaded`),children:`Reload workspace`})]}),(0,u.jsx)(`p`,{role:`status`,children:h}),p?(0,u.jsx)(a,{id:`stateful-${t}`,label:`Diff comment draft`,body:r[t],isSaving:!1,canSubmit:!d,disabledReason:d?`staleTarget`:null,onBodyChange:e=>i(n=>({...n,[t]:e})),onCancel:()=>m(!1),onSubmit:_,onReanchor:()=>f(!1)}):null,(0,u.jsx)(s,{comments:o,filter:`all`,search:``,selectedCommentId:null,loadState:`ready`,warnings:[],onFilterChange:()=>void 0,onSearchChange:()=>void 0,onSelectComment:()=>void 0,onJump:()=>g(`jumped`),onResolve:()=>void 0,onReopen:()=>void 0})]})}var l,u,d,f,p,m,h,g,_,v,y,b;t((()=>{l=e(n(),1),i(),o(),u=r(),{expect:d,userEvent:f,within:p}=__STORYBOOK_MODULE_TEST__,m={title:`Diff/Comments/StatefulWorkspace`,component:c,parameters:{layout:`fullscreen`},args:{scenario:`create-jump-refresh`}},h={play:async({canvasElement:e})=>{let t=p(e),n=t.getByRole(`textbox`,{name:`Diff comment draft`});await f.type(n,`created in workspace`),await f.click(t.getByRole(`button`,{name:`保存`})),await f.click(t.getByRole(`button`,{name:/へ移動/})),await d(t.getByRole(`status`)).toHaveTextContent(`jumped`),await f.click(t.getByRole(`button`,{name:`Refresh`})),await d(t.getByText(`created in workspace`)).toBeVisible()}},g={args:{scenario:`pending-a-b-a`},play:async({canvasElement:e})=>{let t=p(e);await f.type(t.getByRole(`textbox`,{name:`Diff comment draft`}),`pending A`),await f.click(t.getByRole(`button`,{name:`Worktree B`})),await d(t.queryByDisplayValue(`pending A`)).toBeNull(),await f.click(t.getByRole(`button`,{name:`Worktree A`})),await d(t.getByDisplayValue(`pending A`)).toBeVisible()}},_={args:{scenario:`stale`},play:async({canvasElement:e})=>{let t=p(e);await f.click(t.getByRole(`button`,{name:`Snapshot changed`})),await d(t.getByRole(`button`,{name:`保存`})).toBeDisabled(),await f.click(t.getByRole(`button`,{name:`再アンカー`})),await d(t.getByRole(`button`,{name:`保存`})).toBeEnabled(),await f.click(t.getByRole(`button`,{name:`Snapshot changed`})),await f.click(t.getByRole(`button`,{name:`キャンセル`})),await d(t.queryByRole(`textbox`,{name:`Diff comment draft`})).toBeNull()}},v={args:{scenario:`base-editor`},play:async({canvasElement:e})=>{let t=p(e);await f.click(t.getByRole(`button`,{name:`Editor`})),await d(t.queryByRole(`textbox`,{name:`Diff comment draft`})).toBeNull(),await f.click(t.getByRole(`button`,{name:`Unified`})),await d(t.getByDisplayValue(`base draft`)).toBeVisible()}},y={args:{scenario:`all-unchanged`},play:async({canvasElement:e})=>{let t=p(e);await f.click(t.getByRole(`button`,{name:`Save unchanged`})),await f.click(t.getByRole(`button`,{name:`Reload workspace`})),await d(t.getByText(`unchanged persisted`)).toBeVisible()}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const editor = canvas.getByRole("textbox", {
      name: "Diff comment draft"
    });
    await userEvent.type(editor, "created in workspace");
    await userEvent.click(canvas.getByRole("button", {
      name: "保存"
    }));
    await userEvent.click(canvas.getByRole("button", {
      name: /へ移動/
    }));
    await expect(canvas.getByRole("status")).toHaveTextContent("jumped");
    await userEvent.click(canvas.getByRole("button", {
      name: "Refresh"
    }));
    await expect(canvas.getByText("created in workspace")).toBeVisible();
  }
}`,...h.parameters?.docs?.source}}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    scenario: "pending-a-b-a"
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("textbox", {
      name: "Diff comment draft"
    }), "pending A");
    await userEvent.click(canvas.getByRole("button", {
      name: "Worktree B"
    }));
    await expect(canvas.queryByDisplayValue("pending A")).toBeNull();
    await userEvent.click(canvas.getByRole("button", {
      name: "Worktree A"
    }));
    await expect(canvas.getByDisplayValue("pending A")).toBeVisible();
  }
}`,...g.parameters?.docs?.source}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
  args: {
    scenario: "stale"
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", {
      name: "Snapshot changed"
    }));
    await expect(canvas.getByRole("button", {
      name: "保存"
    })).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", {
      name: "再アンカー"
    }));
    await expect(canvas.getByRole("button", {
      name: "保存"
    })).toBeEnabled();
    await userEvent.click(canvas.getByRole("button", {
      name: "Snapshot changed"
    }));
    await userEvent.click(canvas.getByRole("button", {
      name: "キャンセル"
    }));
    await expect(canvas.queryByRole("textbox", {
      name: "Diff comment draft"
    })).toBeNull();
  }
}`,..._.parameters?.docs?.source}}},v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    scenario: "base-editor"
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", {
      name: "Editor"
    }));
    await expect(canvas.queryByRole("textbox", {
      name: "Diff comment draft"
    })).toBeNull();
    await userEvent.click(canvas.getByRole("button", {
      name: "Unified"
    }));
    await expect(canvas.getByDisplayValue("base draft")).toBeVisible();
  }
}`,...v.parameters?.docs?.source}}},y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    scenario: "all-unchanged"
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", {
      name: "Save unchanged"
    }));
    await userEvent.click(canvas.getByRole("button", {
      name: "Reload workspace"
    }));
    await expect(canvas.getByText("unchanged persisted")).toBeVisible();
  }
}`,...y.parameters?.docs?.source}}},b=[`CreateJumpRefresh`,`PendingIdentityABA`,`StaleReanchorAndDiscard`,`BaseEditorHideRestore`,`AllUnchangedPersistence`]}))();export{y as AllUnchangedPersistence,v as BaseEditorHideRestore,h as CreateJumpRefresh,g as PendingIdentityABA,_ as StaleReanchorAndDiscard,b as __namedExportsOrder,m as default};