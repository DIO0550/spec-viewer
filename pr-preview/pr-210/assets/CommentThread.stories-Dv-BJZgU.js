import{n as e}from"./chunk-DnJy8xQt.js";import{t}from"./jsx-runtime-BpX3lQ6F.js";import{a as n,c as r,n as i,o as a,t as o,u as s}from"./commentId-D2JE7cv5.js";import{n as c,t as l}from"./CommentThread-B0VfgPU8.js";var u,d,f,p,m,h,g,_,v,y;e((()=>{i(),s(),a(),c(),u=t(),{fn:d}=__STORYBOOK_MODULE_TEST__,f=o.fromString(`thread-story-comment`),p=`The selected requirement remains actionable.`,m={id:f,anchor:{fileKey:`tasks`,blockType:`paragraph`,blockIndex:3,textHash:n(p),textSnippet:p,charRange:{start:0,end:44}},body:`Can we make this acceptance criterion measurable?`,status:`open`,anchorResolution:null,createdAt:`2026-05-07T10:00:00Z`,updatedAt:`2026-05-07T10:00:00Z`},h={component:l,decorators:[e=>(0,u.jsx)(`div`,{style:{maxWidth:420},children:(0,u.jsx)(e,{})})],args:{comment:m,isActive:!0,anchorDisplayStatus:`exact`,operationState:r.create(),onSelectComment:d(),onUpdateComment:d(),onResolveComment:d(),onReopenComment:d(),onDeleteComment:d()},argTypes:{comment:{control:!1},operationState:{control:!1},onSelectComment:{control:!1},onUpdateComment:{control:!1},onResolveComment:{control:!1},onReopenComment:{control:!1},onDeleteComment:{control:!1}}},g={},_={args:{comment:{...m,id:o.fromString(`thread-story-resolved`),status:`resolved`,body:`This resolved note demonstrates highlighted search text and a moved anchor.`},isActive:!1,anchorDisplayStatus:`moved`,searchQuery:`resolved`}},v={args:{comment:{...m,body:`A comment with a long body stays readable when the card has narrow space. `.repeat(4)},anchorDisplayStatus:`orphaned`,searchQuery:`not-found`}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{}`,...g.parameters?.docs?.source}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
  args: {
    comment: {
      ...openComment,
      id: CommentId.fromString("thread-story-resolved"),
      status: "resolved",
      body: "This resolved note demonstrates highlighted search text and a moved anchor."
    },
    isActive: false,
    anchorDisplayStatus: "moved",
    searchQuery: "resolved"
  }
}`,..._.parameters?.docs?.source}}},v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    comment: {
      ...openComment,
      body: "A comment with a long body stays readable when the card has narrow space. ".repeat(4)
    },
    anchorDisplayStatus: "orphaned",
    searchQuery: "not-found"
  }
}`,...v.parameters?.docs?.source}}},y=[`Default`,`AllProps`,`EdgeCases`]}))();export{_ as AllProps,g as Default,v as EdgeCases,y as __namedExportsOrder,h as default};