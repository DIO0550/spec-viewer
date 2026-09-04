import{n as e}from"./chunk-DnJy8xQt.js";import{t}from"./jsx-runtime-TRoWuN2H.js";import{at as n,l as r,r as i}from"./CommentThread-CpLrbSfx.js";import{t as a}from"./specBundleState-COzyL1fa.js";import{r as o}from"./errorMessage-ZdbmC6hN.js";import{n as s,t as c}from"./SpecDocumentViewer-BEaPO7-h.js";function l({artifact:e,comments:t=[]}){return{showOpenWorkspacePrompt:!1,openWorkspace:{isOpening:!1,recentWorkspaces:[],onOpenWorkspace:f(),onOpenRecentWorkspace:f(),onRemoveRecentWorkspace:f()},viewer:{bundleState:a.loaded({specId:`091`,progress:`inProgress`,artifacts:[e]}),artifact:e,workspacePath:`/workspace/spec-viewer`,selectedSpecLabel:`Issue 108`,onReload:f(),onFirstReadable:f()},comments:{enabled:!0,layer:{comments:t,activeCommentId:t[0]?.id??null,addState:{isSaving:!1,errorMessage:null,isScopeReady:!0},editState:{isSaving:!1,operationState:n.create()},actions:{add:f().mockResolvedValue(!0),update:f().mockResolvedValue(!0),resolve:f().mockResolvedValue(!0),delete:f().mockResolvedValue(!0),select:f(),reportAnchorDisplayStates:f()}}}}}var u,d,f,p,m,h,g,_,v,y,b,x,S,C,w,T;e((()=>{o(),r(),s(),u=t(),{expect:d,fn:f,userEvent:p,within:m}=__STORYBOOK_MODULE_TEST__,h=`A commentable paragraph for the composition boundary.`,g={identity:{kind:`standard`,fileKey:`impl`},fileKey:`impl`,fileName:`implementation-plan.md`,label:`Implementation Plan`,format:`markdown`,progress:`inProgress`,path:`.plugin-workspace/.specs/091/implementation-plan.md`,contents:`# App composition\n\n${h}`,blocks:[{blockType:`heading`,blockIndex:0,textHash:`sha256:heading`,textSnippet:`App composition`,sourceRange:null},{blockType:`paragraph`,blockIndex:1,textHash:`sha256:paragraph`,textSnippet:h,sourceRange:null}],error:null},_={...g,identity:{kind:`directMarkdown`,fileName:`Notes.md`},fileKey:null,fileName:`Notes.md`,label:`Notes`,path:`.plugin-workspace/.specs/091/Notes.md`},v={id:i.fromString(`story-comment`),anchor:{fileKey:`impl`,blockType:`paragraph`,blockIndex:1,textHash:`sha256:paragraph`,textSnippet:h,charRange:{start:2,end:13}},body:`The App boundary owns this comment integration.`,status:`open`,anchorResolution:null,createdAt:`2026-09-03T00:00:00Z`,updatedAt:`2026-09-03T00:00:00Z`},y={component:c,parameters:{layout:`fullscreen`},decorators:[e=>(0,u.jsx)(`div`,{className:`specs-workspace__viewer`,style:{minHeight:640},children:(0,u.jsx)(e,{})})],args:l({artifact:_})},b={},x={args:l({artifact:g,comments:[v]})},S={args:l({artifact:g,comments:[{...v,id:i.fromString(`story-stale-comment`),anchor:{...v.anchor,textHash:`sha256:old-paragraph`}}]})},C={args:l({artifact:g,comments:[v]}),play:async({canvasElement:e})=>{let t=m(e);await p.click(t.getAllByRole(`button`,{name:`コメント追加`})[1]),await d(t.getByRole(`dialog`)).toBeInTheDocument()}},w={args:l({artifact:g,comments:[v]}),play:async({canvasElement:e})=>{let t=m(e);await p.click(t.getByRole(`button`,{name:/コメントを開く/})),await p.click(t.getByRole(`button`,{name:/コメント編集を開く/})),await d(t.getByRole(`dialog`)).toBeInTheDocument()}},b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{}`,...b.parameters?.docs?.source}}},x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  args: createStoryArgs({
    artifact: standardArtifact,
    comments: [comment]
  })
}`,...x.parameters?.docs?.source}}},S.parameters={...S.parameters,docs:{...S.parameters?.docs,source:{originalSource:`{
  args: createStoryArgs({
    artifact: standardArtifact,
    comments: [{
      ...comment,
      id: CommentId.fromString("story-stale-comment"),
      anchor: {
        ...comment.anchor,
        textHash: "sha256:old-paragraph"
      }
    }]
  })
}`,...S.parameters?.docs?.source}}},C.parameters={...C.parameters,docs:{...C.parameters?.docs,source:{originalSource:`{
  args: createStoryArgs({
    artifact: standardArtifact,
    comments: [comment]
  }),
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getAllByRole("button", {
      name: "コメント追加"
    })[1]);
    await expect(canvas.getByRole("dialog")).toBeInTheDocument();
  }
}`,...C.parameters?.docs?.source}}},w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  args: createStoryArgs({
    artifact: standardArtifact,
    comments: [comment]
  }),
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", {
      name: /コメントを開く/
    }));
    await userEvent.click(canvas.getByRole("button", {
      name: /コメント編集を開く/
    }));
    await expect(canvas.getByRole("dialog")).toBeInTheDocument();
  }
}`,...w.parameters?.docs?.source}}},T=[`DirectArtifact`,`CommentIntegration`,`StaleAnchor`,`AddDraft`,`EditDraft`]}))();export{C as AddDraft,x as CommentIntegration,b as DirectArtifact,w as EditDraft,S as StaleAnchor,T as __namedExportsOrder,y as default};