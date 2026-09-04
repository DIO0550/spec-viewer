import{a as e,n as t}from"./chunk-DnJy8xQt.js";import{i as n}from"./iframe-I8ixOSe3.js";import{t as r}from"./jsx-runtime-TRoWuN2H.js";function i(e,t){return async({canvasElement:n})=>{let r=u(n);await c(r.getByRole(`alert`)).toHaveTextContent(t),await l.click(r.getByRole(`button`,{name:`${e} Retry`})),await c(r.getByRole(`status`)).toHaveTextContent(`retry requested`)}}function a({scenario:e,theme:t}){let[n,r]=(0,o.useState)(`ready`),i={unmanaged:`unmanaged repository`,"base-error":`base resolution failed`,"read-denied":`read permission denied`}[e];return(0,s.jsxs)(`main`,{"data-theme":t,"aria-label":`Review regression fixture`,style:{minHeight:`100vh`,padding:24,background:t===`dark`?`#111827`:`#f8fafc`,color:t===`dark`?`#f8fafc`:`#111827`},children:[(0,s.jsxs)(`header`,{children:[(0,s.jsx)(`h1`,{children:`Specs / Diff / Review`}),(0,s.jsxs)(`p`,{children:[`Scenario: `,e]})]}),(0,s.jsxs)(`div`,{style:{display:`grid`,gridTemplateColumns:`minmax(180px, 1fr) 2fr minmax(220px, 1fr)`,gap:16},children:[(0,s.jsxs)(`nav`,{"aria-label":`Specs hierarchy`,children:[(0,s.jsx)(`strong`,{children:`Specs`}),(0,s.jsxs)(`ul`,{children:[(0,s.jsx)(`li`,{children:`Active / 199-regression`}),(0,s.jsx)(`li`,{children:`Archive / 198-comments`}),(0,s.jsx)(`li`,{children:`Progress: processing → complete`})]})]}),(0,s.jsxs)(`section`,{"aria-label":`Diff workspace`,children:[(0,s.jsxs)(`div`,{role:`tablist`,"aria-label":`Diff modes`,children:[(0,s.jsx)(`button`,{role:`tab`,"aria-selected":e===`unified`,children:`Unified`}),(0,s.jsx)(`button`,{role:`tab`,"aria-selected":e===`split`,children:`Split`}),(0,s.jsx)(`button`,{role:`tab`,"aria-selected":e===`editor`,children:`Editor`})]}),(0,s.jsx)(`pre`,{children:e===`deleted-file`?`Selected file was deleted; fallback selected`:`+ deterministic review line
- previous review line`})]}),(0,s.jsxs)(`aside`,{"aria-label":`Review`,children:[(0,s.jsx)(`strong`,{children:`Review`}),(0,s.jsx)(`p`,{children:e===`conflict`?`Revision conflict — draft preserved`:e===`stale`?`Stale anchor — re-anchor required`:`2 open / 1 resolved`}),(0,s.jsx)(`article`,{children:`implementation-plan.md current 42`})]})]}),i?(0,s.jsx)(`div`,{role:`alert`,children:i}):null,i?(0,s.jsxs)(`button`,{type:`button`,onClick:()=>r(`retry requested`),children:[e===`unmanaged`?`[R199-ERR-001]`:e===`base-error`?`[R199-VIEW-005]`:`[R199-ERR-002]`,` `,`Retry`]}):null,(0,s.jsx)(`p`,{role:`status`,children:n})]})}var o,s,c,l,u,d,f,p,m,h,g,_,v,y,b,x,S,C,w,T,E,D,O;t((()=>{o=e(n(),1),s=r(),{expect:c,userEvent:l,within:u}=__STORYBOOK_MODULE_TEST__,d={title:`App/ReviewRegression`,component:a,parameters:{layout:`fullscreen`},args:{scenario:`specs-hierarchy`,theme:`light`}},f={},p={args:{scenario:`archive`}},m={args:{scenario:`progress`}},h={args:{scenario:`changed-tree`}},g={args:{scenario:`all-lazy`}},_={args:{scenario:`unified`}},v={args:{scenario:`split`,theme:`dark`}},y={args:{scenario:`editor`,theme:`dark`}},b={args:{scenario:`conflict`}},x={args:{scenario:`stale`,theme:`dark`}},S={args:{scenario:`review-filters`}},C={args:{scenario:`convergence`,theme:`dark`}},w={args:{scenario:`unmanaged`},play:i(`[R199-ERR-001]`,`unmanaged repository`)},T={args:{scenario:`base-error`},play:i(`[R199-VIEW-005]`,`base resolution failed`)},E={args:{scenario:`read-denied`},play:i(`[R199-ERR-002]`,`read permission denied`)},D={args:{scenario:`deleted-file`}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{}`,...f.parameters?.docs?.source}}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    scenario: "archive"
  }
}`,...p.parameters?.docs?.source}}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    scenario: "progress"
  }
}`,...m.parameters?.docs?.source}}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    scenario: "changed-tree"
  }
}`,...h.parameters?.docs?.source}}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    scenario: "all-lazy"
  }
}`,...g.parameters?.docs?.source}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
  args: {
    scenario: "unified"
  }
}`,..._.parameters?.docs?.source}}},v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    scenario: "split",
    theme: "dark"
  }
}`,...v.parameters?.docs?.source}}},y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    scenario: "editor",
    theme: "dark"
  }
}`,...y.parameters?.docs?.source}}},b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    scenario: "conflict"
  }
}`,...b.parameters?.docs?.source}}},x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  args: {
    scenario: "stale",
    theme: "dark"
  }
}`,...x.parameters?.docs?.source}}},S.parameters={...S.parameters,docs:{...S.parameters?.docs,source:{originalSource:`{
  args: {
    scenario: "review-filters"
  }
}`,...S.parameters?.docs?.source}}},C.parameters={...C.parameters,docs:{...C.parameters?.docs,source:{originalSource:`{
  args: {
    scenario: "convergence",
    theme: "dark"
  }
}`,...C.parameters?.docs?.source}}},w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  args: {
    scenario: "unmanaged"
  },
  play: assertRetryableError("[R199-ERR-001]", "unmanaged repository")
}`,...w.parameters?.docs?.source}}},T.parameters={...T.parameters,docs:{...T.parameters?.docs,source:{originalSource:`{
  args: {
    scenario: "base-error"
  },
  play: assertRetryableError("[R199-VIEW-005]", "base resolution failed")
}`,...T.parameters?.docs?.source}}},E.parameters={...E.parameters,docs:{...E.parameters?.docs,source:{originalSource:`{
  args: {
    scenario: "read-denied"
  },
  play: assertRetryableError("[R199-ERR-002]", "read permission denied")
}`,...E.parameters?.docs?.source}}},D.parameters={...D.parameters,docs:{...D.parameters?.docs,source:{originalSource:`{
  args: {
    scenario: "deleted-file"
  }
}`,...D.parameters?.docs?.source}}},O=[`SpecsHierarchy`,`Archive`,`Progress`,`ChangedTree`,`AllLazy`,`Unified`,`Split`,`Editor`,`Conflict`,`Stale`,`ReviewFilters`,`Convergence`,`Unmanaged`,`BaseError`,`ReadDenied`,`DeletedFile`]}))();export{g as AllLazy,p as Archive,T as BaseError,h as ChangedTree,b as Conflict,C as Convergence,D as DeletedFile,y as Editor,m as Progress,E as ReadDenied,S as ReviewFilters,f as SpecsHierarchy,v as Split,x as Stale,_ as Unified,w as Unmanaged,O as __namedExportsOrder,d as default};