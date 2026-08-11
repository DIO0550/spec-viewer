import{n as e}from"./chunk-DnJy8xQt.js";import{t}from"./jsx-runtime-B-hFyic3.js";import{c as n,i as r,o as i,r as a}from"./comment-anchor-draft-CeBvn7BT.js";import{n as o,t as s}from"./commentId-C5cNTmAh.js";import{n as c,t as l}from"./CommentThread-DFNtX0IX.js";var u,d,f,p,m,h,g,_,v,y;e((()=>{o(),n(),r(),c(),u=t(),{fn:d}=__STORYBOOK_MODULE_TEST__,f=s.fromString(`thread-story-comment`),p=`The selected requirement remains actionable.`,m={id:f,anchor:{fileKey:`tasks`,blockType:`paragraph`,blockIndex:3,textHash:a(p),textSnippet:p,charRange:{start:0,end:44}},body:`Can we make this acceptance criterion measurable?`,status:`open`,anchorResolution:null,createdAt:`2026-05-07T10:00:00Z`,updatedAt:`2026-05-07T10:00:00Z`},h={component:l,decorators:[e=>(0,u.jsx)(`div`,{style:{maxWidth:420},children:(0,u.jsx)(e,{})})],args:{comment:m,isActive:!0,anchorDisplayStatus:`exact`,operationState:i.create(),onSelectComment:d(),onUpdateComment:d(),onResolveComment:d(),onReopenComment:d(),onDeleteComment:d()},argTypes:{comment:{control:!1},operationState:{control:!1},onSelectComment:{control:!1},onUpdateComment:{control:!1},onResolveComment:{control:!1},onReopenComment:{control:!1},onDeleteComment:{control:!1}}},g={},_={args:{comment:{...m,id:s.fromString(`thread-story-resolved`),status:`resolved`,body:`This resolved note demonstrates highlighted search text and a moved anchor.`},isActive:!1,anchorDisplayStatus:`moved`,searchQuery:`resolved`}},v={args:{comment:{...m,body:`A comment with a long body stays readable when the card has narrow space. `.repeat(4)},anchorDisplayStatus:`orphaned`,searchQuery:`not-found`}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{}`,...g.parameters?.docs?.source}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
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