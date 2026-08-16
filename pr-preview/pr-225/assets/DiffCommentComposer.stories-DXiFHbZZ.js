import{n as e}from"./chunk-DnJy8xQt.js";import{t}from"./jsx-runtime-BpX3lQ6F.js";import{n,t as r}from"./DiffCommentComposer-BGerFJdd.js";var i,a,o,s,c,l,u,d,f,p,m,h,g,_,v,y;e((()=>{n(),i=t(),{expect:a,fn:o,userEvent:s,within:c}=__STORYBOOK_MODULE_TEST__,l={component:r,args:{id:`diff-comment-story`,label:`src/parser.ts current 42行目へのコメント`,body:`Null caseを明示してください`,isSaving:!1,onBodyChange:o(),onCancel:o(),onSubmit:o()},argTypes:{origin:{control:!1},onBodyChange:{control:!1},onCancel:{control:!1},onSubmit:{control:!1}}},u={},d={args:{statusMessage:`保存しています`,errorMessage:`競合を解消してから再試行してください`}},f={args:{body:``,isSaving:!0}},p={args:{canSubmit:!1,disabledReason:`staleTarget`,onReanchor:o()},play:async({canvasElement:e})=>{let t=c(e);await a(t.getByRole(`button`,{name:`保存`})).toBeDisabled(),await a(t.getByRole(`alert`)).toHaveTextContent(`再アンカー`),await s.click(t.getByRole(`button`,{name:`再アンカー`}))}},m={args:{canSubmit:!1,disabledReason:`revisionOverflow`}},h={args:{errorMessage:`他の更新と競合しました。入力内容を保持しています。`,onRetry:o()},play:async({canvasElement:e})=>{let t=c(e);await a(t.getByRole(`textbox`)).toHaveValue(`Null caseを明示してください`),await a(t.getByRole(`button`,{name:`保存を再試行`})).toBeEnabled()}},g={args:{body:``,statusMessage:`コメントを保存しました`,isDurabilityUncertain:!0},play:async({canvasElement:e})=>{let t=c(e);await a(t.queryByRole(`button`,{name:`保存を再試行`})).toBeNull(),await a(t.getByText(/再読み込みして確認/)).toBeVisible()}},_={render:()=>(0,i.jsxs)(`div`,{style:{display:`grid`,gap:24},children:[(0,i.jsx)(r,{...l.args,id:`transient-failure`,label:`一時的な保存失敗`,errorMessage:`storeBusy: 入力内容を保持しています。`,onRetry:o()}),(0,i.jsx)(r,{...l.args,id:`permission-failure`,label:`権限エラー`,canSubmit:!1,disabledReason:`permission`}),(0,i.jsx)(r,{...l.args,id:`overflow-failure`,label:`revision上限`,canSubmit:!1,disabledReason:`revisionOverflow`})]}),play:async({canvasElement:e})=>{let t=c(e);await a(t.getByRole(`button`,{name:`保存を再試行`})).toBeEnabled(),await a(t.getByRole(`form`,{name:`権限エラー`}).querySelector(`textarea`)).toHaveValue(`Null caseを明示してください`),await a(t.getByRole(`form`,{name:`revision上限`}).querySelector(`textarea`)).toHaveValue(`Null caseを明示してください`),await a(t.getAllByRole(`button`,{name:`保存`})[1]).toBeDisabled(),await a(t.getAllByRole(`button`,{name:`保存`})[2]).toBeDisabled(),await a(t.queryByText(/export/i)).toBeNull()}},v={args:{isDurabilityUncertain:!0,onRetry:o()},parameters:{themes:{themeOverride:`dark`}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{}`,...u.parameters?.docs?.source}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    statusMessage: "保存しています",
    errorMessage: "競合を解消してから再試行してください"
  }
}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    body: "",
    isSaving: true
  }
}`,...f.parameters?.docs?.source}}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    canSubmit: false,
    disabledReason: "staleTarget",
    onReanchor: fn()
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", {
      name: "保存"
    })).toBeDisabled();
    await expect(canvas.getByRole("alert")).toHaveTextContent("再アンカー");
    await userEvent.click(canvas.getByRole("button", {
      name: "再アンカー"
    }));
  }
}`,...p.parameters?.docs?.source}}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    canSubmit: false,
    disabledReason: "revisionOverflow"
  }
}`,...m.parameters?.docs?.source}}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    errorMessage: "他の更新と競合しました。入力内容を保持しています。",
    onRetry: fn()
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const editor = canvas.getByRole("textbox");
    await expect(editor).toHaveValue("Null caseを明示してください");
    await expect(canvas.getByRole("button", {
      name: "保存を再試行"
    })).toBeEnabled();
  }
}`,...h.parameters?.docs?.source}}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    body: "",
    statusMessage: "コメントを保存しました",
    isDurabilityUncertain: true
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button", {
      name: "保存を再試行"
    })).toBeNull();
    await expect(canvas.getByText(/再読み込みして確認/)).toBeVisible();
  }
}`,...g.parameters?.docs?.source}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
  render: () => <div style={{
    display: "grid",
    gap: 24
  }}>
      <DiffCommentComposer {...meta.args} id="transient-failure" label="一時的な保存失敗" errorMessage="storeBusy: 入力内容を保持しています。" onRetry={fn()} />
      <DiffCommentComposer {...meta.args} id="permission-failure" label="権限エラー" canSubmit={false} disabledReason="permission" />
      <DiffCommentComposer {...meta.args} id="overflow-failure" label="revision上限" canSubmit={false} disabledReason="revisionOverflow" />
    </div>,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", {
      name: "保存を再試行"
    })).toBeEnabled();
    await expect(canvas.getByRole("form", {
      name: "権限エラー"
    }).querySelector("textarea")).toHaveValue("Null caseを明示してください");
    await expect(canvas.getByRole("form", {
      name: "revision上限"
    }).querySelector("textarea")).toHaveValue("Null caseを明示してください");
    await expect(canvas.getAllByRole("button", {
      name: "保存"
    })[1]).toBeDisabled();
    await expect(canvas.getAllByRole("button", {
      name: "保存"
    })[2]).toBeDisabled();
    await expect(canvas.queryByText(/export/i)).toBeNull();
  }
}`,..._.parameters?.docs?.source}}},v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    isDurabilityUncertain: true,
    onRetry: fn()
  },
  parameters: {
    themes: {
      themeOverride: "dark"
    }
  }
}`,...v.parameters?.docs?.source}}},y=[`Default`,`AllProps`,`EdgeCases`,`StaleTarget`,`RevisionOverflow`,`RevisionConflict`,`CommittedWarnings`,`PreCommitFailures`,`DurabilityUncertain`]}))();export{d as AllProps,g as CommittedWarnings,u as Default,v as DurabilityUncertain,f as EdgeCases,_ as PreCommitFailures,h as RevisionConflict,m as RevisionOverflow,p as StaleTarget,y as __namedExportsOrder,l as default};