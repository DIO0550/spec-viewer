import{n as e}from"./chunk-DnJy8xQt.js";import{n as t,t as n}from"./DiffReviewSidebar-I7MPA0Z8.js";var r,i,a,o,s,c,l,u,d,f,p,m,h,g,_,v,y,b;e((()=>{t(),{expect:r,fn:i,userEvent:a,within:o}=__STORYBOOK_MODULE_TEST__,s={component:n,args:{comments:[{id:`exact`,body:`Null caseを明示してください`,status:`open`,locationLabel:`src/parser.ts current 42行目`,snippet:`return parse(value);`,resolution:{status:`exact`},replies:[{id:`reply-1`,body:`確認しました。nullのときは早期returnにします。`,createdAt:`2026-08-21T00:00:00Z`}]},{id:`stale`,body:`削除理由を文書化してください`,status:`resolved`,locationLabel:`src/legacy.ts base 8行目`,snippet:`legacy();`,resolution:{status:`stale`,reason:`deleted`}}],filter:`all`,search:``,selectedCommentId:`exact`,loadState:`ready`,warnings:[],onFilterChange:i(),onSearchChange:i(),onSelectComment:i(),onJump:i(),onResolve:i(),onReply:i(),onReopen:i(),onDelete:i(),onReload:i()},argTypes:{onFilterChange:{control:!1},onSearchChange:{control:!1},onSelectComment:{control:!1},onJump:{control:!1},onResolve:{control:!1},onReply:{control:!1},onReopen:{control:!1},onDelete:{control:!1},onReload:{control:!1}}},c={},l={args:{warnings:[`2件のコメント位置を一時的に確認できません`],comments:[...s.args.comments,{id:`unavailable`,body:`sourceを再確認してください`,status:`open`,locationLabel:`src/io.ts current 3行目`,snippet:`load();`,resolution:{status:`unavailable`,reason:`io`}}]}},u={args:{comments:[],selectedCommentId:null}},d={args:{loadState:`loading`}},f=u,p={args:{loadState:`error`}},m={args:{comments:s.args.comments,filter:`resolved`,search:`legacy`,selectedCommentId:`stale`},play:async({canvasElement:e})=>{let t=o(e);await r(t.getByRole(`button`,{name:`解決済み 1`})).toHaveAttribute(`aria-pressed`,`true`),await r(t.getByText(`削除理由を文書化してください`)).not.toBeVisible(),await a.click(t.getByRole(`button`,{name:`コメントを展開 stale`})),await r(t.getByText(`削除理由を文書化してください`)).toBeVisible()}},h={args:{warnings:[`deadline と permission の位置解決を完了できませんでした`],comments:[{id:`exact-resolution`,body:`exact`,status:`open`,locationLabel:`src/exact.ts current 1行目`,snippet:`exact();`,resolution:{status:`exact`}},{id:`relocated-resolution`,body:`relocated`,status:`open`,locationLabel:`src/renamed.ts base 2行目`,snippet:`relocated();`,resolution:{status:`relocated`}},{id:`stale-resolution`,body:`stale`,status:`open`,locationLabel:`src/deleted.ts base 3行目`,snippet:`deleted();`,resolution:{status:`stale`,reason:`ambiguous`}},{id:`unavailable-resolution`,body:`unavailable`,status:`open`,locationLabel:`src/io.ts current 4行目`,snippet:`load();`,resolution:{status:`unavailable`,reason:`permission`}}],selectedCommentId:`relocated-resolution`},play:async({canvasElement:e})=>{let t=o(e);await r(t.getByRole(`button`,{name:/src\/exact\.ts current 1行目へ移動/})).toBeEnabled(),await r(t.getByRole(`button`,{name:/src\/renamed\.ts base 2行目へ移動/})).toBeEnabled(),await r(t.getByRole(`button`,{name:/src\/deleted\.ts base 3行目へ移動/})).toBeDisabled(),await r(t.getByRole(`button`,{name:/src\/io\.ts current 4行目へ移動/})).toBeDisabled()}},g={args:{warnings:[`競合後の最新revisionを読み込みました。編集内容は保持されています`],onUpdate:async()=>!1},play:async({canvasElement:e})=>{let t=o(e);await a.click(t.getByRole(`button`,{name:`コメントを編集 exact`}));let n=t.getByRole(`textbox`,{name:`コメント本文 exact`});await a.clear(n),await a.type(n,`競合後も保持する編集`),await a.click(t.getByRole(`button`,{name:`保存 exact`})),await r(n).toHaveValue(`競合後も保持する編集`),await r(n).toHaveFocus()}},_={args:{warnings:[`保存は完了しましたが永続化の確認が不確実です`,`1件のコメント位置を一時的に確認できません`],selectedCommentId:`exact`}},v={args:{warnings:[`deadline、cancelled`],comments:[...s.args.comments,...Array.from({length:4},(e,t)=>({id:`stopped-${t}`,body:`resolver suffix ${t}`,status:`open`,locationLabel:`src/stopped-${t}.ts current ${t+1}行目`,snippet:`pending();`,resolution:{status:`unavailable`,reason:t<2?`budgetExceeded`:`cancelled`}}))],selectedCommentId:`stopped-3`},play:async({canvasElement:e})=>{let t=o(e);await r(t.getAllByText(/resolver suffix/)).toHaveLength(4);for(let e of t.getAllByRole(`button`,{name:/へ移動/}))e.getAttribute(`aria-label`)?.includes(`stopped`)&&await r(e).toBeDisabled()}},y={args:{comments:Array.from({length:1e4},(e,t)=>({id:`large-${t}`,body:`Review comment ${t}`,status:`open`,locationLabel:`src/large.ts current ${t+1}行目`,snippet:`line ${t+1}`,resolution:{status:`exact`}})),selectedCommentId:`large-9999`},play:async({canvasElement:e})=>{await r(o(e).getByRole(`button`,{name:`src/large.ts current 10000行目のコメントを選択`})).toHaveFocus(),await r(e.querySelectorAll(`article[data-comment-id]`)).toHaveLength(100)}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{}`,...c.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    warnings: ["2件のコメント位置を一時的に確認できません"],
    comments: [...meta.args.comments, {
      id: "unavailable",
      body: "sourceを再確認してください",
      status: "open",
      locationLabel: "src/io.ts current 3行目",
      snippet: "load();",
      resolution: {
        status: "unavailable",
        reason: "io"
      }
    }]
  }
}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    comments: [],
    selectedCommentId: null
  }
}`,...u.parameters?.docs?.source}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    loadState: "loading"
  }
}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`EdgeCases`,...f.parameters?.docs?.source}}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    loadState: "error"
  }
}`,...p.parameters?.docs?.source}}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    comments: meta.args.comments,
    filter: "resolved",
    search: "legacy",
    selectedCommentId: "stale"
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", {
      name: "解決済み 1"
    })).toHaveAttribute("aria-pressed", "true");
    await expect(canvas.getByText("削除理由を文書化してください")).not.toBeVisible();
    await userEvent.click(canvas.getByRole("button", {
      name: "コメントを展開 stale"
    }));
    await expect(canvas.getByText("削除理由を文書化してください")).toBeVisible();
  }
}`,...m.parameters?.docs?.source}}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    warnings: ["deadline と permission の位置解決を完了できませんでした"],
    comments: [{
      id: "exact-resolution",
      body: "exact",
      status: "open",
      locationLabel: "src/exact.ts current 1行目",
      snippet: "exact();",
      resolution: {
        status: "exact"
      }
    }, {
      id: "relocated-resolution",
      body: "relocated",
      status: "open",
      locationLabel: "src/renamed.ts base 2行目",
      snippet: "relocated();",
      resolution: {
        status: "relocated"
      }
    }, {
      id: "stale-resolution",
      body: "stale",
      status: "open",
      locationLabel: "src/deleted.ts base 3行目",
      snippet: "deleted();",
      resolution: {
        status: "stale",
        reason: "ambiguous"
      }
    }, {
      id: "unavailable-resolution",
      body: "unavailable",
      status: "open",
      locationLabel: "src/io.ts current 4行目",
      snippet: "load();",
      resolution: {
        status: "unavailable",
        reason: "permission"
      }
    }],
    selectedCommentId: "relocated-resolution"
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", {
      name: /src\\/exact\\.ts current 1行目へ移動/
    })).toBeEnabled();
    await expect(canvas.getByRole("button", {
      name: /src\\/renamed\\.ts base 2行目へ移動/
    })).toBeEnabled();
    await expect(canvas.getByRole("button", {
      name: /src\\/deleted\\.ts base 3行目へ移動/
    })).toBeDisabled();
    await expect(canvas.getByRole("button", {
      name: /src\\/io\\.ts current 4行目へ移動/
    })).toBeDisabled();
  }
}`,...h.parameters?.docs?.source}}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    warnings: ["競合後の最新revisionを読み込みました。編集内容は保持されています"],
    onUpdate: async () => false
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", {
      name: "コメントを編集 exact"
    }));
    const editor = canvas.getByRole("textbox", {
      name: "コメント本文 exact"
    });
    await userEvent.clear(editor);
    await userEvent.type(editor, "競合後も保持する編集");
    await userEvent.click(canvas.getByRole("button", {
      name: "保存 exact"
    }));
    await expect(editor).toHaveValue("競合後も保持する編集");
    await expect(editor).toHaveFocus();
  }
}`,...g.parameters?.docs?.source}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
  args: {
    warnings: ["保存は完了しましたが永続化の確認が不確実です", "1件のコメント位置を一時的に確認できません"],
    selectedCommentId: "exact"
  }
}`,..._.parameters?.docs?.source}}},v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    warnings: ["deadline、cancelled"],
    comments: [...meta.args.comments, ...Array.from({
      length: 4
    }, (_, index) => ({
      id: \`stopped-\${index}\`,
      body: \`resolver suffix \${index}\`,
      status: "open" as const,
      locationLabel: \`src/stopped-\${index}.ts current \${index + 1}行目\`,
      snippet: "pending();",
      resolution: {
        status: "unavailable" as const,
        reason: index < 2 ? "budgetExceeded" : "cancelled"
      }
    }))],
    selectedCommentId: "stopped-3"
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText(/resolver suffix/)).toHaveLength(4);
    for (const button of canvas.getAllByRole("button", {
      name: /へ移動/
    })) {
      if (button.getAttribute("aria-label")?.includes("stopped")) {
        await expect(button).toBeDisabled();
      }
    }
  }
}`,...v.parameters?.docs?.source}}},y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    comments: Array.from({
      length: 10_000
    }, (_, index) => ({
      id: \`large-\${index}\`,
      body: \`Review comment \${index}\`,
      status: "open" as const,
      locationLabel: \`src/large.ts current \${index + 1}行目\`,
      snippet: \`line \${index + 1}\`,
      resolution: {
        status: "exact" as const
      }
    })),
    selectedCommentId: "large-9999"
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", {
      name: "src/large.ts current 10000行目のコメントを選択"
    })).toHaveFocus();
    await expect(canvasElement.querySelectorAll("article[data-comment-id]")).toHaveLength(100);
  }
}`,...y.parameters?.docs?.source}}},b=[`Default`,`AllProps`,`EdgeCases`,`Loading`,`Empty`,`Error`,`StatusFilters`,`ResolutionStates`,`RevisionConflict`,`CommittedWarnings`,`ResolverStopped`,`LargeReviewList`]}))();export{l as AllProps,_ as CommittedWarnings,c as Default,u as EdgeCases,f as Empty,p as Error,y as LargeReviewList,d as Loading,h as ResolutionStates,v as ResolverStopped,g as RevisionConflict,m as StatusFilters,b as __namedExportsOrder,s as default};