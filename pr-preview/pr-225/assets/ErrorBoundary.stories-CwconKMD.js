import{n as e}from"./chunk-DnJy8xQt.js";import{t}from"./jsx-runtime-BpX3lQ6F.js";import{n,t as r}from"./ErrorBoundary-Cp4Tw4uT.js";function i(){throw new globalThis.Error(`Story child render failed`)}var a,o,s,c,l,u;e((()=>{n(),a=t(),o={component:r,decorators:[e=>(0,a.jsx)(`div`,{style:{minHeight:320},children:(0,a.jsx)(e,{})})],args:{children:(0,a.jsx)(`p`,{children:`Child content rendered inside the boundary.`})},argTypes:{children:{control:!1}}},s={},c={args:{children:(0,a.jsx)(i,{})}},l={args:{children:(0,a.jsxs)(`div`,{children:[(0,a.jsx)(`h2`,{children:`Recoverable content`}),(0,a.jsx)(`p`,{children:`The boundary passes through nested children when there is no error.`})]})}},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    children: <ThrowingChild />
  }
}`,...c.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    /** Recoverable children rendered when ErrorBoundary catches no error. */
    children: <div>
        <h2>Recoverable content</h2>
        <p>
          The boundary passes through nested children when there is no error.
        </p>
      </div>
  }
}`,...l.parameters?.docs?.source}}},u=[`Default`,`Error`,`EdgeCases`]}))();export{s as Default,l as EdgeCases,c as Error,u as __namedExportsOrder,o as default};