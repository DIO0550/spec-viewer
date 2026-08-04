import{n as e}from"./chunk-DnJy8xQt.js";import{n as t,t as n}from"./DiffViewer-DEtWalN_.js";import{n as r,t as i}from"./fileDiff-CHZA9qhD.js";function a(e={}){let t=e.lines??[{kind:`context`,text:`const before = 1;`},{kind:`removed`,text:`const first = before;`},{kind:`added`,text:`const first = after;`},{kind:`context`,text:`const middle = true;`},{kind:`removed`,text:`const second = before;`},{kind:`added`,text:`const second = after;`}],n=e.omissionReason??null,r=n===null?{state:`available`,hunks:t.length===0?[]:[i.fromLines(`@@ -1,6 +1,6 @@`,t)],reason:null}:{state:`omitted`,hunks:[],reason:n};return{specId:`078-issue-167`,fileKey:e.fileKey??`implementation-plan`,review:{file:{oldPath:`implementation-plan.md`,newPath:`implementation-plan.md`,change:e.status??`modified`,entryKind:`regular`,contentClassification:n===`binary`?`binary`:`text`,similarity:null,oldMode:`100644`,newMode:`100644`},oldContent:{state:`available`,text:e.oldContent??t.map(e=>e.text).join(`
`),reason:null,byteLength:null},newContent:{state:`available`,text:e.newContent??t.map(e=>e.text).join(`
`),reason:null,byteLength:null},patch:{state:`available`,text:``,reason:null,byteLength:null},structuredDiff:r,submodule:null}}}function o(e=2e4){return a({lines:Array.from({length:e},(e,t)=>({kind:t%2==0?`removed`:`added`,text:`const line${t} = ${t};`}))})}var s=e((()=>{r()})),c,l,u,d,f,p,m,h,g,_,v;e((()=>{t(),s(),{expect:c,userEvent:l,within:u}=__STORYBOOK_MODULE_TEST__,d={component:n,parameters:{layout:`fullscreen`},argTypes:{fileDiff:{control:!1}}},f={args:{fileDiff:a({status:`added`,lines:[{kind:`added`,text:`export const added = true;`},{kind:`added`,text:`export const longLine = "${`x`.repeat(240)}";`}]})}},p={args:{fileDiff:a({status:`deleted`,lines:[{kind:`removed`,text:`export const legacy = true;`},{kind:`removed`,text:`export const obsolete = true;`}]})}},m={args:{fileDiff:a({lines:[...Array.from({length:8},(e,t)=>({kind:`context`,text:`context ${t+1}`})),{kind:`removed`,text:`const first = before;`},{kind:`added`,text:`const first = after;`},{kind:`context`,text:`between`},{kind:`removed`,text:`const second = before;`},{kind:`added`,text:`const second = after;`},{kind:`noNewline`,text:`\\ No newline at end of file`}]})},play:async({canvasElement:e})=>{let t=u(e);await l.click(t.getByRole(`radio`,{name:`Side by side`})),await c(t.getByRole(`radio`,{name:`Side by side`})).toBeChecked(),await l.click(t.getByRole(`button`,{name:`次の変更`})),await c(t.getByRole(`button`,{name:`次の変更`})).toBeDisabled(),await l.click(t.getByRole(`button`,{name:`省略した2行を展開`})),await c(t.queryByRole(`button`,{name:`省略した2行を展開`})).not.toBeInTheDocument()}},h={args:{fileDiff:o()},play:async({canvasElement:e})=>{await c(e.querySelectorAll(`.diff-viewer__row`).length).toBeLessThanOrEqual(500)}},g={args:{fileDiff:a({lines:[]})}},_={args:{fileDiff:a({omissionReason:`largeFile`})}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
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
}`,...f.parameters?.docs?.source}}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
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
}`,...p.parameters?.docs?.source}}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
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
}`,...m.parameters?.docs?.source}}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    fileDiff: createLargeDiffViewerFixture()
  },
  play: async ({
    canvasElement
  }) => {
    await expect(canvasElement.querySelectorAll(".diff-viewer__row").length).toBeLessThanOrEqual(500);
  }
}`,...h.parameters?.docs?.source}}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    fileDiff: createDiffViewerFixture({
      lines: []
    })
  }
}`,...g.parameters?.docs?.source}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
  args: {
    fileDiff: createDiffViewerFixture({
      omissionReason: "largeFile"
    })
  }
}`,..._.parameters?.docs?.source}}},v=[`AddedOnly`,`RemovedOnly`,`Mixed`,`LargeDiff`,`EmptyDiff`,`OmittedDiff`]}))();export{f as AddedOnly,g as EmptyDiff,h as LargeDiff,m as Mixed,_ as OmittedDiff,p as RemovedOnly,v as __namedExportsOrder,d as default};