import{n as e}from"./chunk-DnJy8xQt.js";import{t}from"./jsx-runtime-BpX3lQ6F.js";import{i as n,n as r,r as i,t as a}from"./specTreeState-BNzaCzl5.js";function o(e){let t=e.files??[],n=e.children??[],r=e.kind??`spec`,i=n.reduce((e,t)=>e+ +(t.kind===`spec`)+t.descendantSpecCount,0);return{id:e.id,label:e.label,kind:r,sourceGroupId:e.sourceGroupId??`primary`,relativeId:e.relativeId??e.id,presentDocumentCount:e.presentDocumentCount??t.filter(e=>e.status===`present`).length,descendantSpecCount:e.descendantSpecCount??i,files:t,children:n}}var s=e((()=>{})),c,l,u,d,f,p,m,h,g,_,v,y,b,x,S,C,w,T,E,D,O,k,A,j,M,N;e((()=>{r(),s(),n(),c=t(),{expect:l,fn:u,userEvent:d,within:f}=__STORYBOOK_MODULE_TEST__,p=`/workspace/spec-reviewer`,m=o({id:`primary/074-issue-193`,label:`074-issue-193`,sourceGroupId:`primary`,relativeId:`074-issue-193`,presentDocumentCount:3}),h={status:`ready`,workspacePath:p,tree:{specs:[m,o({id:`primary/.archive`,label:`Archive`,kind:`archive`,sourceGroupId:`primary`,relativeId:`.archive`,descendantSpecCount:1,children:[o({id:`primary/.archive/074-issue-193`,label:`074-issue-193`,sourceGroupId:`primary`,relativeId:`.archive/074-issue-193`,presentDocumentCount:2})]}),o({id:`secondary`,label:`feature-auth (.plugin-worktree)`,kind:`sourceGroup`,sourceGroupId:`secondary`,relativeId:`.`,descendantSpecCount:1,children:[o({id:`secondary/021-issue-262`,label:`021-issue-262`,sourceGroupId:`secondary`,relativeId:`021-issue-262`,presentDocumentCount:1})]})]},error:null},g={feature:`specs`,code:`specTreeScan`,message:`The spec tree could not be scanned.`,cause:{command:`list_specs`,code:`specTreeScan`,message:`The spec tree could not be scanned.`,raw:`story fixture`}},_={feature:`specs`,code:`specArchive`,message:`The spec could not be archived.`,cause:{command:`archive_spec`,code:`specArchive`,message:`The spec could not be archived.`,raw:`story fixture`}},v={archivedSpecId:m.id,archivePath:`/workspace/spec-reviewer/.plugin-workspace/.specs/.archive/074-issue-193`,sourceGroupId:`primary`,destinationNodeId:`.archive/074-issue-193`},y={component:i,decorators:[e=>(0,c.jsx)(`div`,{style:{minHeight:480,width:320},children:(0,c.jsx)(e,{})})],args:{state:h,selectedSpecId:m.id,archivingSpecId:null,archiveFailure:null,archiveReveal:null,isLoading:!1,onSelectSpec:u(),onArchiveSpec:u(),onRetryArchive:u(),onRefreshArchiveReveal:u(),onReload:u()},argTypes:{state:{control:!1},archiveFailure:{control:!1},archiveReveal:{control:!1},onSelectSpec:{control:!1},onArchiveSpec:{control:!1},onRetryArchive:{control:!1},onRefreshArchiveReveal:{control:!1},onReload:{control:!1}}},b={play:async({args:e,canvasElement:t})=>{let n=f(t);await l(n.getByRole(`tree`)).toBeInTheDocument(),await l(n.queryByText(`073-issue-192`)).not.toBeInTheDocument(),await d.click(n.getByLabelText(`Archiveを展開`)),await l(n.getByText(`073-issue-192`)).toBeInTheDocument();let r=n.getByRole(`treeitem`,{name:/074-issue-193/});r.focus(),await d.hover(r),await d.click(n.getByLabelText(`074-issue-193をアーカイブへ移動`)),await l(e.onArchiveSpec).toHaveBeenCalledWith(m.id),r.focus(),await d.keyboard(`{ArrowDown}{Home}{End}`),await l(n.getByRole(`treeitem`,{name:/feature-auth/})).toHaveFocus()}},x={args:{archivingSpecId:m.id,isLoading:!0}},S={args:{selectedSpecId:null,archiveReveal:{status:`success`,workspacePath:p,response:v}}},C={args:{archiveFailure:{specId:m.id,error:_}},play:async({args:e,canvasElement:t})=>{let n=f(t);await l(n.getByRole(`alert`)).toHaveTextContent(`The spec could not be archived.`),await d.click(n.getByRole(`button`,{name:`アーカイブを再試行`})),await l(e.onRetryArchive).toHaveBeenCalledOnce()}},w={args:{archiveReveal:{status:`missing`,workspacePath:p,response:{...v,destinationNodeId:`.archive/missing`}}}},T={args:{state:a.loading(p),selectedSpecId:null}},E={args:{state:a.failed(p,g),selectedSpecId:null}},D={args:{state:a.loaded(p,{specs:[]}),selectedSpecId:null}},O={args:{state:a.loaded(p,{specs:Array.from({length:36},(e,t)=>o({id:`primary/`+String(t).padStart(3,`0`)+`-long-spec-name`,label:String(t).padStart(3,`0`)+`-a-very-long-specification-label-for-overflow-verification`,sourceGroupId:`primary`,relativeId:String(t).padStart(3,`0`)+`-long-spec-name`,presentDocumentCount:t%4}))}),selectedSpecId:null}},k={args:{state:a.idle(),selectedSpecId:null,onArchiveSpec:void 0}},A={render:e=>(0,c.jsx)(i,{...e,changeBadgesBySpecId:new Map([[m.id,`M`]])})},j={render:e=>(0,c.jsx)(i,{...e,changeBadgesBySpecId:new Map([[m.id,`U`]])})},M={render:e=>(0,c.jsx)(i,{...e,changeBadgesBySpecId:new Map})},b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  /**
   * Expands the archive, triggers archiving, and verifies roving focus reaches the last item.
   * @param context - Story play context, including test args and the rendered canvas element.
   */
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("tree")).toBeInTheDocument();
    await expect(canvas.queryByText("073-issue-192")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByLabelText("Archiveを展開"));
    await expect(canvas.getByText("073-issue-192")).toBeInTheDocument();
    const active = canvas.getByRole("treeitem", {
      name: /074-issue-193/
    });
    active.focus();
    await userEvent.hover(active);
    await userEvent.click(canvas.getByLabelText("074-issue-193をアーカイブへ移動"));
    await expect(args.onArchiveSpec).toHaveBeenCalledWith(activeSpec.id);
    active.focus();
    await userEvent.keyboard("{ArrowDown}{Home}{End}");
    await expect(canvas.getByRole("treeitem", {
      name: /feature-auth/
    })).toHaveFocus();
  }
}`,...b.parameters?.docs?.source}}},x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  args: {
    archivingSpecId: activeSpec.id,
    isLoading: true
  }
}`,...x.parameters?.docs?.source}}},S.parameters={...S.parameters,docs:{...S.parameters?.docs,source:{originalSource:`{
  args: {
    selectedSpecId: null,
    archiveReveal: {
      status: "success",
      workspacePath,
      response: archiveResponse
    }
  }
}`,...S.parameters?.docs?.source}}},C.parameters={...C.parameters,docs:{...C.parameters?.docs,source:{originalSource:`{
  args: {
    archiveFailure: {
      specId: activeSpec.id,
      error: archiveError
    }
  },
  /**
   * Verifies the archive failure banner renders and the retry button triggers the handler.
   * @param context - Story play context, including test args and the rendered canvas element.
   */
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("alert")).toHaveTextContent("The spec could not be archived.");
    await userEvent.click(canvas.getByRole("button", {
      name: "アーカイブを再試行"
    }));
    await expect(args.onRetryArchive).toHaveBeenCalledOnce();
  }
}`,...C.parameters?.docs?.source}}},w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  args: {
    archiveReveal: {
      status: "missing",
      workspacePath,
      response: {
        ...archiveResponse,
        destinationNodeId: ".archive/missing"
      }
    }
  }
}`,...w.parameters?.docs?.source}}},T.parameters={...T.parameters,docs:{...T.parameters?.docs,source:{originalSource:`{
  args: {
    state: SpecTreeState.loading(workspacePath),
    selectedSpecId: null
  }
}`,...T.parameters?.docs?.source}}},E.parameters={...E.parameters,docs:{...E.parameters?.docs,source:{originalSource:`{
  args: {
    state: SpecTreeState.failed(workspacePath, treeError),
    selectedSpecId: null
  }
}`,...E.parameters?.docs?.source}}},D.parameters={...D.parameters,docs:{...D.parameters?.docs,source:{originalSource:`{
  args: {
    state: SpecTreeState.loaded(workspacePath, {
      specs: []
    }),
    selectedSpecId: null
  }
}`,...D.parameters?.docs?.source}}},O.parameters={...O.parameters,docs:{...O.parameters?.docs,source:{originalSource:`{
  args: {
    state: SpecTreeState.loaded(workspacePath, {
      specs: Array.from({
        length: 36
      }, (_, index) => createSpecNodeFixture({
        id: "primary/" + String(index).padStart(3, "0") + "-long-spec-name",
        label: String(index).padStart(3, "0") + "-a-very-long-specification-label-for-overflow-verification",
        sourceGroupId: "primary",
        relativeId: String(index).padStart(3, "0") + "-long-spec-name",
        presentDocumentCount: index % 4
      }))
    }),
    selectedSpecId: null
  }
}`,...O.parameters?.docs?.source}}},k.parameters={...k.parameters,docs:{...k.parameters?.docs,source:{originalSource:`{
  args: {
    state: SpecTreeState.idle(),
    selectedSpecId: null,
    onArchiveSpec: undefined
  }
}`,...k.parameters?.docs?.source}}},A.parameters={...A.parameters,docs:{...A.parameters?.docs,source:{originalSource:`{
  /**
   * Renders the tree with a "modified" change badge on the active spec.
   * @param args - The story's resolved component args.
   */
  render: args => <SpecTree {...args} changeBadgesBySpecId={new Map([[activeSpec.id, "M"]])} />
}`,...A.parameters?.docs?.source}}},j.parameters={...j.parameters,docs:{...j.parameters?.docs,source:{originalSource:`{
  /**
   * Renders the tree with an "untracked" change badge on the active spec.
   * @param args - The story's resolved component args.
   */
  render: args => <SpecTree {...args} changeBadgesBySpecId={new Map([[activeSpec.id, "U"]])} />
}`,...j.parameters?.docs?.source}}},M.parameters={...M.parameters,docs:{...M.parameters?.docs,source:{originalSource:`{
  /**
   * Renders the tree with no change badges applied.
   * @param args - The story's resolved component args.
   */
  render: args => <SpecTree {...args} changeBadgesBySpecId={new Map()} />
}`,...M.parameters?.docs?.source}}},N=[`Hierarchy`,`Processing`,`SuccessReveal`,`FailureRetry`,`RevealMissing`,`Loading`,`Error`,`Empty`,`LongList`,`EdgeCases`,`Modified`,`UntrackedPriority`,`NoChanges`]}))();export{k as EdgeCases,D as Empty,E as Error,C as FailureRetry,b as Hierarchy,T as Loading,O as LongList,A as Modified,M as NoChanges,x as Processing,w as RevealMissing,S as SuccessReveal,j as UntrackedPriority,N as __namedExportsOrder,y as default};