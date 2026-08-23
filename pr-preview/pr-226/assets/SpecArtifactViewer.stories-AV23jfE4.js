import{n as e}from"./chunk-DnJy8xQt.js";import{t}from"./jsx-runtime-B3THDwZN.js";import{i as n,n as r,r as i,t as a}from"./specBundleState-BjRoiDlr.js";var o,s,c,l,u,d,f,p,m,h,g,_,v,y,b;e((()=>{n(),r(),o=t(),{fn:s}=__STORYBOOK_MODULE_TEST__,c={identity:{kind:`directMarkdown`,fileName:`Notes.md`},fileKey:null,fileName:`Notes.md`,label:`Notes`,format:`markdown`,progress:`completed`,path:`.plugin-workspace/.specs/081/Notes.md`,contents:`# Notes

A direct Markdown artifact.

<script>window.__specViewerUnsafe = true<\/script>`,blocks:[{blockType:`heading`,blockIndex:0,textHash:`sha256:notes`,textSnippet:`Notes`,sourceRange:null},{blockType:`paragraph`,blockIndex:1,textHash:`sha256:direct-markdown`,textSnippet:`A direct Markdown artifact.`,sourceRange:null}],error:null},l={specId:`081-issue-194`,progress:`completed`,artifacts:[c]},u={component:i,args:{bundleState:a.loaded(l),artifact:c,workspacePath:`/workspace/project`,selectedSpecLabel:`Issue 194`,onReload:s()},decorators:[e=>(0,o.jsx)(`div`,{style:{maxWidth:920},children:(0,o.jsx)(e,{})})]},d={},f={args:{bundleState:a.loading(),artifact:null}},p={args:{bundleState:a.loaded({specId:`081-issue-194`,progress:`notStarted`,artifacts:[]}),artifact:null}},m={args:{artifact:{...c,contents:``,progress:`notStarted`}}},h={args:{bundleState:a.loaded({...l,progress:`unknown`,artifacts:[c,{...c,identity:{kind:`directMarkdown`,fileName:`Broken.md`},fileName:`Broken.md`,label:`Broken`,progress:`unknown`,contents:null,error:{code:`markdownRead`,message:`Could not read artifact.`}}]}),artifact:{...c,identity:{kind:`directMarkdown`,fileName:`Broken.md`},fileName:`Broken.md`,label:`Broken`,progress:`unknown`,contents:null,error:{code:`markdownRead`,message:`Could not read artifact.`}}}},g=`| ${`wide-column-`.repeat(20)} | value |`,_=`# Large document\n\n${`Long paragraph. `.repeat(14e3)}\n\n| Key | Value |\n| --- | --- |\n${g}\n\n\`\`\`ts\nconst value = "${`wide-code-`.repeat(80)}";\n\`\`\``,v=[{blockType:`heading`,blockIndex:0,textHash:`sha256:large-document`,textSnippet:`Large document`,sourceRange:null},{blockType:`paragraph`,blockIndex:1,textHash:`sha256:long-paragraph`,textSnippet:`Long paragraph.`,sourceRange:null},{blockType:`table`,blockIndex:2,textHash:`sha256:wide-table`,textSnippet:`Key Value`,sourceRange:null},{blockType:`code_block`,blockIndex:3,textHash:`sha256:wide-code`,textSnippet:`const value`,sourceRange:null}],y={args:{artifact:{...c,contents:_,blocks:v}},parameters:{viewport:{defaultViewport:`mobile1`}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    bundleState: SpecBundleState.loading(),
    artifact: null
  }
}`,...f.parameters?.docs?.source}}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    bundleState: SpecBundleState.loaded({
      specId: "081-issue-194",
      progress: "notStarted",
      artifacts: []
    }),
    artifact: null
  }
}`,...p.parameters?.docs?.source}}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    artifact: {
      ...markdownArtifact,
      contents: "",
      progress: "notStarted"
    }
  }
}`,...m.parameters?.docs?.source}}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    bundleState: SpecBundleState.loaded({
      ...bundle,
      progress: "unknown",
      artifacts: [markdownArtifact, {
        ...markdownArtifact,
        identity: {
          kind: "directMarkdown",
          fileName: "Broken.md"
        },
        fileName: "Broken.md",
        label: "Broken",
        progress: "unknown",
        contents: null,
        error: {
          code: "markdownRead",
          message: "Could not read artifact."
        }
      }]
    }),
    artifact: {
      ...markdownArtifact,
      identity: {
        kind: "directMarkdown",
        fileName: "Broken.md"
      },
      fileName: "Broken.md",
      label: "Broken",
      progress: "unknown",
      contents: null,
      error: {
        code: "markdownRead",
        message: "Could not read artifact."
      }
    }
  }
}`,...h.parameters?.docs?.source}}},y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    artifact: {
      ...markdownArtifact,
      contents: longMarkdown,
      blocks: longBlocks
    }
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile1"
    }
  }
}`,...y.parameters?.docs?.source}}},b=[`Default`,`Loading`,`ZeroArtifacts`,`EmptyDocument`,`PartialReadError`,`LongMarkdownWithWideTableAndCode`]}))();export{d as Default,m as EmptyDocument,f as Loading,y as LongMarkdownWithWideTableAndCode,h as PartialReadError,p as ZeroArtifacts,b as __namedExportsOrder,u as default};