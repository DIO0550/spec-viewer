import{n as e}from"./chunk-DnJy8xQt.js";import{t}from"./jsx-runtime-TRoWuN2H.js";import{n,t as r}from"./CommentPopover-DG8jarvh.js";var i,a,o,s,c,l,u;e((()=>{n(),i=t(),{fn:a}=__STORYBOOK_MODULE_TEST__,o={component:r,decorators:[e=>(0,i.jsx)(`div`,{style:{minHeight:240,padding:24,position:`relative`},children:(0,i.jsx)(e,{})})],args:{children:(0,i.jsxs)(`div`,{style:{display:`grid`,gap:8},children:[(0,i.jsx)(`strong`,{children:`Comment details`}),(0,i.jsx)(`p`,{style:{margin:0},children:`Review notes stay close to the selected text.`}),(0,i.jsx)(`button`,{type:`button`,children:`Close`})]}),className:`comment-popover`,onClose:a()},argTypes:{children:{control:!1},onClose:{control:!1}}},s={},c={args:{id:`comment-popover-example`,"aria-label":`Comment actions`,isDismissDisabled:!0,children:(0,i.jsxs)(`div`,{style:{display:`grid`,gap:8},children:[(0,i.jsx)(`strong`,{children:`Dismissal disabled`}),(0,i.jsx)(`p`,{style:{margin:0},children:`The parent keeps this popover open while saving.`})]})}},l={args:{children:(0,i.jsx)(`span`,{children:`Short content`})}},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    id: "comment-popover-example",
    "aria-label": "Comment actions",
    isDismissDisabled: true,
    /** Body shown while dismissal is disabled, e.g. during a save. */
    children: <div style={{
      display: "grid",
      gap: 8
    }}>
        <strong>Dismissal disabled</strong>
        <p style={{
        margin: 0
      }}>
          The parent keeps this popover open while saving.
        </p>
      </div>
  }
}`,...c.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    children: <span>Short content</span>
  }
}`,...l.parameters?.docs?.source}}},u=[`Default`,`AllProps`,`EdgeCases`]}))();export{c as AllProps,s as Default,l as EdgeCases,u as __namedExportsOrder,o as default};