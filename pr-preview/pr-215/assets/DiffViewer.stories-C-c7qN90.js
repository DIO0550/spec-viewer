import{n as e}from"./chunk-DnJy8xQt.js";import{n as t,t as n}from"./DiffViewer-Bjv34VeF.js";import{n as r,t as i}from"./fileDiff-BoNYj5K6.js";function a(e={}){let t=e.lines??[{kind:`context`,text:`const before = 1;`},{kind:`removed`,text:`const first = before;`},{kind:`added`,text:`const first = after;`},{kind:`context`,text:`const middle = true;`},{kind:`removed`,text:`const second = before;`},{kind:`added`,text:`const second = after;`}],n=e.omissionReason??null,r=n===null?{state:`available`,hunks:t.length===0?[]:[i.fromLines(`@@ -1,6 +1,6 @@`,t)],reason:null}:{state:`omitted`,hunks:[],reason:n};return{specId:`078-issue-167`,fileKey:e.fileKey??`implementation-plan`,review:{file:{oldPath:`implementation-plan.md`,newPath:`implementation-plan.md`,change:e.status??`modified`,entryKind:`regular`,contentClassification:n===`binary`?`binary`:`text`,similarity:null,oldMode:`100644`,newMode:`100644`},oldContent:{state:`available`,text:e.oldContent??t.map(e=>e.text).join(`
`),reason:null,byteLength:null},newContent:{state:`available`,text:e.newContent??t.map(e=>e.text).join(`
`),reason:null,byteLength:null},patch:{state:`available`,text:``,reason:null,byteLength:null},structuredDiff:r,submodule:null}}}function o(e={}){return a(e).review}function s(e=2e4){return c(e).review}function c(e=2e4){return a({lines:Array.from({length:e},(e,t)=>({kind:t%2==0?`removed`:`added`,text:`const line${t} = ${t};`}))})}var l=e((()=>{r()})),u,d,f,p,m,h,g,_,v,y,b;e((()=>{t(),l(),{expect:u,userEvent:d,within:f}=__STORYBOOK_MODULE_TEST__,p={component:n,parameters:{layout:`fullscreen`},argTypes:{review:{control:!1}}},m={args:{review:o({status:`added`,lines:[{kind:`added`,text:`export const added = true;`},{kind:`added`,text:`export const longLine = "${`x`.repeat(240)}";`}]})}},h={args:{review:o({status:`deleted`,lines:[{kind:`removed`,text:`export const legacy = true;`},{kind:`removed`,text:`export const obsolete = true;`}]})}},g={args:{review:o({lines:[...Array.from({length:8},(e,t)=>({kind:`context`,text:`context ${t+1}`})),{kind:`removed`,text:`const first = before;`},{kind:`added`,text:`const first = after;`},{kind:`context`,text:`between`},{kind:`removed`,text:`const second = before;`},{kind:`added`,text:`const second = after;`},{kind:`noNewline`,text:`\\ No newline at end of file`}]})},play:async({canvasElement:e})=>{let t=f(e);await d.click(t.getByRole(`radio`,{name:`Side by side`})),await u(t.getByRole(`radio`,{name:`Side by side`})).toBeChecked(),await d.click(t.getByRole(`button`,{name:`次の変更`})),await u(t.getByRole(`button`,{name:`次の変更`})).toBeDisabled(),await d.click(t.getByRole(`button`,{name:`省略した2行を展開`})),await u(t.queryByRole(`button`,{name:`省略した2行を展開`})).not.toBeInTheDocument()}},_={args:{review:s()},play:async({canvasElement:e})=>{await u(e.querySelectorAll(`.diff-viewer__row`).length).toBeLessThanOrEqual(500)}},v={args:{review:o({lines:[]})}},y={args:{review:o({omissionReason:`largeFile`})}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    review: createFileReviewFixture({
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
}`,...m.parameters?.docs?.source}}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    review: createFileReviewFixture({
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
}`,...h.parameters?.docs?.source}}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    review: createFileReviewFixture({
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
      name: "Side by side"
    }));
    await expect(canvas.getByRole("radio", {
      name: "Side by side"
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
}`,...g.parameters?.docs?.source}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
  args: {
    review: createLargeFileReviewFixture()
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
}`,..._.parameters?.docs?.source}}},v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    review: createFileReviewFixture({
      lines: []
    })
  }
}`,...v.parameters?.docs?.source}}},y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    review: createFileReviewFixture({
      omissionReason: "largeFile"
    })
  }
}`,...y.parameters?.docs?.source}}},b=[`AddedOnly`,`RemovedOnly`,`Mixed`,`LargeDiff`,`EmptyDiff`,`OmittedDiff`]}))();export{m as AddedOnly,v as EmptyDiff,_ as LargeDiff,g as Mixed,y as OmittedDiff,h as RemovedOnly,b as __namedExportsOrder,p as default};