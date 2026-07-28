import{n as e}from"./chunk-DnJy8xQt.js";import{t}from"./jsx-runtime-BpX3lQ6F.js";import{c as n,n as r,s as i,t as a}from"./specTreeState-Db0A01Z1.js";var o,s,c,l,u,d,f,p,m,h,g,_,v;e((()=>{r(),n(),o=t(),{fn:s}=__STORYBOOK_MODULE_TEST__,c=`/workspace/spec-reviewer`,l={status:`ready`,workspacePath:c,tree:{specs:[{id:`phase-1-viewer`,label:`Phase 1 Viewer`,files:[{key:`tasks`,label:`Tasks`,fileName:`tasks.md`,status:`present`}],children:[{id:`phase-1-comments`,label:`Phase 1 Comments`,files:[{key:`requirements`,label:`Requirements`,fileName:`requirements.html`,status:`missing`,format:`html`}],children:[]}]}]},error:null},u={feature:`specs`,code:`specTreeScan`,message:`The spec tree could not be scanned.`,cause:{command:`list_specs`,code:`specTreeScan`,message:`The spec tree could not be scanned.`,raw:`story fixture`}},d={component:i,decorators:[e=>(0,o.jsx)(`div`,{style:{minHeight:360,width:300},children:(0,o.jsx)(e,{})})],args:{state:l,selectedSpecId:`phase-1-viewer`,archivingSpecId:null,isLoading:!1,onSelectSpec:s(),onArchiveSpec:s(),onReload:s()},argTypes:{state:{control:!1},onSelectSpec:{control:!1},onArchiveSpec:{control:!1},onReload:{control:!1}}},f={},p={args:{archivingSpecId:`phase-1-comments`,isLoading:!0}},m={args:{state:a.loading(c),selectedSpecId:null}},h={args:{state:a.failed(c,u),selectedSpecId:null}},g={args:{state:a.loaded(c,{specs:[]}),selectedSpecId:null}},_={args:{state:a.idle(),selectedSpecId:null,onArchiveSpec:void 0}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{}`,...f.parameters?.docs?.source}}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    archivingSpecId: "phase-1-comments",
    isLoading: true
  }
}`,...p.parameters?.docs?.source}}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    state: SpecTreeState.loading(workspacePath),
    selectedSpecId: null
  }
}`,...m.parameters?.docs?.source}}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    state: SpecTreeState.failed(workspacePath, treeError),
    selectedSpecId: null
  }
}`,...h.parameters?.docs?.source}}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    state: SpecTreeState.loaded(workspacePath, {
      specs: []
    }),
    selectedSpecId: null
  }
}`,...g.parameters?.docs?.source}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
  args: {
    state: SpecTreeState.idle(),
    selectedSpecId: null,
    onArchiveSpec: undefined
  }
}`,..._.parameters?.docs?.source}}},v=[`Default`,`AllProps`,`Loading`,`Error`,`Empty`,`EdgeCases`]}))();export{p as AllProps,f as Default,_ as EdgeCases,g as Empty,h as Error,m as Loading,v as __namedExportsOrder,d as default};