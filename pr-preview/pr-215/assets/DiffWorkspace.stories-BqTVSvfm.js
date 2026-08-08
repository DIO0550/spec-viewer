import{n as e}from"./chunk-DnJy8xQt.js";import{t}from"./jsx-runtime-BX9360Lk.js";import{n,t as r}from"./DiffWorkspace-CuhyGfIJ.js";var i,a,o,s,c,l,u,d;e((()=>{n(),i=t(),a={title:`Features/Diff/DiffWorkspace`,component:r,parameters:{layout:`fullscreen`},decorators:[e=>(0,i.jsx)(`div`,{style:{height:`100vh`,minHeight:720},children:(0,i.jsx)(e,{})})]},o={args:{selectedPath:`src/scorer.ts`,preview:(0,i.jsx)(`pre`,{children:`example diff`}),availability:{status:`ready`}}},s={args:{selectedPath:null,preview:null,availability:{status:`ready`},state:{status:`unchanged`}}},c={args:{selectedPath:null,preview:null,availability:{status:`ready`},state:{status:`loading`}}},l={args:{selectedPath:null,preview:null,availability:{status:`ready`},state:{status:`failed`,message:`差分の取得に失敗しました`,onRetry:()=>void 0}}},u={args:{selectedPath:`tasks.md`,preview:(0,i.jsx)(`pre`,{children:`example diff`}),availability:{status:`ready`},state:{status:`ready`,selectedPath:`tasks.md`,preview:(0,i.jsx)(`pre`,{children:`example diff`})}}},o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    selectedPath: "src/scorer.ts",
    preview: <pre>{"example diff"}</pre>,
    availability: {
      status: "ready"
    }
  }
}`,...o.parameters?.docs?.source}}},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    selectedPath: null,
    preview: null,
    availability: {
      status: "ready"
    },
    state: {
      status: "unchanged"
    }
  }
}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    selectedPath: null,
    preview: null,
    availability: {
      status: "ready"
    },
    state: {
      status: "loading"
    }
  }
}`,...c.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    selectedPath: null,
    preview: null,
    availability: {
      status: "ready"
    },
    state: {
      status: "failed",
      message: "差分の取得に失敗しました",
      /** No-op story stub; the story does not model a diff retry. */
      onRetry: () => undefined
    }
  }
}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    selectedPath: "tasks.md",
    preview: <pre>{"example diff"}</pre>,
    availability: {
      status: "ready"
    },
    state: {
      status: "ready",
      selectedPath: "tasks.md",
      preview: <pre>{"example diff"}</pre>
    }
  }
}`,...u.parameters?.docs?.source}}},d=[`Default`,`Unchanged`,`Loading`,`Failed`,`Ready`]}))();export{o as Default,l as Failed,c as Loading,u as Ready,s as Unchanged,d as __namedExportsOrder,a as default};