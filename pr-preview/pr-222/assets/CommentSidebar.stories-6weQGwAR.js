import{n as e}from"./chunk-DnJy8xQt.js";import{i as t,n,r,t as i}from"./CommentSidebar-A3CQ_w9P.js";import{t as a}from"./jsx-runtime-BpX3lQ6F.js";import{a as o,c as s,i as c,o as l,r as u}from"./comment-anchor-draft-CZ_exnwN.js";import{n as d,t as f}from"./commentId-BzcUTf6f.js";var p,m,h,g,_,v,y,b,x,S,C,w,T,E,D,O;e((()=>{d(),t(),s(),c(),n(),p=a(),{fn:m}=__STORYBOOK_MODULE_TEST__,h=f.fromString(`sidebar-open-comment`),g=f.fromString(`sidebar-resolved-comment`),_={id:h,anchor:{fileKey:`tasks`,blockType:`paragraph`,blockIndex:1,textHash:u(`Keep the selected requirement observable.`),textSnippet:`Keep the selected requirement observable.`,charRange:{start:0,end:42}},body:`Please add an observable acceptance signal.`,status:`open`,anchorResolution:null,createdAt:`2026-05-07T10:00:00Z`,updatedAt:`2026-05-07T10:00:00Z`},v={..._,id:g,body:`The acceptance signal is now covered by the test plan.`,status:`resolved`},y={feature:`comments`,code:`commentRepository`,message:`The comment store is unavailable.`,cause:{command:`list_comments`,code:`commentRepository`,message:`The comment store is unavailable.`,raw:`story fixture`}},b={status:`success`,operation:`file`,message:`Comments exported to review-comments.md`},x={component:i,decorators:[e=>(0,p.jsx)(`div`,{style:{minHeight:560,width:390},children:(0,p.jsx)(e,{})})],args:{listState:r.loaded([_,v]),operationState:l.create(),activeCommentId:h,anchorDisplayStates:[{commentId:h,status:`exact`},{commentId:g,status:`fuzzy`}],onSelectComment:m(),onResolveComment:m(),onReopenComment:m(),onDeleteComment:m(),onUpdateComment:m(),onReload:m(),onExportComments:m(),onCopyLlmPrompt:m(),onCopyMcpFeedback:m()},argTypes:{listState:{control:!1},operationState:{control:!1},activeCommentId:{control:!1},anchorDisplayStates:{control:!1},exportState:{control:!1},onSelectComment:{control:!1},onResolveComment:{control:!1},onReopenComment:{control:!1},onDeleteComment:{control:!1},onUpdateComment:{control:!1},onReload:{control:!1},onExportComments:{control:!1},onCopyLlmPrompt:{control:!1},onCopyMcpFeedback:{control:!1}}},S={},C={args:{exportState:b,operationState:o.create(`update`,h,y)}},w={args:{listState:r.loading(),activeCommentId:null,anchorDisplayStates:[]}},T={args:{listState:r.loaded([]),activeCommentId:null,anchorDisplayStates:[]}},E={args:{listState:r.error(y),activeCommentId:null,anchorDisplayStates:[]}},D={args:{listState:r.loaded([{..._,body:`A very long comment body remains searchable and readable. `.repeat(10)}]),activeCommentId:h,anchorDisplayStates:[{commentId:h,status:`orphaned`}]}},S.parameters={...S.parameters,docs:{...S.parameters?.docs,source:{originalSource:`{}`,...S.parameters?.docs?.source}}},C.parameters={...C.parameters,docs:{...C.parameters?.docs,source:{originalSource:`{
  args: {
    exportState: successfulExport,
    operationState: CommentOperationFailedState.create("update", openCommentId, commentError)
  }
}`,...C.parameters?.docs?.source}}},w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  args: {
    listState: CommentListState.loading(),
    activeCommentId: null,
    anchorDisplayStates: []
  }
}`,...w.parameters?.docs?.source}}},T.parameters={...T.parameters,docs:{...T.parameters?.docs,source:{originalSource:`{
  args: {
    listState: CommentListState.loaded([]),
    activeCommentId: null,
    anchorDisplayStates: []
  }
}`,...T.parameters?.docs?.source}}},E.parameters={...E.parameters,docs:{...E.parameters?.docs,source:{originalSource:`{
  args: {
    listState: CommentListState.error(commentError),
    activeCommentId: null,
    anchorDisplayStates: []
  }
}`,...E.parameters?.docs?.source}}},D.parameters={...D.parameters,docs:{...D.parameters?.docs,source:{originalSource:`{
  args: {
    listState: CommentListState.loaded([{
      ...openComment,
      body: "A very long comment body remains searchable and readable. ".repeat(10)
    }]),
    activeCommentId: openCommentId,
    anchorDisplayStates: [{
      commentId: openCommentId,
      status: "orphaned"
    }]
  }
}`,...D.parameters?.docs?.source}}},O=[`Default`,`AllProps`,`Loading`,`Empty`,`Error`,`EdgeCases`]}))();export{C as AllProps,S as Default,D as EdgeCases,T as Empty,E as Error,w as Loading,O as __namedExportsOrder,x as default};