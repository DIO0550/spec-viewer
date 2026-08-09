import{n as e}from"./chunk-DnJy8xQt.js";import{t}from"./jsx-runtime-BX9360Lk.js";import{n,t as r}from"./RevisionSelector-DUuv3_LB.js";var i,a,o,s,c,l,u,d,f,p,m,h,g,_,v,y;e((()=>{n(),i=t(),a=`a`.repeat(40),o={kind:`localBranch`,name:`refs/heads/feature/revision`},s={kind:`tag`,name:`refs/tags/v1.0.0`},c={kind:`commit`,sha:a},l=[{id:`head`,revision:{kind:`head`},label:`HEAD`,resolvedCommitSha:a},{id:`localBranch:${o.name}`,revision:o,label:`feature/revision`,resolvedCommitSha:a},{id:`tag:${s.name}`,revision:s,label:`v1.0.0`,resolvedCommitSha:a}],u={title:`Features/Diff/RevisionSelector`,component:r,args:{value:{kind:`head`},options:l,history:{items:[{sha:a,committedAt:`2026-08-04T00:00:00Z`,message:`Add revision selector`}],truncated:!1},optionsStatus:`ready`,historyStatus:`ready`,isComparing:!1,errorMessage:null,onChange:()=>void 0,onRetryOptions:()=>void 0,onRetryHistory:()=>void 0},decorators:[e=>(0,i.jsx)(`div`,{style:{minHeight:520,padding:32},children:(0,i.jsx)(e,{})})]},d={},f={args:{value:o}},p={args:{value:s}},m={args:{value:c}},h={args:{optionsStatus:`loading`,historyStatus:`loading`}},g={args:{history:{items:[],truncated:!1}}},_={args:{optionsStatus:`failed`,historyStatus:`failed`,optionsErrorMessage:`ブランチとタグを取得できませんでした。`,historyErrorMessage:`ファイル履歴を取得できませんでした。`,errorMessage:`選択したリビジョンを解決できませんでした。`}},v={args:{options:[...l,{id:`localBranch:refs/heads/feature/a-very-long-revision-name-for-layout-verification`,revision:{kind:`localBranch`,name:`refs/heads/feature/a-very-long-revision-name-for-layout-verification`},label:`feature/a-very-long-revision-name-for-layout-verification`,resolvedCommitSha:a}],history:{items:[{sha:a,committedAt:`2026-08-04T00:00:00Z`,message:`A deliberately long commit subject that verifies wrapping without overflowing the selector`}],truncated:!0}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    value: branch
  }
}`,...f.parameters?.docs?.source}}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    value: tag
  }
}`,...p.parameters?.docs?.source}}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    value: commit
  }
}`,...m.parameters?.docs?.source}}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    optionsStatus: "loading",
    historyStatus: "loading"
  }
}`,...h.parameters?.docs?.source}}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    history: {
      items: [],
      truncated: false
    }
  }
}`,...g.parameters?.docs?.source}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
  args: {
    optionsStatus: "failed",
    historyStatus: "failed",
    optionsErrorMessage: "ブランチとタグを取得できませんでした。",
    historyErrorMessage: "ファイル履歴を取得できませんでした。",
    errorMessage: "選択したリビジョンを解決できませんでした。"
  }
}`,..._.parameters?.docs?.source}}},v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    options: [...options, {
      id: "localBranch:refs/heads/feature/a-very-long-revision-name-for-layout-verification",
      revision: {
        kind: "localBranch",
        name: "refs/heads/feature/a-very-long-revision-name-for-layout-verification"
      },
      label: "feature/a-very-long-revision-name-for-layout-verification",
      resolvedCommitSha: sha
    }],
    history: {
      items: [{
        sha,
        committedAt: "2026-08-04T00:00:00Z",
        message: "A deliberately long commit subject that verifies wrapping without overflowing the selector"
      }],
      truncated: true
    }
  }
}`,...v.parameters?.docs?.source}}},y=[`DefaultHead`,`BranchSelected`,`TagSelected`,`CommitSelected`,`Loading`,`EmptyHistory`,`Failed`,`LongMessages`]}))();export{f as BranchSelected,m as CommitSelected,d as DefaultHead,g as EmptyHistory,_ as Failed,h as Loading,v as LongMessages,p as TagSelected,y as __namedExportsOrder,u as default};