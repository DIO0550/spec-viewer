import{n as e}from"./chunk-DnJy8xQt.js";import{t}from"./jsx-runtime-BpX3lQ6F.js";import{n,t as r}from"./MarkdownViewer-FAeEQgJV.js";import{i,r as a}from"./comment-anchor-draft-CZ_exnwN.js";import{n as o,t as s}from"./commentId-BzcUTf6f.js";var c,l,u,d,f,p,m,h,g,_,v,y,b,x,S,C;e((()=>{o(),i(),n(),c=t(),{fn:l}=__STORYBOOK_MODULE_TEST__,u=s.fromString,d=`/workspace/spec-reviewer`,f={status:`ready`,workspacePath:d,specId:`selection-reliability`,fileKey:`tasks`,document:{key:`tasks`,path:`/workspace/spec-reviewer/docs/plans/tasks/later-phases/p7-02-markdown-copy-selection-reliability.md`,contents:[`# Selection reliability`,``,`Users can select only this paragraph fragment without activating the highlight.`,``,`- Copy should keep the exact selected range.`,`- Comment creation should still work from the selection button.`,``,"```ts",`const selectedText = "paragraph fragment";`,"```"].join(`
`),missing:!1,blocks:[{blockType:`heading`,blockIndex:0,textHash:a(`Selection reliability`),textSnippet:`Selection reliability`,sourceRange:null},{blockType:`paragraph`,blockIndex:1,textHash:a(`Users can select only this paragraph fragment without activating the highlight.`),textSnippet:`Users can select only this paragraph fragment without activating the highlight.`,sourceRange:null},{blockType:`list_item`,blockIndex:2,textHash:a(`Copy should keep the exact selected range.`),textSnippet:`Copy should keep the exact selected range.`,sourceRange:null},{blockType:`list_item`,blockIndex:3,textHash:a(`Comment creation should still work from the selection button.`),textSnippet:`Comment creation should still work from the selection button.`,sourceRange:null},{blockType:`code_block`,blockIndex:4,textHash:a(`const selectedText = "paragraph fragment";`),textSnippet:`const selectedText = "paragraph fragment";`,sourceRange:null}]},error:null},p={status:`ready`,workspacePath:d,specId:`tech-reference-tab`,fileKey:`tech-reference`,document:{key:`tech-reference`,format:`html`,path:`/workspace/spec-reviewer/.plugin-workspace/.specs/tech-reference-tab/tech-reference.html`,contents:[`<!doctype html>`,`<html>`,`<body>`,`<main>`,`<h1 id="overview">Tech Reference</h1>`,`<nav><a href="#overview">Overview</a> <a href="#schema-notes">Schema notes</a></nav>`,`<p>API surfaces, schema notes, and integration hints stay readable as HTML.</p>`,`<pre>GET /v1/specs/{workspaceId}/tech-reference?include=api,schema,integration,wide-reference-column</pre>`,`<table>`,`<thead><tr><th>Surface</th><th>Reference</th><th>Notes</th></tr></thead>`,`<tbody><tr><td>IPC</td><td>read_spec_document</td><td>HTML preview keeps wide technical content inside the viewer.</td></tr></tbody>`,`</table>`,`<h2 id="schema-notes">Schema notes</h2>`,`<p>Table of contents links stay inside the sandboxed HTML preview.</p>`,`</main>`,`</body>`,`</html>`].join(``),missing:!1,blocks:[]},error:null},m={status:`ready`,workspacePath:d,specId:`test-cases-tab`,fileKey:`test-cases`,document:{key:`test-cases`,format:`html`,path:`/workspace/spec-reviewer/.plugin-workspace/.specs/test-cases-tab/test-cases.html`,contents:[`<!doctype html>`,`<html>`,`<head><title>Source-only case noise</title></head>`,`<body>`,`<main>`,`<h1 id="cases">Test Cases</h1>`,`<p data-search-noise="edge scenario">Searchable body case for login and logout scenarios.</p>`,`<script>Searchable body case script noise<\/script>`,`<style>.searchable-body-case { color: red; }</style>`,`<table><tbody><tr><td>Scenario</td><td>Expected result</td></tr><tr><td>Login</td><td>Dashboard opens</td></tr></tbody></table>`,`</main>`,`</body>`,`</html>`].join(``),missing:!1,blocks:[]},error:null},h=`Users can select only this paragraph fragment without activating the highlight.`,g=[{id:u(`cmt_active_selection`),anchor:{fileKey:`tasks`,blockType:`paragraph`,blockIndex:1,textHash:a(h),textSnippet:`paragraph fragment`,charRange:{start:27,end:45}},body:`Verify partial selection stays copyable inside this highlight.`,status:`open`,anchorResolution:null,createdAt:`2026-05-07T00:00:00Z`,updatedAt:`2026-05-07T00:00:00Z`}],_=[...g,{id:u(`cmt_resolved_card`),anchor:{fileKey:`tasks`,blockType:`paragraph`,blockIndex:1,textHash:a(h),textSnippet:h,charRange:{start:0,end:79}},body:`Resolved note stays visible without making the paragraph feel busy.`,status:`resolved`,anchorResolution:null,createdAt:`2026-05-07T00:10:00Z`,updatedAt:`2026-05-07T00:20:00Z`},{id:u(`cmt_code_card`),anchor:{fileKey:`tasks`,blockType:`code_block`,blockIndex:4,textHash:a(`const selectedText = "paragraph fragment";`),textSnippet:`selectedText`,charRange:{start:6,end:18}},body:`Code block comments keep the gutter add button available.`,status:`open`,anchorResolution:null,createdAt:`2026-05-07T00:30:00Z`,updatedAt:`2026-05-07T00:30:00Z`}],v={component:r,args:{state:f,selectedSpecLabel:`Later Phases`,selectedFileLabel:`Tasks`,comments:g,activeCommentId:u(`cmt_active_selection`),onReload:l(),onSelectComment:l(),onAddComment:l()},argTypes:{onReload:{control:!1},onSelectComment:{control:!1},onAddComment:{control:!1}}},y={},b={args:{comments:_,activeCommentId:u(`cmt_active_selection`)}},x={parameters:{layout:`fullscreen`},render:e=>(0,c.jsx)(`div`,{className:`app-shell__viewer`,style:{height:`100dvh`},children:(0,c.jsx)(r,{...e})}),args:{state:p,selectedSpecLabel:`Tech Reference Tab`,selectedFileLabel:`Tech Reference`,comments:[],activeCommentId:null}},S={parameters:{layout:`fullscreen`},render:e=>(0,c.jsx)(`div`,{className:`app-shell__viewer`,style:{height:`100dvh`},children:(0,c.jsx)(r,{...e})}),args:{state:m,selectedSpecLabel:`Test Cases Tab`,selectedFileLabel:`Test Cases`,comments:[],activeCommentId:null}},y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{}`,...y.parameters?.docs?.source}}},b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    comments: commentCardComments,
    activeCommentId: commentId("cmt_active_selection")
  }
}`,...b.parameters?.docs?.source}}},x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  parameters: {
    layout: "fullscreen"
  },
  /**
   * Renders the story inside a full-height app shell wrapper.
   * @param args - Story args forwarded to the MarkdownViewer.
   */
  render: args => <div className="app-shell__viewer" style={{
    height: "100dvh"
  }}>
      <MarkdownViewer {...args} />
    </div>,
  args: {
    state: techReferenceHtmlState,
    selectedSpecLabel: "Tech Reference Tab",
    selectedFileLabel: "Tech Reference",
    comments: [],
    activeCommentId: null
  }
}`,...x.parameters?.docs?.source}}},S.parameters={...S.parameters,docs:{...S.parameters?.docs,source:{originalSource:`{
  parameters: {
    layout: "fullscreen"
  },
  /**
   * Renders the story inside a full-height app shell wrapper.
   * @param args - Story args forwarded to the MarkdownViewer.
   */
  render: args => <div className="app-shell__viewer" style={{
    height: "100dvh"
  }}>
      <MarkdownViewer {...args} />
    </div>,
  args: {
    state: testCasesHtmlState,
    selectedSpecLabel: "Test Cases Tab",
    selectedFileLabel: "Test Cases",
    comments: [],
    activeCommentId: null
  }
}`,...S.parameters?.docs?.source}}},C=[`HighlightedSelectionSurface`,`ExistingCommentCards`,`TechReferenceHtmlPreview`,`TestCasesHtml`]}))();export{b as ExistingCommentCards,y as HighlightedSelectionSurface,x as TechReferenceHtmlPreview,S as TestCasesHtml,C as __namedExportsOrder,v as default};