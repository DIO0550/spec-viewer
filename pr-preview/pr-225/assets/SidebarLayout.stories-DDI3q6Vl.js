import{n as e}from"./chunk-DnJy8xQt.js";import{r as t,t as n}from"./preferences-DzvYtCfW.js";import{t as r}from"./jsx-runtime-BpX3lQ6F.js";import{n as i,t as a}from"./WorkspaceLayout-DV9LFMad.js";import{i as o,n as s,o as c,t as l}from"./SidebarLayout-BN9zD_Z1.js";var u,d,f,p,m,h,g;e((()=>{i(),n(),o(),s(),u=r(),{fn:d}=__STORYBOOK_MODULE_TEST__,f={component:l,parameters:{layout:`fullscreen`},decorators:[e=>(0,u.jsx)(t,{children:(0,u.jsx)(c,{children:(0,u.jsx)(e,{})})})],args:{children:(0,u.jsxs)(u.Fragment,{children:[(0,u.jsx)(a.Toolbar,{children:(0,u.jsx)(`div`,{style:{padding:12},children:`Toolbar content`})}),(0,u.jsx)(a.Worktrees,{children:(0,u.jsxs)(`nav`,{"aria-label":`Example navigation`,style:{padding:12},children:[(0,u.jsx)(`p`,{children:`Workspace`}),(0,u.jsx)(`button`,{type:`button`,children:`Tasks`})]})}),(0,u.jsx)(a.ModeNavigation,{children:(0,u.jsx)(`div`,{style:{padding:12},children:`Tabs`})}),(0,u.jsx)(a.Content,{children:(0,u.jsxs)(`div`,{style:{padding:24},children:[(0,u.jsx)(`h1`,{children:`Document preview`}),(0,u.jsx)(`p`,{children:`The sidebar-connected layout keeps the main review surface stable.`})]})}),(0,u.jsx)(a.Comments,{children:(0,u.jsxs)(`div`,{style:{padding:16},children:[(0,u.jsx)(`h2`,{children:`Comments`}),(0,u.jsx)(`p`,{children:`Right sidebar content.`})]})})]}),worktrees:{isOpen:!0,width:268,minWidth:216,maxWidth:420,onOpen:d(),onClose:d(),onWidthChange:d()}},argTypes:{children:{control:!1},worktrees:{control:!1}}},p={},m={args:{worktrees:{isOpen:!1,width:216,minWidth:216,maxWidth:420,onOpen:d(),onClose:d(),onWidthChange:d()}}},h={args:{children:(0,u.jsx)(a.Content,{children:(0,u.jsx)(`div`,{style:{padding:24},children:(0,u.jsx)(`p`,{children:`Minimal layout content`})})}),worktrees:{isOpen:!0,width:420,minWidth:216,maxWidth:420}}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{}`,...p.parameters?.docs?.source}}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    worktrees: {
      isOpen: false,
      width: 216,
      minWidth: 216,
      maxWidth: 420,
      onOpen: fn(),
      onClose: fn(),
      onWidthChange: fn()
    }
  }
}`,...m.parameters?.docs?.source}}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    /** Minimal single-region content to check the layout with sparse slots. */
    children: <WorkspaceLayout.Content>
        <div style={{
        padding: 24
      }}>
          <p>Minimal layout content</p>
        </div>
      </WorkspaceLayout.Content>,
    worktrees: {
      isOpen: true,
      width: 420,
      minWidth: 216,
      maxWidth: 420
    }
  }
}`,...h.parameters?.docs?.source}}},g=[`Default`,`AllProps`,`EdgeCases`]}))();export{m as AllProps,p as Default,h as EdgeCases,g as __namedExportsOrder,f as default};