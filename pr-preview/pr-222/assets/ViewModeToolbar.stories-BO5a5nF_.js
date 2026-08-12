import{n as e}from"./chunk-DnJy8xQt.js";import{t}from"./jsx-runtime-BpX3lQ6F.js";import{n,t as r}from"./ViewModeToolbar-s3Rdp_Yk.js";var i,a,o,s,c,l,u,d,f,p;e((()=>{n(),i=t(),{fn:a}=__STORYBOOK_MODULE_TEST__,o={component:r,args:{mode:`specs`,activeItemLabel:`Implementation`,onModeChange:a()},argTypes:{mode:{control:`inline-radio`,options:[`specs`,`diff`]},onModeChange:{control:!1}},decorators:[e=>(0,i.jsx)(`div`,{style:{maxWidth:900},children:(0,i.jsx)(e,{})})]},s={},c={args:{mode:`diff`}},l={args:{activeItemLabel:`とても長いファイル名でもツールバー全体が崩れないことを確認するための仕様書.md`}},u={args:{diffAvailability:{status:`ready`}}},d={args:{diffAvailability:{status:`unavailable`,reason:`Git repositoryではありません`}}},f={args:{diffAvailability:{status:`unavailable`,reason:`Diff情報を読み込んでいます`}}},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    mode: "diff"
  }
}`,...c.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    activeItemLabel: "とても長いファイル名でもツールバー全体が崩れないことを確認するための仕様書.md"
  }
}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    diffAvailability: {
      status: "ready"
    }
  }
}`,...u.parameters?.docs?.source}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    diffAvailability: {
      status: "unavailable",
      reason: "Git repositoryではありません"
    }
  }
}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    diffAvailability: {
      status: "unavailable",
      reason: "Diff情報を読み込んでいます"
    }
  }
}`,...f.parameters?.docs?.source}}},p=[`Default`,`AllProps`,`EdgeCases`,`Ready`,`NonRepository`,`Loading`]}))();export{c as AllProps,s as Default,l as EdgeCases,f as Loading,d as NonRepository,u as Ready,p as __namedExportsOrder,o as default};