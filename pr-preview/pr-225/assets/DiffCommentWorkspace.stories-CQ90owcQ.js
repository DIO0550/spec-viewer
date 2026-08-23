import{a as e,n as t}from"./chunk-DnJy8xQt.js";import{i as n}from"./iframe-BL9YdAjS.js";import{t as r}from"./jsx-runtime-B3THDwZN.js";import{n as i,t as a}from"./DiffViewer-DCRhxmyV.js";import{n as o,t as s}from"./CurrentFileViewer-DEt2uRbI.js";import{n as c,r as l,t as u}from"./testFixtures-Bhkbu1WV.js";function d(e){let[t,n]=(0,p.useState)(null),r=e.large?c():u({oldContent:`first
old
last`,newContent:`first
current
last`}),i={...f(e.state,t),onStartDraft:(e,t)=>{n({target:e,body:``,isSaving:!1,origin:t})},onDraftBodyChange:e=>{n(t=>t===null?t:{...t,body:e})},onCancelDraft:()=>n(null)};return e.mode===`editor`?(0,m.jsx)(s,{fileDiff:r,activeChangeId:`hunk-0-change-0`,lineComments:i}):(0,m.jsx)(a,{fileDiff:r,mode:e.mode,activeChangeId:null,onActiveChangeIdChange:()=>void 0,lineComments:i})}function f(e,t){let n={key:`current:implementation-plan.md:2`,side:`current`,sidePath:`implementation-plan.md`,line:2},r=t;return r===null&&e===`composer`&&(r={target:n,body:`Keyboard-accessible inline review`,isSaving:!1,origin:null}),{commentsByTarget:e===`converged`?{[n.key]:[{id:`first`,createdAt:`2026-08-11T00:00:00Z`,label:`First`},{id:`second`,createdAt:`2026-08-11T00:00:01Z`,label:`Second`}]}:{},activeCommentId:e===`converged`?`second`:null,draft:r,onStartDraft:()=>void 0,onDraftBodyChange:()=>void 0,onCancelDraft:()=>void 0,onSubmitDraft:()=>void 0,onSelectComment:()=>void 0}}var p,m,h,g,_,v,y,b,x,S,C,w,T,E,D;t((()=>{p=e(n(),1),o(),i(),l(),m=r(),{expect:h}=__STORYBOOK_MODULE_TEST__,g={title:`Diff/Comments/ViewerIntegration`,component:d,args:{mode:`unified`,state:`controls`,large:!1},argTypes:{mode:{control:`inline-radio`,options:[`unified`,`split`,`editor`]},state:{control:`inline-radio`,options:[`controls`,`composer`,`converged`]}},parameters:{layout:`fullscreen`}},_={},v={args:{mode:`split`,state:`composer`}},y={args:{mode:`unified`,state:`converged`}},b={args:{mode:`unified`,state:`composer`}},x={args:{mode:`split`,state:`controls`}},S={args:{mode:`editor`,state:`composer`}},C={args:{mode:`unified`,state:`converged`}},w={args:{mode:`unified`,large:!0},play:async({canvasElement:e})=>{await h(e.querySelectorAll(`.diff-viewer__row`).length).toBeLessThanOrEqual(500)}},T={args:{mode:`split`,large:!0},play:async({canvasElement:e})=>{await h(e.querySelectorAll(`.diff-viewer__row`).length).toBeLessThanOrEqual(500)}},E={args:{mode:`editor`,large:!0},play:async({canvasElement:e})=>{await h(e.querySelectorAll(`[role="row"]`).length).toBeLessThanOrEqual(500)}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{}`,..._.parameters?.docs?.source}}},v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    mode: "split",
    state: "composer"
  }
}`,...v.parameters?.docs?.source}}},y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    mode: "unified",
    state: "converged"
  }
}`,...y.parameters?.docs?.source}}},b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    mode: "unified",
    state: "composer"
  }
}`,...b.parameters?.docs?.source}}},x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  args: {
    mode: "split",
    state: "controls"
  }
}`,...x.parameters?.docs?.source}}},S.parameters={...S.parameters,docs:{...S.parameters?.docs,source:{originalSource:`{
  args: {
    mode: "editor",
    state: "composer"
  }
}`,...S.parameters?.docs?.source}}},C.parameters={...C.parameters,docs:{...C.parameters?.docs,source:{originalSource:`{
  args: {
    mode: "unified",
    state: "converged"
  }
}`,...C.parameters?.docs?.source}}},w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  args: {
    mode: "unified",
    large: true
  },
  play: async ({
    canvasElement
  }) => {
    await expect(canvasElement.querySelectorAll(".diff-viewer__row").length).toBeLessThanOrEqual(500);
  }
}`,...w.parameters?.docs?.source}}},T.parameters={...T.parameters,docs:{...T.parameters?.docs,source:{originalSource:`{
  args: {
    mode: "split",
    large: true
  },
  play: async ({
    canvasElement
  }) => {
    await expect(canvasElement.querySelectorAll(".diff-viewer__row").length).toBeLessThanOrEqual(500);
  }
}`,...T.parameters?.docs?.source}}},E.parameters={...E.parameters,docs:{...E.parameters?.docs,source:{originalSource:`{
  args: {
    mode: "editor",
    large: true
  },
  play: async ({
    canvasElement
  }) => {
    await expect(canvasElement.querySelectorAll('[role="row"]').length).toBeLessThanOrEqual(500);
  }
}`,...E.parameters?.docs?.source}}},D=[`Default`,`AllProps`,`EdgeCases`,`UnifiedComments`,`SplitComments`,`EditorComments`,`ConvergedComments`,`LargeUnified`,`LargeSplit`,`LargeEditor`]}))();export{v as AllProps,C as ConvergedComments,_ as Default,y as EdgeCases,S as EditorComments,E as LargeEditor,T as LargeSplit,w as LargeUnified,x as SplitComments,b as UnifiedComments,D as __namedExportsOrder,g as default};