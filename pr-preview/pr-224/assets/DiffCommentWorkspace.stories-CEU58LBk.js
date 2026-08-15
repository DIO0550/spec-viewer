import{n as e}from"./chunk-DnJy8xQt.js";import{t}from"./jsx-runtime-BpX3lQ6F.js";import{n,t as r}from"./DiffViewer-Cqkghyuv.js";import{n as i,t as a}from"./CurrentFileViewer-ZbYLQ__c.js";import{n as o,r as s,t as c}from"./testFixtures-D5vvipPF.js";function l(e){let t=e.large?o():c({oldContent:`first
old
last`,newContent:`first
current
last`}),n=u(e.state);return e.mode===`editor`?(0,d.jsx)(a,{fileDiff:t,lineComments:n}):(0,d.jsx)(r,{fileDiff:t,mode:e.mode,activeChangeId:null,onActiveChangeIdChange:()=>void 0,lineComments:n})}function u(e){let t={key:`current:implementation-plan.md:2`,side:`current`,sidePath:`implementation-plan.md`,line:2};return{commentsByTarget:e===`converged`?{[t.key]:[{id:`first`,createdAt:`2026-08-11T00:00:00Z`,label:`First`},{id:`second`,createdAt:`2026-08-11T00:00:01Z`,label:`Second`}]}:{},activeCommentId:e===`converged`?`second`:null,draft:e===`composer`?{target:t,body:`Keyboard-accessible inline review`,isSaving:!1,origin:null}:null,onStartDraft:()=>void 0,onDraftBodyChange:()=>void 0,onCancelDraft:()=>void 0,onSubmitDraft:()=>void 0,onSelectComment:()=>void 0}}var d,f,p,m,h,g,_,v,y,b,x,S,C,w;e((()=>{i(),n(),s(),d=t(),{expect:f}=__STORYBOOK_MODULE_TEST__,p={title:`Diff/Comments/ViewerIntegration`,component:l,args:{mode:`unified`,state:`controls`,large:!1},argTypes:{mode:{control:`inline-radio`,options:[`unified`,`split`,`editor`]},state:{control:`inline-radio`,options:[`controls`,`composer`,`converged`]}},parameters:{layout:`fullscreen`}},m={},h={args:{mode:`split`,state:`composer`}},g={args:{mode:`unified`,state:`converged`}},_={args:{mode:`unified`,state:`composer`}},v={args:{mode:`split`,state:`controls`}},y={args:{mode:`editor`,state:`composer`}},b={args:{mode:`unified`,state:`converged`}},x={args:{mode:`unified`,large:!0},play:async({canvasElement:e})=>{await f(e.querySelectorAll(`.diff-viewer__row`).length).toBeLessThanOrEqual(500)}},S={args:{mode:`split`,large:!0},play:async({canvasElement:e})=>{await f(e.querySelectorAll(`.diff-viewer__row`).length).toBeLessThanOrEqual(500)}},C={args:{mode:`editor`,large:!0},play:async({canvasElement:e})=>{await f(e.querySelectorAll(`[role="row"]`).length).toBeLessThanOrEqual(500)}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{}`,...m.parameters?.docs?.source}}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    mode: "split",
    state: "composer"
  }
}`,...h.parameters?.docs?.source}}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    mode: "unified",
    state: "converged"
  }
}`,...g.parameters?.docs?.source}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
  args: {
    mode: "unified",
    state: "composer"
  }
}`,..._.parameters?.docs?.source}}},v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    mode: "split",
    state: "controls"
  }
}`,...v.parameters?.docs?.source}}},y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    mode: "editor",
    state: "composer"
  }
}`,...y.parameters?.docs?.source}}},b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    mode: "unified",
    state: "converged"
  }
}`,...b.parameters?.docs?.source}}},x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  args: {
    mode: "unified",
    large: true
  },
  play: async ({
    canvasElement
  }) => {
    await expect(canvasElement.querySelectorAll(".diff-viewer__row").length).toBeLessThanOrEqual(500);
  }
}`,...x.parameters?.docs?.source}}},S.parameters={...S.parameters,docs:{...S.parameters?.docs,source:{originalSource:`{
  args: {
    mode: "split",
    large: true
  },
  play: async ({
    canvasElement
  }) => {
    await expect(canvasElement.querySelectorAll(".diff-viewer__row").length).toBeLessThanOrEqual(500);
  }
}`,...S.parameters?.docs?.source}}},C.parameters={...C.parameters,docs:{...C.parameters?.docs,source:{originalSource:`{
  args: {
    mode: "editor",
    large: true
  },
  play: async ({
    canvasElement
  }) => {
    await expect(canvasElement.querySelectorAll('[role="row"]').length).toBeLessThanOrEqual(500);
  }
}`,...C.parameters?.docs?.source}}},w=[`Default`,`AllProps`,`EdgeCases`,`UnifiedComments`,`SplitComments`,`EditorComments`,`ConvergedComments`,`LargeUnified`,`LargeSplit`,`LargeEditor`]}))();export{h as AllProps,b as ConvergedComments,m as Default,g as EdgeCases,y as EditorComments,C as LargeEditor,S as LargeSplit,x as LargeUnified,v as SplitComments,_ as UnifiedComments,w as __namedExportsOrder,p as default};