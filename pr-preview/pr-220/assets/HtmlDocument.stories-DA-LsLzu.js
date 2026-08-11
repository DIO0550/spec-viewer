import{n as e}from"./chunk-DnJy8xQt.js";import{t}from"./jsx-runtime-B-hFyic3.js";import{n,t as r}from"./HtmlDocument-DkZsRv0x.js";var i,a,o=e((()=>{i=`<!doctype html>
<html>
  <head>
    <title>Understanding Quiz Plan</title>
  </head>
  <body>
    <main>
      <h1>Understanding Quiz Plan</h1>
      <p>Answer the question to verify that the plan is easy to explain.</p>
      <section aria-labelledby="plan-question">
        <h2 id="plan-question">What should the viewer do when a quiz file is missing?</h2>
        <ol data-quiz-options>
          <li>Hide the tab</li>
          <li>Show the quiz file as Missing in the default tab order</li>
        </ol>
        <button type="button" data-quiz-answer="correct">Show answer</button>
        <button type="button" data-quiz-reorder>Reorder choices</button>
        <p data-quiz-feedback hidden>Show the quiz file as Missing in the default tab order.</p>
      </section>
    </main>
    <script>
      const button = document.querySelector('[data-quiz-answer="correct"]');
      button?.addEventListener('click', () => {
        const feedback = document.querySelector('[data-quiz-feedback]');
        if (feedback) feedback.hidden = false;
        button.disabled = true;
      });
      const reorder = document.querySelector('[data-quiz-reorder]');
      reorder?.addEventListener('click', () => {
        const options = document.querySelector('[data-quiz-options]');
        if (options?.firstElementChild) options.append(options.firstElementChild);
        reorder.disabled = true;
      });
    <\/script>
  </body>
</html>`,a=`<!doctype html>
<html>
  <head>
    <title>Understanding Quiz Implementation</title>
  </head>
  <body>
    <main>
      <h1>Understanding Quiz Implementation</h1>
      <p>Use the interactive prompt to check the implementation behavior.</p>
      <section aria-labelledby="impl-question">
        <h2 id="impl-question">Which files need script execution in the preview?</h2>
        <ol>
          <li data-quiz-option="wrong">Every HTML file</li>
          <li data-quiz-option="correct">Only the two understanding quiz files</li>
        </ol>
        <button type="button" data-quiz-answer="correct">Check answer</button>
        <p data-quiz-feedback hidden>Correct: the allowlist enables scripts only for the quiz HTML files.</p>
      </section>
    </main>
    <script>
      const button = document.querySelector('[data-quiz-answer="correct"]');
      button?.addEventListener('click', () => {
        const feedback = document.querySelector('[data-quiz-feedback]');
        if (feedback) feedback.hidden = false;
        button.disabled = true;
      });
    <\/script>
  </body>
</html>`})),s,c,l,u,d,f,p,m;e((()=>{n(),o(),s=t(),c={component:r,parameters:{layout:`fullscreen`},decorators:[e=>(0,s.jsx)(`div`,{style:{height:`80vh`,minHeight:360},children:(0,s.jsx)(e,{})})],args:{contents:`<!doctype html>
<html>
  <body>
    <main>
      <h1 id="overview">Technical reference</h1>
      <p>HTML documents render in a sandboxed preview frame.</p>
      <h2 id="schema">Schema</h2>
      <p>Search highlighting stays inside the preview document.</p>
    </main>
  </body>
</html>`,path:`/workspace/spec-reviewer/.plugin-workspace/.specs/reference/reference.html`,zoomPercent:100,searchQuery:``,activeSearchMatchIndex:-1},argTypes:{contents:{control:!1}}},l={},u={args:{zoomPercent:125,searchQuery:`schema`,activeSearchMatchIndex:0}},d={args:{contents:`<main><p>No searchable heading here.</p></main>`,path:`/workspace/spec-reviewer/test-cases.html`,zoomPercent:50,searchQuery:`missing phrase`,activeSearchMatchIndex:-1}},f={args:{contents:i,path:`/workspace/spec-reviewer/.plugin-workspace/.specs/reference/understanding-quiz-plan.html`,searchQuery:`Missing`,activeSearchMatchIndex:0}},p={args:{contents:a,path:`/workspace/spec-reviewer/.plugin-workspace/.specs/reference/understanding-quiz-impl.html`}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    zoomPercent: 125,
    searchQuery: "schema",
    activeSearchMatchIndex: 0
  }
}`,...u.parameters?.docs?.source}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    contents: "<main><p>No searchable heading here.</p></main>",
    path: "/workspace/spec-reviewer/test-cases.html",
    zoomPercent: 50,
    searchQuery: "missing phrase",
    activeSearchMatchIndex: -1
  }
}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    contents: understandingQuizPlanFixture,
    path: "/workspace/spec-reviewer/.plugin-workspace/.specs/reference/understanding-quiz-plan.html",
    searchQuery: "Missing",
    activeSearchMatchIndex: 0
  }
}`,...f.parameters?.docs?.source}}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    contents: understandingQuizImplFixture,
    path: "/workspace/spec-reviewer/.plugin-workspace/.specs/reference/understanding-quiz-impl.html"
  }
}`,...p.parameters?.docs?.source}}},m=[`Default`,`AllProps`,`EdgeCases`,`UnderstandingQuizPlan`,`UnderstandingQuizImpl`]}))();export{u as AllProps,l as Default,d as EdgeCases,p as UnderstandingQuizImpl,f as UnderstandingQuizPlan,m as __namedExportsOrder,c as default};