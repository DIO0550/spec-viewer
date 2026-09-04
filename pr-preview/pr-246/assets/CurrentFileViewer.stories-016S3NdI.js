import{a as e,n as t}from"./chunk-DnJy8xQt.js";import{i as n}from"./iframe-CrSqcxnf.js";import{t as r}from"./jsx-runtime-TRoWuN2H.js";import{r as i,t as a}from"./fileDiff-TdM4mg1F.js";import{n as o,t as s}from"./DiffViewer-DAvwa_OL.js";import{n as c,t as l}from"./CurrentFileViewer-D3OO4wdu.js";import{r as u,t as d}from"./testFixtures-R06EYCvB.js";function f(){return(0,S.jsxs)(`div`,{style:{display:`grid`,gap:16},children:[(0,S.jsx)(p,{label:`Current unavailable`,children:(0,S.jsx)(l,{fileDiff:v(),revisionKey:`matrix:binary`})}),(0,S.jsx)(p,{label:`Structured diff unavailable / degraded`,children:(0,S.jsx)(l,{fileDiff:y(),revisionKey:`matrix:degraded`})}),(0,S.jsx)(p,{label:`Availability empty + non-empty current`,children:(0,S.jsx)(l,{fileDiff:d({oldContent:`available-empty-diff`,newContent:`available-empty-diff`,lines:[]}),revisionKey:`matrix:available-empty-diff`})}),(0,S.jsx)(p,{label:`Empty file`,children:(0,S.jsx)(l,{fileDiff:d({oldContent:``,newContent:``,lines:[]}),revisionKey:`matrix:empty`})}),(0,S.jsx)(p,{label:`Pure rename`,children:(0,S.jsx)(l,{fileDiff:d({status:`renamed`,oldPath:`src/old-name.ts`,newPath:`src/new-name.ts`,oldContent:`renamed-current`,newContent:`renamed-current`,lines:[]}),revisionKey:`matrix:rename`})}),(0,S.jsx)(p,{label:`Copy`,children:(0,S.jsx)(l,{fileDiff:d({status:`copied`,oldPath:`src/source.ts`,newPath:`src/copy.ts`,oldContent:`copied-current`,newContent:`copied-current`,lines:[]}),revisionKey:`matrix:copy`})}),(0,S.jsx)(p,{label:`Type changed`,children:(0,S.jsx)(l,{fileDiff:d({status:`typeChanged`,oldContent:`type-changed-current`,newContent:`type-changed-current`,lines:[]}),revisionKey:`matrix:type-changed`})})]})}function p(e){return(0,S.jsxs)(`section`,{children:[(0,S.jsx)(`h3`,{children:e.label}),e.children]})}function m(){return(0,S.jsxs)(`div`,{style:{display:`grid`,gap:16},children:[(0,S.jsxs)(`section`,{children:[(0,S.jsx)(`h3`,{children:`LF`}),(0,S.jsx)(l,{fileDiff:d({oldContent:`first
second`,newContent:`first
second`,lines:[]}),revisionKey:`endings:lf`})]}),(0,S.jsxs)(`section`,{children:[(0,S.jsx)(`h3`,{children:`CRLF`}),(0,S.jsx)(l,{fileDiff:d({oldContent:`first\r
second\r
`,newContent:`first\r
second\r
`,lines:[]}),revisionKey:`endings:crlf`})]}),(0,S.jsxs)(`section`,{children:[(0,S.jsx)(`h3`,{children:`Final newlineなし`}),(0,S.jsx)(l,{fileDiff:d({oldContent:`first\rsecond`,newContent:`first\rsecond`,lines:[]}),revisionKey:`endings:cr`})]})]})}function h(){return(0,S.jsx)(`div`,{style:{display:`grid`,gap:16},children:[{label:`Old range`,fileDiff:d({oldContent:`old`,newContent:`new`,hunks:[{header:`@@ -1 +1 @@`,lines:[{kind:`removed`,text:`old`,oldLineNumber:2,newLineNumber:null},{kind:`added`,text:`new`,oldLineNumber:null,newLineNumber:1}]}]})},{label:`New range`,fileDiff:d({oldContent:`old`,newContent:`new`,hunks:[{header:`@@ -1 +1 @@`,lines:[{kind:`removed`,text:`old`,oldLineNumber:1,newLineNumber:null},{kind:`added`,text:`new`,oldLineNumber:null,newLineNumber:2}]}]})},{label:`Hunk order`,fileDiff:d({oldContent:`old-first
old-second`,newContent:`new-first
new-second`,hunks:[a.fromLines(`@@ -2 +2 @@`,[{kind:`removed`,text:`old-second`},{kind:`added`,text:`new-second`}]),a.fromLines(`@@ -1 +1 @@`,[{kind:`removed`,text:`old-first`},{kind:`added`,text:`new-first`}])]})},{label:`Hunk overlap`,fileDiff:d({oldContent:`old`,newContent:`new`,hunks:[a.fromLines(`@@ -1 +1 @@`,[{kind:`removed`,text:`old`},{kind:`added`,text:`new`}]),a.fromLines(`@@ -1 +1 @@`,[{kind:`removed`,text:`old`},{kind:`added`,text:`new`}])]})},{label:`Old text mismatch`,fileDiff:d({oldContent:`old`,newContent:`new`,hunks:[a.fromLines(`@@ -1 +1 @@`,[{kind:`removed`,text:`different-old`},{kind:`added`,text:`new`}])]})},{label:`New text mismatch`,fileDiff:d({oldContent:`old`,newContent:`new`,hunks:[a.fromLines(`@@ -1 +1 @@`,[{kind:`removed`,text:`old`},{kind:`added`,text:`different-new`}])]})}].map(e=>(0,S.jsxs)(`section`,{children:[(0,S.jsx)(`h3`,{children:e.label}),(0,S.jsx)(l,{fileDiff:e.fileDiff,revisionKey:`invalid:${e.label}`})]},e.label))})}function g(){let[e,t]=(0,x.useState)(1),[n,r]=(0,x.useState)(`editor`);return(0,S.jsxs)(`div`,{style:{display:`grid`,height:360},children:[(0,S.jsxs)(`div`,{role:`toolbar`,"aria-label":`Story controls`,children:[(0,S.jsx)(`button`,{type:`button`,onClick:()=>r(`unified`),children:`Unified`}),(0,S.jsx)(`button`,{type:`button`,onClick:()=>r(`editor`),children:`Editor`}),(0,S.jsx)(`button`,{type:`button`,onClick:()=>t(e=>e+1),children:`Refresh`})]}),n===`editor`?(0,S.jsx)(l,{fileDiff:D,revisionKey:`workspace:snapshot-${e}:file.ts`,activeChangeId:`hunk-0-change-1`,onActiveChangeIdChange:w()}):(0,S.jsx)(s,{fileDiff:D,mode:`unified`,activeChangeId:`hunk-0-change-1`,onActiveChangeIdChange:w()})]})}function _(){let e=Array.from({length:120},(e,t)=>`current-${t+1}`);return d({oldContent:[`old-start`,...e.slice(0,60),`old-middle`,...e.slice(60),`old-eof`].join(`
`),newContent:e.join(`
`),hunks:[a.fromLines(`@@ -1 +1,0 @@`,[{kind:`removed`,text:`old-start`}]),a.fromLines(`@@ -62 +61,0 @@`,[{kind:`removed`,text:`old-middle`}]),a.fromLines(`@@ -123 +121,0 @@`,[{kind:`removed`,text:`old-eof`}])]})}function v(){let e=d({omissionReason:`binary`});return{...e,review:{...e.review,newContent:{state:`omitted`,text:null,reason:`binary`,byteLength:12}},availability:{kind:`omitted`,reason:`binary`}}}function y(){let e=d({newContent:`current
content`});return{...e,review:{...e.review,structuredDiff:{state:`omitted`,hunks:[],reason:`diffLimit`}},availability:{kind:`omitted`,reason:`diffLimit`}}}function b(){return Array.from({length:2e4},(e,t)=>`export const line${t+1} = true;`).join(`
`)}var x,S,C,w,T,E,D,O,k,A,j,M,N,P,F,I,L,R,z,B,V,H,U,W,G,K;t((()=>{x=e(n(),1),c(),o(),u(),i(),S=r(),{expect:C,fn:w,userEvent:T,within:E}=__STORYBOOK_MODULE_TEST__,D=d({oldContent:`const removed = true;
const keepA = true;
const mode = 'legacy';
const keepB = true;`,newContent:`const keepA = true;
const mode = 'editor';
const keepB = true;
const added = true;`,hunks:[a.fromLines(`@@ -1,4 +1,4 @@`,[{kind:`removed`,text:`const removed = true;`},{kind:`context`,text:`const keepA = true;`},{kind:`removed`,text:`const mode = 'legacy';`},{kind:`added`,text:`const mode = 'editor';`},{kind:`context`,text:`const keepB = true;`},{kind:`added`,text:`const added = true;`}])]}),O=_(),k={component:l,parameters:{layout:`fullscreen`},args:{fileDiff:D,revisionKey:`story:default`,activeChangeId:`hunk-0-change-0`,onActiveChangeIdChange:w()},argTypes:{fileDiff:{control:!1},revisionKey:{control:!1},activeChangeId:{control:!1},onActiveChangeIdChange:{control:!1}}},A={},j={args:{fileDiff:O,revisionKey:`story:all-props`,activeChangeId:`hunk-1-change-0`},play:async({canvasElement:e})=>{let t=E(e),n=t.getAllByRole(`button`,{name:`1行削除`});await C(n).toHaveLength(3),await C(t.getByRole(`grid`)).toHaveAttribute(`aria-rowcount`,`123`);for(let e of n)await T.click(e);await C(e).toHaveTextContent(`old-start`),await C(e).toHaveTextContent(`old-middle`),await C(e).toHaveTextContent(`old-eof`)}},M={args:{fileDiff:d({status:`renamed`,oldPath:`src/old-name.ts`,newPath:`src/new-name.ts`,oldContent:`unchanged`,newContent:`unchanged`,lines:[]}),revisionKey:`story:renamed-empty-diff`,activeChangeId:null}},N={args:{fileDiff:d({oldContent:``,newContent:``,lines:[]}),revisionKey:`story:empty`,activeChangeId:null}},P={args:{fileDiff:y(),revisionKey:`story:degraded`,activeChangeId:null}},F={args:{fileDiff:v(),revisionKey:`story:binary`,activeChangeId:null}},I={args:{fileDiff:d({status:`untracked`,oldContent:void 0,newContent:`const first = true;
const second = true;`,hunks:[a.fromLines(`@@ -0,0 +1,2 @@`,[{kind:`added`,text:`const first = true;`},{kind:`added`,text:`const second = true;`}])]}),revisionKey:`story:untracked`,activeChangeId:`hunk-0-change-0`}},L={args:{fileDiff:d({status:`deleted`,oldContent:`const first = true;
const second = true;`,hunks:[a.fromLines(`@@ -1,2 +0,0 @@`,[{kind:`removed`,text:`const first = true;`},{kind:`removed`,text:`const second = true;`}])]}),revisionKey:`story:deleted`,activeChangeId:`hunk-0-change-0`}},R={args:{fileDiff:d({oldContent:`x`.repeat(4e3),newContent:`x`.repeat(4e3),lines:[]}),revisionKey:`story:long-line`,activeChangeId:null},play:async({canvasElement:e})=>{let t=e.querySelector(`.current-file-viewer__scroll-surface`),n=e.querySelector(`.current-file-viewer__code`);await C(getComputedStyle(n).whiteSpace).toBe(`pre`),await C(t.scrollWidth).toBeGreaterThan(t.clientWidth),await C(e.querySelectorAll(`[role="row"]`)).toHaveLength(1)}},z={args:{fileDiff:d({oldContent:b(),newContent:b(),lines:[]}),revisionKey:`story:large`,activeChangeId:null},play:async({canvasElement:e})=>{await C(e.querySelectorAll(`[role="row"]`).length).toBeLessThanOrEqual(500),await C(E(e).getByRole(`grid`)).toHaveAttribute(`aria-rowcount`,`20000`)}},B={play:async({canvasElement:e})=>{await C(E(e).getByText(`const mode = 'editor';`)).toBeInTheDocument(),await C(e).not.toHaveTextContent(`変更前`),await C(e).not.toHaveTextContent(`legacy`),await C(e).not.toHaveTextContent(`No newline at end of file`),await C(e.querySelector(`[data-row-kind="peek-line"]`)).toBeNull()}},V={render:()=>(0,S.jsx)(f,{}),play:async({canvasElement:e})=>{let t=E(e);await C(t.getByRole(`heading`,{name:`Current unavailable`})).toBeInTheDocument(),await C(t.getByRole(`heading`,{name:`Structured diff unavailable / degraded`})).toBeInTheDocument(),await C(t.getByRole(`heading`,{name:`Pure rename`})).toBeInTheDocument(),await C(t.getByRole(`heading`,{name:`Copy`})).toBeInTheDocument(),await C(t.getByRole(`heading`,{name:`Type changed`})).toBeInTheDocument()}},H={render:()=>(0,S.jsx)(m,{})},U={render:()=>(0,S.jsx)(h,{}),play:async({canvasElement:e})=>{await C(E(e).getAllByRole(`alert`)).toHaveLength(6)}},W={render:()=>(0,S.jsx)(g,{}),play:async({canvasElement:e})=>{let t=E(e);await C(e).not.toHaveTextContent(`変更前`),await T.click(t.getByRole(`button`,{name:`Refresh`})),await C(e).not.toHaveTextContent(`変更前`),await T.click(t.getByRole(`button`,{name:`Unified`})),await C(t.getByLabelText(/の差分$/)).toBeInTheDocument(),await T.click(t.getByRole(`button`,{name:`Editor`})),await C(t.getByLabelText(/のcurrent内容$/)).toBeInTheDocument()}},G={globals:{theme:`Dark`}},A.parameters={...A.parameters,docs:{...A.parameters?.docs,source:{originalSource:`{}`,...A.parameters?.docs?.source}}},j.parameters={...j.parameters,docs:{...j.parameters?.docs,source:{originalSource:`{
  args: {
    fileDiff: AllPropsFixture,
    revisionKey: "story:all-props",
    activeChangeId: "hunk-1-change-0"
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole("button", {
      name: "1行削除"
    });
    await expect(buttons).toHaveLength(3);
    await expect(canvas.getByRole("grid")).toHaveAttribute("aria-rowcount", "123");
    for (const button of buttons) {
      await userEvent.click(button);
    }
    await expect(canvasElement).toHaveTextContent("old-start");
    await expect(canvasElement).toHaveTextContent("old-middle");
    await expect(canvasElement).toHaveTextContent("old-eof");
  }
}`,...j.parameters?.docs?.source}}},M.parameters={...M.parameters,docs:{...M.parameters?.docs,source:{originalSource:`{
  args: {
    fileDiff: createDiffViewerFixture({
      status: "renamed",
      oldPath: "src/old-name.ts",
      newPath: "src/new-name.ts",
      oldContent: "unchanged",
      newContent: "unchanged",
      lines: []
    }),
    revisionKey: "story:renamed-empty-diff",
    activeChangeId: null
  }
}`,...M.parameters?.docs?.source}}},N.parameters={...N.parameters,docs:{...N.parameters?.docs,source:{originalSource:`{
  args: {
    fileDiff: createDiffViewerFixture({
      oldContent: "",
      newContent: "",
      lines: []
    }),
    revisionKey: "story:empty",
    activeChangeId: null
  }
}`,...N.parameters?.docs?.source}}},P.parameters={...P.parameters,docs:{...P.parameters?.docs,source:{originalSource:`{
  args: {
    fileDiff: createDegradedFixture(),
    revisionKey: "story:degraded",
    activeChangeId: null
  }
}`,...P.parameters?.docs?.source}}},F.parameters={...F.parameters,docs:{...F.parameters?.docs,source:{originalSource:`{
  args: {
    fileDiff: createCurrentUnavailableFixture(),
    revisionKey: "story:binary",
    activeChangeId: null
  }
}`,...F.parameters?.docs?.source}}},I.parameters={...I.parameters,docs:{...I.parameters?.docs,source:{originalSource:`{
  args: {
    fileDiff: createDiffViewerFixture({
      status: "untracked",
      oldContent: undefined,
      newContent: "const first = true;\\nconst second = true;",
      hunks: [Hunk.fromLines("@@ -0,0 +1,2 @@", [{
        kind: "added",
        text: "const first = true;"
      }, {
        kind: "added",
        text: "const second = true;"
      }])]
    }),
    revisionKey: "story:untracked",
    activeChangeId: "hunk-0-change-0"
  }
}`,...I.parameters?.docs?.source}}},L.parameters={...L.parameters,docs:{...L.parameters?.docs,source:{originalSource:`{
  args: {
    fileDiff: createDiffViewerFixture({
      status: "deleted",
      oldContent: "const first = true;\\nconst second = true;",
      hunks: [Hunk.fromLines("@@ -1,2 +0,0 @@", [{
        kind: "removed",
        text: "const first = true;"
      }, {
        kind: "removed",
        text: "const second = true;"
      }])]
    }),
    revisionKey: "story:deleted",
    activeChangeId: "hunk-0-change-0"
  }
}`,...L.parameters?.docs?.source}}},R.parameters={...R.parameters,docs:{...R.parameters?.docs,source:{originalSource:`{
  args: {
    fileDiff: createDiffViewerFixture({
      oldContent: "x".repeat(4_000),
      newContent: "x".repeat(4_000),
      lines: []
    }),
    revisionKey: "story:long-line",
    activeChangeId: null
  },
  play: async ({
    canvasElement
  }) => {
    const surface = canvasElement.querySelector<HTMLElement>(".current-file-viewer__scroll-surface");
    const code = canvasElement.querySelector<HTMLElement>(".current-file-viewer__code");
    await expect(getComputedStyle(code!).whiteSpace).toBe("pre");
    await expect(surface!.scrollWidth).toBeGreaterThan(surface!.clientWidth);
    await expect(canvasElement.querySelectorAll('[role="row"]')).toHaveLength(1);
  }
}`,...R.parameters?.docs?.source}}},z.parameters={...z.parameters,docs:{...z.parameters?.docs,source:{originalSource:`{
  args: {
    fileDiff: createDiffViewerFixture({
      oldContent: createLargeContent(),
      newContent: createLargeContent(),
      lines: []
    }),
    revisionKey: "story:large",
    activeChangeId: null
  },
  play: async ({
    canvasElement
  }) => {
    await expect(canvasElement.querySelectorAll('[role="row"]').length).toBeLessThanOrEqual(500);
    await expect(within(canvasElement).getByRole("grid")).toHaveAttribute("aria-rowcount", "20000");
  }
}`,...z.parameters?.docs?.source}}},B.parameters={...B.parameters,docs:{...B.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("const mode = 'editor';")).toBeInTheDocument();
    await expect(canvasElement).not.toHaveTextContent("変更前");
    await expect(canvasElement).not.toHaveTextContent("legacy");
    await expect(canvasElement).not.toHaveTextContent("No newline at end of file");
    await expect(canvasElement.querySelector('[data-row-kind="peek-line"]')).toBeNull();
  }
}`,...B.parameters?.docs?.source}}},V.parameters={...V.parameters,docs:{...V.parameters?.docs,source:{originalSource:`{
  render: () => <AvailabilityMatrixFixture />,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", {
      name: "Current unavailable"
    })).toBeInTheDocument();
    await expect(canvas.getByRole("heading", {
      name: "Structured diff unavailable / degraded"
    })).toBeInTheDocument();
    await expect(canvas.getByRole("heading", {
      name: "Pure rename"
    })).toBeInTheDocument();
    await expect(canvas.getByRole("heading", {
      name: "Copy"
    })).toBeInTheDocument();
    await expect(canvas.getByRole("heading", {
      name: "Type changed"
    })).toBeInTheDocument();
  }
}`,...V.parameters?.docs?.source}}},H.parameters={...H.parameters,docs:{...H.parameters?.docs,source:{originalSource:`{
  render: () => <LineEndingsFixture />
}`,...H.parameters?.docs?.source}}},U.parameters={...U.parameters,docs:{...U.parameters?.docs,source:{originalSource:`{
  render: () => <InvalidHunkFixture />,
  play: async ({
    canvasElement
  }) => {
    await expect(within(canvasElement).getAllByRole("alert")).toHaveLength(6);
  }
}`,...U.parameters?.docs?.source}}},W.parameters={...W.parameters,docs:{...W.parameters?.docs,source:{originalSource:`{
  render: () => <WorkspaceRefreshModeFixture />,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvasElement).not.toHaveTextContent("変更前");
    await userEvent.click(canvas.getByRole("button", {
      name: "Refresh"
    }));
    await expect(canvasElement).not.toHaveTextContent("変更前");
    await userEvent.click(canvas.getByRole("button", {
      name: "Unified"
    }));
    await expect(canvas.getByLabelText(/の差分$/)).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", {
      name: "Editor"
    }));
    await expect(canvas.getByLabelText(/のcurrent内容$/)).toBeInTheDocument();
  }
}`,...W.parameters?.docs?.source}}},G.parameters={...G.parameters,docs:{...G.parameters?.docs,source:{originalSource:`{
  globals: {
    theme: "Dark"
  }
}`,...G.parameters?.docs?.source}}},K=[`Default`,`AllProps`,`EdgeCases`,`Empty`,`Degraded`,`Error`,`AddedOrUntracked`,`Deleted`,`LongSingleLine`,`LargeLineCount`,`CurrentContentOnly`,`AvailabilityMatrix`,`LineEndings`,`InvalidHunks`,`WorkspaceRefreshAndMode`,`DarkTheme`]}))();export{I as AddedOrUntracked,j as AllProps,V as AvailabilityMatrix,B as CurrentContentOnly,G as DarkTheme,A as Default,P as Degraded,L as Deleted,M as EdgeCases,N as Empty,F as Error,U as InvalidHunks,z as LargeLineCount,H as LineEndings,R as LongSingleLine,W as WorkspaceRefreshAndMode,K as __namedExportsOrder,k as default};