import{n as e}from"./chunk-DnJy8xQt.js";import{t}from"./jsx-runtime-BpX3lQ6F.js";import{n,t as r}from"./CommandErrorDisplay-Bv0nPSiX.js";var i,a,o,s,c,l,u;e((()=>{n(),i=t(),{fn:a}=__STORYBOOK_MODULE_TEST__,o={component:r,decorators:[e=>(0,i.jsx)(`div`,{style:{maxWidth:520},children:(0,i.jsx)(e,{})})],args:{title:`Workspace could not be opened`,error:{code:`workspaceDetection`,message:`The selected directory is not a valid workspace.`}},argTypes:{error:{control:!1},onAction:{control:!1}}},s={},c={args:{actionLabel:`Try again`,onAction:a()}},l={args:{title:`Unknown failure`,error:{code:`unknown`,message:`No diagnostic details were returned.`},actionLabel:`Retry disabled`,isActionDisabled:!0,onAction:a()}},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    actionLabel: "Try again",
    onAction: fn()
  }
}`,...c.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    title: "Unknown failure",
    error: {
      code: "unknown",
      message: "No diagnostic details were returned."
    },
    actionLabel: "Retry disabled",
    isActionDisabled: true,
    onAction: fn()
  }
}`,...l.parameters?.docs?.source}}},u=[`Default`,`AllProps`,`EdgeCases`]}))();export{c as AllProps,s as Default,l as EdgeCases,u as __namedExportsOrder,o as default};