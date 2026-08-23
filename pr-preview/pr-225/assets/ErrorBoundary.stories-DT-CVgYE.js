import{n as e}from"./chunk-DnJy8xQt.js";import{t}from"./jsx-runtime-B3THDwZN.js";import{n,t as r}from"./ErrorBoundary-BQmMxrtQ.js";function i(){throw new globalThis.Error(`Story child render failed`)}var a,o,s,c,l,u,d;e((()=>{n(),a=t(),o={component:r,decorators:[e=>(0,a.jsx)(`div`,{style:{minHeight:320},children:(0,a.jsx)(e,{})})],args:{children:(0,a.jsx)(`p`,{children:`Child content rendered inside the boundary.`})},argTypes:{children:{control:!1},variant:{control:`inline-radio`,options:[`page`,`dialog`]}}},s={},c={args:{children:(0,a.jsx)(i,{})}},l={args:{children:(0,a.jsx)(i,{}),variant:`dialog`},decorators:[e=>(0,a.jsxs)(`div`,{className:`specs-workspace__viewer`,style:{minHeight:320,position:`relative`},children:[(0,a.jsx)(`button`,{type:`button`,children:`Diffへ切り替え`}),(0,a.jsx)(e,{})]})]},u={args:{children:(0,a.jsxs)(`div`,{children:[(0,a.jsx)(`h2`,{children:`Recoverable content`}),(0,a.jsx)(`p`,{children:`The boundary passes through nested children when there is no error.`})]})}},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    children: <ThrowingChild />
  }
}`,...c.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    children: <ThrowingChild />,
    variant: "dialog"
  },
  decorators: [Story => <div className="specs-workspace__viewer" style={{
    minHeight: 320,
    position: "relative"
  }}>
        <button type="button">Diffへ切り替え</button>
        <Story />
      </div>]
}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    /** Recoverable children rendered when ErrorBoundary catches no error. */
    children: <div>
        <h2>Recoverable content</h2>
        <p>
          The boundary passes through nested children when there is no error.
        </p>
      </div>
  }
}`,...u.parameters?.docs?.source}}},d=[`Default`,`Error`,`DialogError`,`EdgeCases`]}))();export{s as Default,l as DialogError,u as EdgeCases,c as Error,d as __namedExportsOrder,o as default};