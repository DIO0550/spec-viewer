import{n as e}from"./chunk-DnJy8xQt.js";import{t}from"./jsx-runtime-BX9360Lk.js";import{i as n,r}from"./CommentSidebar-DhR24SnP.js";import{c as i,i as a,o,r as s}from"./comment-anchor-draft-CNm67qj9.js";import{n as c,t as l}from"./commentId-0XF2jdVD.js";import{n as u,t as d}from"./SpecViewCommentSidebar-D4-vxEe5.js";var f,p,m,h,g,_,v,y,b,x,S,C;e((()=>{c(),n(),i(),a(),u(),f=t(),{fn:p}=__STORYBOOK_MODULE_TEST__,m=l.fromString(`comment-sidebar-story`),h=`/workspace/spec-reviewer`,g={id:m,anchor:{fileKey:`tasks`,blockType:`paragraph`,blockIndex:2,textHash:s(`The selected requirement should remain actionable.`),textSnippet:`The selected requirement should remain actionable.`,charRange:{start:4,end:46}},body:`Confirm the acceptance wording before implementation.`,status:`open`,anchorResolution:null,createdAt:`2026-05-07T10:00:00Z`,updatedAt:`2026-05-07T10:00:00Z`},_=[{commentId:m,status:`exact`}],v={component:d,decorators:[e=>(0,f.jsx)(`div`,{style:{minHeight:520,width:380},children:(0,f.jsx)(e,{})})],args:{comments:[g],resetKeys:{workspaceRoot:h,specId:`phase-1-viewer`,fileKey:`tasks`},listState:r.loaded([g]),operationState:o.create(),activeCommentId:m,anchorDisplayStates:_,onSelectComment:p(),onResolveComment:p(),onReopenComment:p(),onDeleteComment:p(),onUpdateComment:p(),onReloadComments:p()},argTypes:{comments:{control:!1},resetKeys:{control:!1},listState:{control:!1},operationState:{control:!1},anchorDisplayStates:{control:!1},onSelectComment:{control:!1},onResolveComment:{control:!1},onReopenComment:{control:!1},onDeleteComment:{control:!1},onUpdateComment:{control:!1},onReloadComments:{control:!1}}},y={},b={args:{comments:[],listState:r.loaded([]),activeCommentId:null,anchorDisplayStates:[]}},x={args:{comments:[],listState:r.loading(),activeCommentId:null,anchorDisplayStates:[]}},S={args:{comments:[g],listState:r.error({feature:`comments`,code:`commentRepository`,message:`Comments could not be loaded from this workspace.`,cause:{command:`list_comments`,code:`commentRepository`,message:`Comments could not be loaded from this workspace.`,raw:`story fixture`}}),activeCommentId:null,anchorDisplayStates:[]}},y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{}`,...y.parameters?.docs?.source}}},b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    comments: [],
    listState: CommentListState.loaded([]),
    activeCommentId: null,
    anchorDisplayStates: []
  }
}`,...b.parameters?.docs?.source}}},x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  args: {
    comments: [],
    listState: CommentListState.loading(),
    activeCommentId: null,
    anchorDisplayStates: []
  }
}`,...x.parameters?.docs?.source}}},S.parameters={...S.parameters,docs:{...S.parameters?.docs,source:{originalSource:`{
  args: {
    comments: [comment],
    listState: CommentListState.error({
      feature: "comments",
      code: "commentRepository",
      message: "Comments could not be loaded from this workspace.",
      cause: {
        command: "list_comments",
        code: "commentRepository",
        message: "Comments could not be loaded from this workspace.",
        raw: "story fixture"
      }
    }),
    activeCommentId: null,
    anchorDisplayStates: []
  }
}`,...S.parameters?.docs?.source}}},C=[`Default`,`Empty`,`Loading`,`EdgeCases`]}))();export{y as Default,S as EdgeCases,b as Empty,x as Loading,C as __namedExportsOrder,v as default};