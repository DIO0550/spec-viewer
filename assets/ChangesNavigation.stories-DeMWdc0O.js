import{n as e}from"./chunk-DnJy8xQt.js";import{n as t,t as n}from"./ChangesNavigation-CZapAsUv.js";var r,i,a,o,s,c,l,u,d;e((()=>{t(),{fn:r}=__STORYBOOK_MODULE_TEST__,i={title:`Features/Diff/ChangesNavigation`,component:n,args:{items:[],selectedId:null,availability:{status:`ready`},onSelect:r(),onRetry:r()}},a={args:{selectedId:`impl`,items:[{id:`impl`,path:`079/implementation-plan.md`,change:`modified`},{id:`tasks`,path:`079/tasks.md`,change:`untracked`},{id:`requirements`,path:`079/requirements.md`,change:`deleted`}]}},o={args:{selectedId:`vendor`,items:[{id:`vendor`,path:`vendor`,change:null,ignored:!0,deferredNodeId:`in1_deferred`},{id:`vendor/pkg`,path:`vendor/pkg`,change:null,ignored:!0,deferredNodeId:null}]}},s={},c={args:{availability:{status:`loading`}}},l={args:{availability:{status:`failed`,message:`変更一覧の取得に失敗しました`}}},u={args:{availability:{status:`unavailable`,reason:`比較元のブランチを選択してください。`}}},a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    selectedId: "impl",
    items: [{
      id: "impl",
      path: "079/implementation-plan.md",
      change: "modified"
    }, {
      id: "tasks",
      path: "079/tasks.md",
      change: "untracked"
    }, {
      id: "requirements",
      path: "079/requirements.md",
      change: "deleted"
    }]
  }
}`,...a.parameters?.docs?.source}}},o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    selectedId: "vendor",
    items: [{
      id: "vendor",
      path: "vendor",
      change: null,
      ignored: true,
      deferredNodeId: "in1_deferred"
    }, {
      id: "vendor/pkg",
      path: "vendor/pkg",
      change: null,
      ignored: true,
      deferredNodeId: null
    }]
  }
}`,...o.parameters?.docs?.source}}},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    availability: {
      status: "loading"
    }
  }
}`,...c.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    availability: {
      status: "failed",
      message: "変更一覧の取得に失敗しました"
    }
  }
}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    availability: {
      status: "unavailable",
      reason: "比較元のブランチを選択してください。"
    }
  }
}`,...u.parameters?.docs?.source}}},d=[`ReadyMixed`,`RepositoryIgnoredDeferred`,`Empty`,`Loading`,`Failed`,`Unavailable`]}))();export{s as Empty,l as Failed,c as Loading,a as ReadyMixed,o as RepositoryIgnoredDeferred,u as Unavailable,d as __namedExportsOrder,i as default};