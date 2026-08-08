import{n as e}from"./chunk-DnJy8xQt.js";import{n as t,t as n}from"./ChangesNavigation-ChxzNONS.js";var r,i,a,o,s,c,l;e((()=>{t(),{fn:r}=__STORYBOOK_MODULE_TEST__,i={title:`Features/Diff/ChangesNavigation`,component:n,args:{items:[],selectedId:null,availability:{status:`ready`},onSelect:r(),onRetry:r()}},a={args:{selectedId:`impl`,items:[{id:`impl`,path:`079/implementation-plan.md`,change:`modified`},{id:`tasks`,path:`079/tasks.md`,change:`untracked`},{id:`requirements`,path:`079/requirements.md`,change:`deleted`}]}},o={},s={args:{availability:{status:`loading`}}},c={args:{availability:{status:`failed`,message:`変更一覧の取得に失敗しました`}}},a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
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
}`,...a.parameters?.docs?.source}}},o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{}`,...o.parameters?.docs?.source}}},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    availability: {
      status: "loading"
    }
  }
}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    availability: {
      status: "failed",
      message: "変更一覧の取得に失敗しました"
    }
  }
}`,...c.parameters?.docs?.source}}},l=[`ReadyMixed`,`Empty`,`Loading`,`Failed`]}))();export{o as Empty,c as Failed,s as Loading,a as ReadyMixed,l as __namedExportsOrder,i as default};