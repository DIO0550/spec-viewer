import{n as e}from"./chunk-DnJy8xQt.js";import{n as t,t as n}from"./WorktreeTree-BFjGjF6D.js";var r,i,a,o,s,c,l,u,d,f;e((()=>{t(),{expect:r,fn:i,userEvent:a,within:o}=__STORYBOOK_MODULE_TEST__,s={title:`Features/Workspace/WorktreeTree`,component:n,args:{nodes:[{kind:`category`,id:`category:agents`,label:`Agents`,children:[{kind:`worktree`,id:`agent-a`,label:`agent-a`,count:{kind:`spec-count`,value:2}},{kind:`worktree`,id:`agent-b`,label:`agent-b`,count:{kind:`spec-count`,value:0}}]}],selectedWorktreeId:`agent-a`,emptyLabel:`Worktree はありません`,onSelectWorktree:i()}},c={play:async({canvasElement:e})=>{await r(o(e).getByRole(`treeitem`,{name:/agent-a/})).toHaveAttribute(`aria-current`,`page`),await a.keyboard(`{End}{Enter}`)}},l={args:{nodes:[{kind:`worktree`,id:`agent-a`,label:`agent-a`,count:{kind:`changed-file-count`,value:4}}]}},u={args:{nodes:[],selectedWorktreeId:null}},d={args:{nodes:Array.from({length:40},(e,t)=>({kind:`worktree`,id:`worktree-${t}`,label:`very-long-worktree-name-${t}-for-overflow-check`,count:{kind:`changed-file-count`,value:t}})),selectedWorktreeId:`worktree-20`}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  /**
   * Confirms the selected worktree is marked current and that pressing
   * End then Enter selects the last visible row.
   *
   * @param context - Storybook play context providing the rendered canvas element.
   */
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const selected = canvas.getByRole("treeitem", {
      name: /agent-a/
    });
    await expect(selected).toHaveAttribute("aria-current", "page");
    await userEvent.keyboard("{End}{Enter}");
  }
}`,...c.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    nodes: [{
      kind: "worktree",
      id: "agent-a",
      label: "agent-a",
      count: {
        kind: "changed-file-count",
        value: 4
      }
    }]
  }
}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    nodes: [],
    selectedWorktreeId: null
  }
}`,...u.parameters?.docs?.source}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    nodes: Array.from({
      length: 40
    }, (_, index) => ({
      kind: "worktree" as const,
      id: \`worktree-\${index}\`,
      label: \`very-long-worktree-name-\${index}-for-overflow-check\`,
      count: {
        kind: "changed-file-count" as const,
        value: index
      }
    })),
    selectedWorktreeId: "worktree-20"
  }
}`,...d.parameters?.docs?.source}}},f=[`SpecsHierarchy`,`DiffFlat`,`Empty`,`LongAndMany`]}))();export{l as DiffFlat,u as Empty,d as LongAndMany,c as SpecsHierarchy,f as __namedExportsOrder,s as default};