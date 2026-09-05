import{n as e}from"./chunk-DnJy8xQt.js";import{n as t,t as n}from"./RepositoryDiffTree-CEsvoCmu.js";var r,i,a,o,s,c,l,u,d,f,p;e((()=>{t(),{fn:r}=__STORYBOOK_MODULE_TEST__,i={id:`row:src`,path:`src`,name:`src`,kind:`directory`,entryKind:null,contentClassification:null,oldPath:null,change:null,ignored:!1,deferredNodeId:null,children:{state:`loaded`,items:[{id:`row:main`,path:`src/main.ts`,name:`main.ts`,kind:`file`,entryKind:`regular`,contentClassification:`text`,oldPath:null,change:`modified`,ignored:!1,deferredNodeId:null,children:{state:`loaded`,items:[],nextCursor:null,message:null}}],nextCursor:null,message:null}},a={id:`row:vendor`,path:`vendor`,name:`vendor`,kind:`directory`,entryKind:null,contentClassification:null,oldPath:null,change:null,ignored:!0,deferredNodeId:`in1_vendor`,children:{state:`deferred`,items:[],nextCursor:null,message:null}},o={component:n,args:{filter:`changed`,nodes:[i],selectedPath:null,expandedPaths:[`src`],availability:{status:`ready`},onSelectFile:r(),onToggleDirectory:r(),onLoadChildren:r(),onRetry:r()}},s={},c={args:{filter:`all`,nodes:[i,a],selectedPath:`src/main.ts`,expandedPaths:[`src`,`vendor`]}},l={args:{availability:{status:`loading`}}},u={args:{nodes:[],expandedPaths:[],availability:{status:`empty`}}},d={args:{availability:{status:`error`,message:`overview failed`}}},f={args:{availability:{status:`stale`,message:`stale snapshot`}}},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    filter: "all",
    nodes: [source, deferred],
    selectedPath: "src/main.ts",
    expandedPaths: ["src", "vendor"]
  }
}`,...c.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    availability: {
      status: "loading"
    }
  }
}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    nodes: [],
    expandedPaths: [],
    availability: {
      status: "empty"
    }
  }
}`,...u.parameters?.docs?.source}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    availability: {
      status: "error",
      message: "overview failed"
    }
  }
}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    availability: {
      status: "stale",
      message: "stale snapshot"
    }
  }
}`,...f.parameters?.docs?.source}}},p=[`Default`,`AllProps`,`Loading`,`Empty`,`ErrorState`,`Stale`]}))();export{c as AllProps,s as Default,u as Empty,d as ErrorState,l as Loading,f as Stale,p as __namedExportsOrder,o as default};