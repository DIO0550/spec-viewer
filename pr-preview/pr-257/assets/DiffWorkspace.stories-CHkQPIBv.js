import{n as e}from"./chunk-DnJy8xQt.js";import{t}from"./jsx-runtime-TRoWuN2H.js";import{n,t as r}from"./DiffWorkspace-CY1iifrk.js";var i,a,o,s,c,l,u,d,f,p,m,h,g,_;e((()=>{n(),i=t(),a={title:`Features/Diff/DiffWorkspace`,component:r,parameters:{layout:`fullscreen`},decorators:[e=>(0,i.jsx)(`div`,{style:{height:`100vh`,minHeight:720},children:(0,i.jsx)(e,{})})]},o={args:{selectedPath:`src/scorer.ts`,preview:(0,i.jsx)(`pre`,{children:`example diff`}),availability:{status:`ready`}}},s={args:{selectedPath:null,preview:null,availability:{status:`ready`},state:{status:`unchanged`}}},c={args:{selectedPath:null,preview:null,availability:{status:`ready`},state:{status:`loading`}}},l={args:{selectedPath:null,preview:null,availability:{status:`ready`},state:{status:`failed`,message:`差分の取得に失敗しました`,onRetry:()=>void 0}}},u={args:{selectedPath:null,preview:null,availability:{status:`ready`},state:{status:`selectionRequired`,message:`比較元のブランチを選択してください。`,onRetry:()=>void 0}}},d={args:{selectedPath:`assets/logo.bin`,preview:(0,i.jsx)(`p`,{role:`status`,children:`バイナリファイルのため差分を表示できません。`}),availability:{status:`ready`},state:{status:`ready`,selectedPath:`assets/logo.bin`,preview:(0,i.jsx)(`p`,{role:`status`,children:`バイナリファイルのため差分を表示できません。`})}}},f={args:{selectedPath:`src/removed.ts`,preview:(0,i.jsx)(`p`,{role:`status`,children:`比較対象の片側が取得できません。`}),availability:{status:`ready`},state:{status:`ready`,selectedPath:`src/removed.ts`,preview:(0,i.jsx)(`p`,{role:`status`,children:`比較対象の片側が取得できません。`})}}},p={args:{selectedPath:`tasks.md`,preview:(0,i.jsx)(`pre`,{children:`example diff`}),availability:{status:`ready`},state:{status:`ready`,selectedPath:`tasks.md`,preview:(0,i.jsx)(`pre`,{children:`example diff`})}}},m={args:{selectedPath:null,preview:null,availability:{status:`ready`},state:{status:`failed`,message:`指定された比較元ブランチを解決できません。`,onRetry:()=>void 0}}},h={args:{selectedPath:null,preview:null,availability:{status:`unavailable`,reason:`contract-pending`}}},g={args:{selectedPath:`src/file.ts`,preview:null,availability:{status:`ready`},state:{status:`loading`}}},o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
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
    selectedPath: null,
    preview: null,
    availability: {
      status: "ready"
    },
    state: {
      status: "selectionRequired",
      message: "比較元のブランチを選択してください。",
      onRetry: () => undefined
    }
  }
}`,...u.parameters?.docs?.source}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    selectedPath: "assets/logo.bin",
    preview: <p role="status">バイナリファイルのため差分を表示できません。</p>,
    availability: {
      status: "ready"
    },
    state: {
      status: "ready",
      selectedPath: "assets/logo.bin",
      preview: <p role="status">バイナリファイルのため差分を表示できません。</p>
    }
  }
}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    selectedPath: "src/removed.ts",
    preview: <p role="status">比較対象の片側が取得できません。</p>,
    availability: {
      status: "ready"
    },
    state: {
      status: "ready",
      selectedPath: "src/removed.ts",
      preview: <p role="status">比較対象の片側が取得できません。</p>
    }
  }
}`,...f.parameters?.docs?.source}}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
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
}`,...p.parameters?.docs?.source}}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    selectedPath: null,
    preview: null,
    availability: {
      status: "ready"
    },
    state: {
      status: "failed",
      message: "指定された比較元ブランチを解決できません。",
      onRetry: () => undefined
    }
  }
}`,...m.parameters?.docs?.source}}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    selectedPath: null,
    preview: null,
    availability: {
      status: "unavailable",
      reason: "contract-pending"
    }
  }
}`,...h.parameters?.docs?.source}}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    selectedPath: "src/file.ts",
    preview: null,
    availability: {
      status: "ready"
    },
    state: {
      status: "loading"
    }
  }
}`,...g.parameters?.docs?.source}}},_=[`Default`,`Unchanged`,`Loading`,`Failed`,`SelectionRequired`,`Binary`,`Deleted`,`Ready`,`InvalidOverride`,`Unavailable`,`DetailLoading`]}))();export{d as Binary,o as Default,f as Deleted,g as DetailLoading,l as Failed,m as InvalidOverride,c as Loading,p as Ready,u as SelectionRequired,h as Unavailable,s as Unchanged,_ as __namedExportsOrder,a as default};