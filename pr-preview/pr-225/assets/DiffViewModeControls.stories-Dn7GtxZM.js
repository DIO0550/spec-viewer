import{a as e,n as t}from"./chunk-DnJy8xQt.js";import{n}from"./iframe-CFd3SiqQ.js";import{t as r}from"./jsx-runtime-BpX3lQ6F.js";import{n as i,t as a}from"./DiffViewModeControls-Do-d8Yf7.js";function o(e){let[t,n]=(0,s.useState)(e.mode);return(0,c.jsx)(a,{...e,mode:t,onModeChange:t=>{n(t),e.onModeChange(t)}})}var s,c,l,u,d,f,p,m,h,g,_,v;t((()=>{s=e(n(),1),i(),c=r(),{expect:l,fn:u,userEvent:d,within:f}=__STORYBOOK_MODULE_TEST__,p={component:a,render:e=>(0,c.jsx)(o,{...e}),args:{mode:`unified`,disabled:!1,onModeChange:u()},argTypes:{onModeChange:{control:!1}}},m={},h={args:{mode:`editor`}},g={args:{disabled:!0}},_={play:async({canvasElement:e})=>{let t=f(e);t.getByRole(`radio`,{name:`Unified`}).focus(),await d.keyboard(`{End}`),await l(t.getByRole(`radio`,{name:`Editor`})).toHaveFocus()}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{}`,...m.parameters?.docs?.source}}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    mode: "editor"
  }
}`,...h.parameters?.docs?.source}}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    disabled: true
  }
}`,...g.parameters?.docs?.source}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const unified = canvas.getByRole("radio", {
      name: "Unified"
    });
    unified.focus();
    await userEvent.keyboard("{End}");
    await expect(canvas.getByRole("radio", {
      name: "Editor"
    })).toHaveFocus();
  }
}`,..._.parameters?.docs?.source}}},v=[`Default`,`AllProps`,`EdgeCases`,`Keyboard`]}))();export{h as AllProps,m as Default,g as EdgeCases,_ as Keyboard,v as __namedExportsOrder,p as default};