import{a as e,n as t}from"./chunk-DnJy8xQt.js";import{n}from"./iframe-Dt7vXP7v.js";import{t as r}from"./jsx-runtime-BpX3lQ6F.js";import{r as i,t as a}from"./RepositoryFileTabs-BxOqsGFd.js";function o(e){let[t,n]=(0,s.useState)(e.items),[r,i]=(0,s.useState)(e.activePath);return(0,c.jsx)(a,{...e,items:t,activePath:r,onActivate:t=>{i(t),e.onActivate(t)},onClose:a=>{let o=t.findIndex(e=>e.path===a),s=t.filter(e=>e.path!==a);n(s),r===a&&i(s[o]?.path??s[o-1]?.path??null),e.onClose(a)}})}var s,c,l,u,d,f,p,m,h,g,_,v;t((()=>{s=e(n(),1),i(),c=r(),{expect:l,fn:u,userEvent:d,within:f}=__STORYBOOK_MODULE_TEST__,p={component:a,render:e=>(0,c.jsx)(o,{...e}),args:{items:[{path:`src/main.ts`,change:`modified`},{path:`src/new-feature.ts`,change:`added`},{path:`src/legacy.ts`,change:`deleted`}],activePath:`src/main.ts`,onActivate:u(),onClose:u()},argTypes:{items:{control:!1},onActivate:{control:!1},onClose:{control:!1}}},m={},h={args:{activePath:`src/new-feature.ts`,disabled:!1}},g={args:{items:[{path:`src/features/repositoryDiff/components/RepositoryFileTabs/a-very-long-file-name-that-overflows.tsx`,change:`renamed`},{path:`vendor/ignored.log`,change:null}],activePath:`src/features/repositoryDiff/components/RepositoryFileTabs/a-very-long-file-name-that-overflows.tsx`}},_={play:async({canvasElement:e})=>{let t=f(e).getAllByRole(`tab`);t[0]?.focus(),await d.keyboard(`{ArrowRight}`),await l(t[1]).toHaveFocus(),await l(t[1]).toHaveAttribute(`aria-selected`,`true`)}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{}`,...m.parameters?.docs?.source}}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    activePath: "src/new-feature.ts",
    disabled: false
  }
}`,...h.parameters?.docs?.source}}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    items: [{
      path: "src/features/repositoryDiff/components/RepositoryFileTabs/a-very-long-file-name-that-overflows.tsx",
      change: "renamed"
    }, {
      path: "vendor/ignored.log",
      change: null
    }],
    activePath: "src/features/repositoryDiff/components/RepositoryFileTabs/a-very-long-file-name-that-overflows.tsx"
  }
}`,...g.parameters?.docs?.source}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const tabs = canvas.getAllByRole("tab");
    tabs[0]?.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(tabs[1]).toHaveFocus();
    await expect(tabs[1]).toHaveAttribute("aria-selected", "true");
  }
}`,..._.parameters?.docs?.source}}},v=[`Default`,`AllProps`,`EdgeCases`,`Keyboard`]}))();export{h as AllProps,m as Default,g as EdgeCases,_ as Keyboard,v as __namedExportsOrder,p as default};