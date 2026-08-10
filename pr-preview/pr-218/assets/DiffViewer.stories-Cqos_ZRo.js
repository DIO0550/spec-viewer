import{n as e}from"./chunk-DnJy8xQt.js";import{n as t,t as n}from"./DiffViewer-C19PXyDa.js";import{n as r,r as i,t as a}from"./fileDiff-BJ-3HsWK.js";function o(e={}){let t=e.lines??[{kind:`context`,text:`const before = 1;`},{kind:`removed`,text:`const first = before;`},{kind:`added`,text:`const first = after;`},{kind:`context`,text:`const middle = true;`},{kind:`removed`,text:`const second = before;`},{kind:`added`,text:`const second = after;`}],n=e.status??`modified`,i=e.omissionReason??null,o=n===`added`||n===`untracked`,s=n===`deleted`,d=e.contentClassification??(i===`binary`?`binary`:`text`),f=e.oldPath??(o?null:`implementation-plan.md`),p=e.newPath??(s?null:`implementation-plan.md`),m=i===null?{state:`available`,hunks:e.hunks??(t.length===0?[]:[a.fromLines(`@@ -1,6 +1,6 @@`,t)]),reason:null}:{state:`omitted`,hunks:[],reason:i},h={file:{oldPath:f,newPath:p,change:n,entryKind:`regular`,contentClassification:d,similarity:null,oldMode:o?null:`100644`,newMode:s?null:`100644`},oldContent:c(e.oldContent,o,t.map(e=>e.text).join(`
`)),newContent:c(e.newContent,s,t.map(e=>e.text).join(`
`)),patch:i===null?l(``):u(i),structuredDiff:m,submodule:null};return{identity:{sourceId:`spec:078-issue-167`,path:e.fileKey??`implementation-plan`},review:h,availability:r(h)}}function s(e=2e4){return o({lines:Array.from({length:e},(e,t)=>({kind:t%2==0?`removed`:`added`,text:`const line${t} = ${t};`}))})}function c(e,t,n){return e===void 0?t?u(`missingSide`):l(n):l(e)}function l(e){return{state:`available`,text:e,reason:null,byteLength:null}}function u(e){return{state:`omitted`,text:null,reason:e,byteLength:null}}var d=e((()=>{i()})),f,p,m,h,g,_,v,y,b,x,S,C,w,T,E,D,O,k;e((()=>{t(),i(),d(),{expect:f,userEvent:p,within:m}=__STORYBOOK_MODULE_TEST__,h={component:n,parameters:{layout:`fullscreen`},argTypes:{fileDiff:{control:!1}}},g={args:{fileDiff:o({status:`added`,lines:[{kind:`added`,text:`export const added = true;`},{kind:`added`,text:`export const longLine = "${`x`.repeat(240)}";`}]})}},_={args:{fileDiff:o({status:`deleted`,lines:[{kind:`removed`,text:`export const legacy = true;`},{kind:`removed`,text:`export const obsolete = true;`}]})}},v={args:{fileDiff:o({lines:[...Array.from({length:8},(e,t)=>({kind:`context`,text:`context ${t+1}`})),{kind:`removed`,text:`const first = before;`},{kind:`added`,text:`const first = after;`},{kind:`context`,text:`between`},{kind:`removed`,text:`const second = before;`},{kind:`added`,text:`const second = after;`},{kind:`noNewline`,text:`\\ No newline at end of file`}]})},play:async({canvasElement:e})=>{let t=m(e);await p.click(t.getByRole(`radio`,{name:`Split`})),await f(t.getByRole(`radio`,{name:`Split`})).toBeChecked(),await p.click(t.getByRole(`button`,{name:`次の変更`})),await f(t.getByRole(`button`,{name:`次の変更`})).toBeDisabled(),await p.click(t.getByRole(`button`,{name:`省略した2行を展開`})),await f(t.queryByRole(`button`,{name:`省略した2行を展開`})).not.toBeInTheDocument()}},y={args:{fileDiff:o({lines:Array.from({length:24},(e,t)=>({kind:`context`,text:`context `+(t+1)})),hunks:[a.fromLines(`@@ -1,2 +1,2 @@`,[{kind:`removed`,text:`const first = before;`},{kind:`added`,text:`const first = after;`}]),a.fromLines(`@@ -20,2 +20,2 @@`,[{kind:`removed`,text:`const second = before;`},{kind:`added`,text:`const second = after;`}])]})}},b={args:{fileDiff:o()},play:async({canvasElement:e})=>{let t=m(e),n=t.getByRole(`radio`,{name:`Unified`});n.focus(),await p.keyboard(`{ArrowRight}`),await f(t.getByRole(`radio`,{name:`Split`})).toBeChecked(),await f(n).toHaveFocus()}},x={globals:{theme:`Dark`},args:{fileDiff:o()}},S={args:{fileDiff:s()},play:async({canvasElement:e})=>{await f(e.querySelectorAll(`.diff-viewer__row`).length).toBeLessThanOrEqual(500)}},C={args:{fileDiff:o({lines:[]})}},w={args:{fileDiff:o({omissionReason:`largeFile`})}},T={args:{fileDiff:o({omissionReason:`binary`})}},E={args:{fileDiff:o({omissionReason:`missingSide`,status:`modified`})}},D={args:{fileDiff:o({omissionReason:`unsupportedEntryKind`})}},O={args:{fileDiff:o({status:`untracked`,lines:[{kind:`added`,text:`const untracked = true;`}]})}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
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
}`,...g.parameters?.docs?.source}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
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
}`,..._.parameters?.docs?.source}}},v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
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
    await userEvent.click(canvas.getByRole("radio", {
      name: "Split"
    }));
    await expect(canvas.getByRole("radio", {
      name: "Split"
    })).toBeChecked();
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
}`,...v.parameters?.docs?.source}}},y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
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
}`,...y.parameters?.docs?.source}}},b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    fileDiff: createDiffViewerFixture()
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const unified = canvas.getByRole("radio", {
      name: "Unified"
    });
    unified.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(canvas.getByRole("radio", {
      name: "Split"
    })).toBeChecked();
    await expect(unified).toHaveFocus();
  }
}`,...b.parameters?.docs?.source}}},x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  globals: {
    theme: "Dark"
  },
  args: {
    fileDiff: createDiffViewerFixture()
  }
}`,...x.parameters?.docs?.source}}},S.parameters={...S.parameters,docs:{...S.parameters?.docs,source:{originalSource:`{
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
}`,...S.parameters?.docs?.source}}},C.parameters={...C.parameters,docs:{...C.parameters?.docs,source:{originalSource:`{
  args: {
    fileDiff: createDiffViewerFixture({
      lines: []
    })
  }
}`,...C.parameters?.docs?.source}}},w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  args: {
    fileDiff: createDiffViewerFixture({
      omissionReason: "largeFile"
    })
  }
}`,...w.parameters?.docs?.source}}},T.parameters={...T.parameters,docs:{...T.parameters?.docs,source:{originalSource:`{
  args: {
    fileDiff: createDiffViewerFixture({
      omissionReason: "binary"
    })
  }
}`,...T.parameters?.docs?.source}}},E.parameters={...E.parameters,docs:{...E.parameters?.docs,source:{originalSource:`{
  args: {
    fileDiff: createDiffViewerFixture({
      omissionReason: "missingSide",
      status: "modified"
    })
  }
}`,...E.parameters?.docs?.source}}},D.parameters={...D.parameters,docs:{...D.parameters?.docs,source:{originalSource:`{
  args: {
    fileDiff: createDiffViewerFixture({
      omissionReason: "unsupportedEntryKind"
    })
  }
}`,...D.parameters?.docs?.source}}},O.parameters={...O.parameters,docs:{...O.parameters?.docs,source:{originalSource:`{
  args: {
    fileDiff: createDiffViewerFixture({
      status: "untracked",
      lines: [{
        kind: "added",
        text: "const untracked = true;"
      }]
    })
  }
}`,...O.parameters?.docs?.source}}},k=[`AddedOnly`,`RemovedOnly`,`Mixed`,`MultipleHunks`,`KeyboardFocus`,`DarkTheme`,`LargeDiff`,`EmptyDiff`,`OmittedDiff`,`BinaryDiff`,`MissingSideDiff`,`UnsupportedDiff`,`UntrackedDiff`]}))();export{g as AddedOnly,T as BinaryDiff,x as DarkTheme,C as EmptyDiff,b as KeyboardFocus,S as LargeDiff,E as MissingSideDiff,v as Mixed,y as MultipleHunks,w as OmittedDiff,_ as RemovedOnly,D as UnsupportedDiff,O as UntrackedDiff,k as __namedExportsOrder,h as default};