import{a as e,n as t}from"./chunk-DnJy8xQt.js";import{n}from"./iframe-Dk6532l5.js";import{t as r}from"./jsx-runtime-B-hFyic3.js";import{n as i,t as a}from"./MarkdownViewerStatusPanel-DjfpPjNK.js";function o(e,t=!1){return{key:`tasks`,path:`/workspace/spec-reviewer/docs/plans/tasks.md`,contents:e,missing:t,blocks:[]}}var s,c,l,u,d,f,p,m,h,g,_,v,y,b,x,S,C;t((()=>{s=e(n(),1),i(),c=r(),{fn:l}=__STORYBOOK_MODULE_TEST__,u=`/workspace/spec-reviewer`,d={status:`idle`,workspacePath:null,specId:null,fileKey:null,document:null,error:null},f={status:`loading`,workspacePath:u,specId:`phase-1-viewer`,fileKey:`tasks`,document:null,error:null},p={status:`error`,workspacePath:u,specId:`phase-1-viewer`,fileKey:`tasks`,document:null,error:{feature:`specs`,code:`markdownRead`,message:`Markdown file could not be read.`,cause:{command:`read_spec_file`,code:`markdownRead`,message:`Markdown file could not be read.`,raw:`Markdown file could not be read.`}}},m={status:`missing`,workspacePath:u,specId:`phase-1-viewer`,fileKey:`tasks`,document:o(null,!0),error:null},h={status:`ready`,workspacePath:u,specId:`phase-1-viewer`,fileKey:`tasks`,document:o(` 
	 `),error:null},g={component:a,parameters:{layout:`fullscreen`},render:e=>(0,c.jsx)(a,{...e,panelRef:(0,s.createRef)()}),args:{state:d,selectedSpecLabel:null,panelRef:(0,s.createRef)(),onReload:l()},argTypes:{state:{control:!1},panelRef:{control:!1},onReload:{control:!1}}},_={},v={args:{state:f,selectedSpecLabel:`Phase 1 Viewer`}},y={args:{state:p,selectedSpecLabel:`Phase 1 Viewer`}},b={args:{state:m,selectedSpecLabel:`Phase 1 Viewer`}},x={args:{state:h,selectedSpecLabel:`Phase 1 Viewer`}},S={args:{state:{...d,workspacePath:u,specId:`phase-1-viewer`},selectedSpecLabel:`Phase 1 Viewer`}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{}`,..._.parameters?.docs?.source}}},v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    state: loadingState,
    selectedSpecLabel: "Phase 1 Viewer"
  }
}`,...v.parameters?.docs?.source}}},y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    state: errorState,
    selectedSpecLabel: "Phase 1 Viewer"
  }
}`,...y.parameters?.docs?.source}}},b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    state: missingState,
    selectedSpecLabel: "Phase 1 Viewer"
  }
}`,...b.parameters?.docs?.source}}},x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  args: {
    state: emptyState,
    selectedSpecLabel: "Phase 1 Viewer"
  }
}`,...x.parameters?.docs?.source}}},S.parameters={...S.parameters,docs:{...S.parameters?.docs,source:{originalSource:`{
  args: {
    state: {
      ...idleState,
      workspacePath,
      specId: "phase-1-viewer"
    },
    selectedSpecLabel: "Phase 1 Viewer"
  }
}`,...S.parameters?.docs?.source}}},C=[`Default`,`Loading`,`Error`,`Missing`,`Empty`,`EdgeCases`]}))();export{_ as Default,S as EdgeCases,x as Empty,y as Error,v as Loading,b as Missing,C as __namedExportsOrder,g as default};