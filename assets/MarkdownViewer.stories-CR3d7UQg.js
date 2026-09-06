import{n as e}from"./chunk-DnJy8xQt.js";import{t}from"./jsx-runtime-TRoWuN2H.js";import{n,t as r}from"./MarkdownViewer-Dr4poSB0.js";var i,a,o,s,c,l,u,d,f,p,m,h,g,_;e((()=>{n(),i=t(),{fn:a}=__STORYBOOK_MODULE_TEST__,o=e=>e,s=`/workspace/spec-reviewer`,c={status:`ready`,workspacePath:s,specId:`selection-reliability`,fileKey:`tasks`,document:{key:`tasks`,path:`/workspace/spec-reviewer/docs/plans/tasks/later-phases/p7-02-markdown-copy-selection-reliability.md`,contents:[`# Selection reliability`,``,`Users can select only this paragraph fragment without activating the highlight.`,``,`- Copy should keep the exact selected range.`,`- Comment creation should still work from the selection button.`,``,"```ts",`const selectedText = "paragraph fragment";`,"```"].join(`
`),missing:!1,blocks:[{blockType:`heading`,blockIndex:0,textHash:o(`Selection reliability`),textSnippet:`Selection reliability`,sourceRange:null},{blockType:`paragraph`,blockIndex:1,textHash:o(`Users can select only this paragraph fragment without activating the highlight.`),textSnippet:`Users can select only this paragraph fragment without activating the highlight.`,sourceRange:null},{blockType:`list_item`,blockIndex:2,textHash:o(`Copy should keep the exact selected range.`),textSnippet:`Copy should keep the exact selected range.`,sourceRange:null},{blockType:`list_item`,blockIndex:3,textHash:o(`Comment creation should still work from the selection button.`),textSnippet:`Comment creation should still work from the selection button.`,sourceRange:null},{blockType:`code_block`,blockIndex:4,textHash:o(`const selectedText = "paragraph fragment";`),textSnippet:`const selectedText = "paragraph fragment";`,sourceRange:null}]},error:null},l={status:`ready`,workspacePath:s,specId:`tech-reference-tab`,fileKey:`tech-reference`,document:{key:`tech-reference`,format:`html`,path:`/workspace/spec-reviewer/.plugin-workspace/.specs/tech-reference-tab/tech-reference.html`,contents:[`<!doctype html>`,`<html>`,`<body>`,`<main>`,`<h1 id="overview">Tech Reference</h1>`,`<nav><a href="#overview">Overview</a> <a href="#schema-notes">Schema notes</a></nav>`,`<p>API surfaces, schema notes, and integration hints stay readable as HTML.</p>`,`<pre>GET /v1/specs/{workspaceId}/tech-reference?include=api,schema,integration,wide-reference-column</pre>`,`<table>`,`<thead><tr><th>Surface</th><th>Reference</th><th>Notes</th></tr></thead>`,`<tbody><tr><td>IPC</td><td>read_spec_document</td><td>HTML preview keeps wide technical content inside the viewer.</td></tr></tbody>`,`</table>`,`<h2 id="schema-notes">Schema notes</h2>`,`<p>Table of contents links stay inside the sandboxed HTML preview.</p>`,`</main>`,`</body>`,`</html>`].join(``),missing:!1,blocks:[]},error:null},u={status:`ready`,workspacePath:s,specId:`test-cases-tab`,fileKey:`test-cases`,document:{key:`test-cases`,format:`html`,path:`/workspace/spec-reviewer/.plugin-workspace/.specs/test-cases-tab/test-cases.html`,contents:[`<!doctype html>`,`<html>`,`<head><title>Source-only case noise</title></head>`,`<body>`,`<main>`,`<h1 id="cases">Test Cases</h1>`,`<p data-search-noise="edge scenario">Searchable body case for login and logout scenarios.</p>`,`<script>Searchable body case script noise<\/script>`,`<style>.searchable-body-case { color: red; }</style>`,`<table><tbody><tr><td>Scenario</td><td>Expected result</td></tr><tr><td>Login</td><td>Dashboard opens</td></tr></tbody></table>`,`</main>`,`</body>`,`</html>`].join(``),missing:!1,blocks:[]},error:null},d={status:`ready`,workspacePath:s,specId:`mermaid-preview`,fileKey:`tasks`,document:{key:`tasks`,path:`/workspace/spec-reviewer/docs/plans/mermaid-preview.md`,contents:[`# Review flow`,``,"```mermaid",`flowchart LR`,`  Draft[Draft spec] --> Review{Review}`,`  Review -->|Approve| Done[Ready to implement]`,`  Review -->|Request changes| Draft`,"```"].join(`
`),missing:!1,blocks:[{blockType:`heading`,blockIndex:0,textHash:o(`Review flow`),textSnippet:`Review flow`,sourceRange:null},{blockType:`code_block`,blockIndex:1,textHash:o(`flowchart LR
  Draft[Draft spec] --> Review{Review}
  Review -->|Approve| Done[Ready to implement]
  Review -->|Request changes| Draft`),textSnippet:`flowchart LR Draft spec Review Ready to implement`,sourceRange:null}]},error:null},f={component:r,args:{state:c,selectedSpecLabel:`Later Phases`,selectedFileLabel:`Tasks`,onReload:a()},argTypes:{onReload:{control:!1}}},p={},m={args:{state:d,selectedSpecLabel:`Diagram preview`,selectedFileLabel:`Review flow`}},h={parameters:{layout:`fullscreen`},render:e=>(0,i.jsx)(`div`,{className:`app-shell__viewer`,style:{height:`100dvh`},children:(0,i.jsx)(r,{...e})}),args:{state:l,selectedSpecLabel:`Tech Reference Tab`,selectedFileLabel:`Tech Reference`}},g={parameters:{layout:`fullscreen`},render:e=>(0,i.jsx)(`div`,{className:`app-shell__viewer`,style:{height:`100dvh`},children:(0,i.jsx)(r,{...e})}),args:{state:u,selectedSpecLabel:`Test Cases Tab`,selectedFileLabel:`Test Cases`}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{}`,...p.parameters?.docs?.source}}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    state: mermaidState,
    selectedSpecLabel: "Diagram preview",
    selectedFileLabel: "Review flow"
  }
}`,...m.parameters?.docs?.source}}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
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
    selectedFileLabel: "Tech Reference"
  }
}`,...h.parameters?.docs?.source}}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
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
    selectedFileLabel: "Test Cases"
  }
}`,...g.parameters?.docs?.source}}},_=[`Default`,`MermaidDiagram`,`TechReferenceHtmlPreview`,`TestCasesHtml`]}))();export{p as Default,m as MermaidDiagram,h as TechReferenceHtmlPreview,g as TestCasesHtml,_ as __namedExportsOrder,f as default};