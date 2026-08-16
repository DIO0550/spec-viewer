import{n as e}from"./chunk-DnJy8xQt.js";import{r as t,t as n}from"./fileDiff-ChqXT9GT.js";import{n as r,t as i}from"./DiffViewer-CKpe7gpq.js";import{n as a,r as o,t as s}from"./testFixtures-D5vvipPF.js";var c,l,u,d,f,p,m,h,g,_,v,y,b,x,S,C,w,T,E;e((()=>{r(),t(),o(),{expect:c,fn:l,userEvent:u,within:d}=__STORYBOOK_MODULE_TEST__,f={component:i,parameters:{layout:`fullscreen`},args:{mode:`unified`,activeChangeId:null,onActiveChangeIdChange:l()},argTypes:{fileDiff:{control:!1}}},p={args:{fileDiff:s({status:`added`,lines:[{kind:`added`,text:`export const added = true;`},{kind:`added`,text:`export const longLine = "${`x`.repeat(240)}";`}]})}},m={args:{fileDiff:s({status:`deleted`,lines:[{kind:`removed`,text:`export const legacy = true;`},{kind:`removed`,text:`export const obsolete = true;`}]})}},h={args:{fileDiff:s({lines:[...Array.from({length:8},(e,t)=>({kind:`context`,text:`context ${t+1}`})),{kind:`removed`,text:`const first = before;`},{kind:`added`,text:`const first = after;`},{kind:`context`,text:`between`},{kind:`removed`,text:`const second = before;`},{kind:`added`,text:`const second = after;`},{kind:`noNewline`,text:`\\ No newline at end of file`}]})},play:async({canvasElement:e})=>{let t=d(e);await u.click(t.getByRole(`button`,{name:`次の変更`})),await c(t.getByRole(`button`,{name:`次の変更`})).toBeDisabled(),await u.click(t.getByRole(`button`,{name:`省略した2行を展開`})),await c(t.queryByRole(`button`,{name:`省略した2行を展開`})).not.toBeInTheDocument()}},g={args:{fileDiff:s({lines:Array.from({length:24},(e,t)=>({kind:`context`,text:`context `+(t+1)})),hunks:[n.fromLines(`@@ -1,2 +1,2 @@`,[{kind:`removed`,text:`const first = before;`},{kind:`added`,text:`const first = after;`}]),n.fromLines(`@@ -20,2 +20,2 @@`,[{kind:`removed`,text:`const second = before;`},{kind:`added`,text:`const second = after;`}])]})}},_={args:{fileDiff:s(),mode:`split`},play:async({canvasElement:e})=>{await c(e.querySelector(`.diff-viewer__row--split`)).not.toBeNull()}},v={globals:{theme:`Dark`},args:{fileDiff:s()}},y={args:{fileDiff:a()},play:async({canvasElement:e})=>{await c(e.querySelectorAll(`.diff-viewer__row`).length).toBeLessThanOrEqual(500)}},b={args:{fileDiff:s({lines:[]})}},x={args:{fileDiff:s({omissionReason:`largeFile`})}},S={args:{fileDiff:s({omissionReason:`binary`})}},C={args:{fileDiff:s({omissionReason:`missingSide`,status:`modified`})}},w={args:{fileDiff:s({omissionReason:`unsupportedEntryKind`})}},T={args:{fileDiff:s({status:`untracked`,lines:[{kind:`added`,text:`const untracked = true;`}]})}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    fileDiff: createDiffViewerFixture({
      status: "added",
      lines: [{
        kind: "added",
        text: "export const added = true;"
      }, {
        kind: "added",
        text: \`export const longLine = "\${"x".repeat(240)}";\`
      }]
    })
  }
}`,...p.parameters?.docs?.source}}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    fileDiff: createDiffViewerFixture({
      status: "deleted",
      lines: [{
        kind: "removed",
        text: "export const legacy = true;"
      }, {
        kind: "removed",
        text: "export const obsolete = true;"
      }]
    })
  }
}`,...m.parameters?.docs?.source}}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    fileDiff: createDiffViewerFixture({
      lines: [...Array.from({
        length: 8
      }, (_, index) => ({
        kind: "context" as const,
        text: \`context \${index + 1}\`
      })), {
        kind: "removed",
        text: "const first = before;"
      }, {
        kind: "added",
        text: "const first = after;"
      }, {
        kind: "context",
        text: "between"
      }, {
        kind: "removed",
        text: "const second = before;"
      }, {
        kind: "added",
        text: "const second = after;"
      }, {
        kind: "noNewline",
        text: "\\\\ No newline at end of file"
      }]
    })
  },
  /**
   * Verifies switching to side-by-side mode, navigating to the next change
   * disabling the "next" control at the last change, and expanding a
   * collapsed gap removes its expand button.
   *
   * @param context - Storybook play context providing the rendered canvas element.
   */
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", {
      name: "次の変更"
    }));
    await expect(canvas.getByRole("button", {
      name: "次の変更"
    })).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", {
      name: "省略した2行を展開"
    }));
    await expect(canvas.queryByRole("button", {
      name: "省略した2行を展開"
    })).not.toBeInTheDocument();
  }
}`,...h.parameters?.docs?.source}}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    fileDiff: createDiffViewerFixture({
      lines: Array.from({
        length: 24
      }, (_, index) => ({
        kind: "context" as const,
        text: "context " + (index + 1)
      })),
      hunks: [Hunk.fromLines("@@ -1,2 +1,2 @@", [{
        kind: "removed",
        text: "const first = before;"
      }, {
        kind: "added",
        text: "const first = after;"
      }]), Hunk.fromLines("@@ -20,2 +20,2 @@", [{
        kind: "removed",
        text: "const second = before;"
      }, {
        kind: "added",
        text: "const second = after;"
      }])]
    })
  }
}`,...g.parameters?.docs?.source}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
  args: {
    fileDiff: createDiffViewerFixture(),
    mode: "split"
  },
  play: async ({
    canvasElement
  }) => {
    await expect(canvasElement.querySelector(".diff-viewer__row--split")).not.toBeNull();
  }
}`,..._.parameters?.docs?.source}}},v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  globals: {
    theme: "Dark"
  },
  args: {
    fileDiff: createDiffViewerFixture()
  }
}`,...v.parameters?.docs?.source}}},y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    fileDiff: createLargeDiffViewerFixture()
  },
  /**
   * Verifies the virtualized row window never renders more than the
   * semantic row hard cap, regardless of the diff's total size.
   *
   * @param context - Storybook play context providing the rendered canvas element.
   */
  play: async ({
    canvasElement
  }) => {
    await expect(canvasElement.querySelectorAll(".diff-viewer__row").length).toBeLessThanOrEqual(500);
  }
}`,...y.parameters?.docs?.source}}},b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    fileDiff: createDiffViewerFixture({
      lines: []
    })
  }
}`,...b.parameters?.docs?.source}}},x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  args: {
    fileDiff: createDiffViewerFixture({
      omissionReason: "largeFile"
    })
  }
}`,...x.parameters?.docs?.source}}},S.parameters={...S.parameters,docs:{...S.parameters?.docs,source:{originalSource:`{
  args: {
    fileDiff: createDiffViewerFixture({
      omissionReason: "binary"
    })
  }
}`,...S.parameters?.docs?.source}}},C.parameters={...C.parameters,docs:{...C.parameters?.docs,source:{originalSource:`{
  args: {
    fileDiff: createDiffViewerFixture({
      omissionReason: "missingSide",
      status: "modified"
    })
  }
}`,...C.parameters?.docs?.source}}},w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  args: {
    fileDiff: createDiffViewerFixture({
      omissionReason: "unsupportedEntryKind"
    })
  }
}`,...w.parameters?.docs?.source}}},T.parameters={...T.parameters,docs:{...T.parameters?.docs,source:{originalSource:`{
  args: {
    fileDiff: createDiffViewerFixture({
      status: "untracked",
      lines: [{
        kind: "added",
        text: "const untracked = true;"
      }]
    })
  }
}`,...T.parameters?.docs?.source}}},E=[`AddedOnly`,`RemovedOnly`,`Mixed`,`MultipleHunks`,`KeyboardFocus`,`DarkTheme`,`LargeDiff`,`EmptyDiff`,`OmittedDiff`,`BinaryDiff`,`MissingSideDiff`,`UnsupportedDiff`,`UntrackedDiff`]}))();export{p as AddedOnly,S as BinaryDiff,v as DarkTheme,b as EmptyDiff,_ as KeyboardFocus,y as LargeDiff,C as MissingSideDiff,h as Mixed,g as MultipleHunks,x as OmittedDiff,m as RemovedOnly,w as UnsupportedDiff,T as UntrackedDiff,E as __namedExportsOrder,f as default};