import{n as e}from"./chunk-DnJy8xQt.js";import{n as t,t as n}from"./CurrentFileViewer-BPMXU9hF.js";import{r,t as i}from"./testFixtures-B97CRjFJ.js";var a,o,s,c,l,u;e((()=>{t(),r(),a={component:n,parameters:{layout:`fullscreen`},args:{fileDiff:i({newContent:`export const first = true;
export const second = false;`})},argTypes:{fileDiff:{control:!1}}},o={},s={args:{fileDiff:i({newContent:Array.from({length:100},(e,t)=>`export const line${t} = ${t};`).join(`
`)})}},c={args:{fileDiff:i({newContent:``})}},l={args:{fileDiff:i({status:`deleted`})}},o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{}`,...o.parameters?.docs?.source}}},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    fileDiff: createDiffViewerFixture({
      newContent: Array.from({
        length: 100
      }, (_, index) => \`export const line\${index} = \${index};\`).join("\\n")
    })
  }
}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    fileDiff: createDiffViewerFixture({
      newContent: ""
    })
  }
}`,...c.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    fileDiff: createDiffViewerFixture({
      status: "deleted"
    })
  }
}`,...l.parameters?.docs?.source}}},u=[`Default`,`AllProps`,`EdgeCases`,`Deleted`]}))();export{s as AllProps,o as Default,l as Deleted,c as EdgeCases,u as __namedExportsOrder,a as default};