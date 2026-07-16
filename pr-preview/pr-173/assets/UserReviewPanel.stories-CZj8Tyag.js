import{n as e}from"./chunk-DnJy8xQt.js";import{n as t,t as n}from"./comment-CE6my9eH.js";import{n as r,t as i}from"./UserReviewPanel-UsyjF1R9.js";var a,o,s,c,l,u,d,f,p;e((()=>{t(),r(),{fn:a}=__STORYBOOK_MODULE_TEST__,o={component:i,args:{targetScope:`file`,workspaceMode:`currentWorkspace`,openCommentCount:2,listState:{status:`ready`,target:{scope:`file`,specId:`auth`,fileKey:`tasks`},active:[{id:`2026-05-06T120000Z-file-tasks-abcdef12`,status:`active`,target:{scope:`file`,specId:`auth`,fileKey:`tasks`},workspace:{mode:`currentWorkspace`,workspacePath:`/workspace/spec-reviewer`},specFolderPath:`/workspace/spec-reviewer/.plugin-workspace/.specs/auth`,folderPath:`/workspace/spec-reviewer/.plugin-workspace/.specs/auth/user-review/active/2026-05-06T120000Z-file-tasks-abcdef12`,sourceFiles:[{specId:`auth`,fileKey:`tasks`,relativePath:`.plugin-workspace/.specs/auth/tasks.md`}],commentCount:2,createdAt:`2026-05-06T12:00:00Z`,archivedAt:null,summary:null,warnings:[]}],archived:[],problems:[],error:null},createState:{status:`idle`},archiveState:{status:`idle`},onTargetScopeChange:a(),onWorkspaceModeChange:a(),onCreateUserReview:a(),onArchiveUserReview:a(),onRefreshUserReviews:a(),onCopyPath:a(async()=>void 0)},argTypes:{onTargetScopeChange:{control:!1},onWorkspaceModeChange:{control:!1},onCreateUserReview:{control:!1},onArchiveUserReview:{control:!1},onRefreshUserReviews:{control:!1},onCopyPath:{control:!1}}},s={},c={args:{openCommentCount:0,listState:{status:`empty`,target:{scope:`file`,specId:`auth`,fileKey:`tasks`},active:[],archived:[],problems:[],error:null}}},l={args:{createState:{status:`error`,payload:{commentIds:[],workspaceMode:`currentWorkspace`},error:{code:`userReviewExport`,message:`source files have uncommitted changes`,raw:{}}}}},u={args:{listState:{status:`loading`,target:{scope:`file`,specId:`auth`,fileKey:`tasks`},active:[],archived:[],problems:[],error:null}}},d={args:{createState:{status:`saving`,payload:{commentIds:[n.fromString(`cmt_1`)],workspaceMode:`currentWorkspace`}}}},f={args:{listState:{status:`ready`,target:{scope:`file`,specId:`auth`,fileKey:`tasks`},active:[{id:`2026-05-06T120000Z-file-tasks-abcdef12`,status:`completed`,target:{scope:`file`,specId:`auth`,fileKey:`tasks`},workspace:{mode:`currentWorkspace`,workspacePath:`/workspace/spec-reviewer`},specFolderPath:`/workspace/spec-reviewer/.plugin-workspace/.specs/auth`,folderPath:`/workspace/spec-reviewer/.plugin-workspace/.specs/auth/user-review/active/2026-05-06T120000Z-file-tasks-abcdef12`,sourceFiles:[{specId:`auth`,fileKey:`tasks`,relativePath:`.plugin-workspace/.specs/auth/tasks.md`}],commentCount:2,createdAt:`2026-05-06T12:00:00Z`,archivedAt:null,summary:`対応完了`,warnings:[]}],archived:[],problems:[],error:null},archiveState:{status:`saving`,payload:{userReviewId:`2026-05-06T120000Z-file-tasks-abcdef12`}}}},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    openCommentCount: 0,
    listState: {
      status: "empty",
      target: {
        scope: "file",
        specId: "auth",
        fileKey: "tasks"
      },
      active: [],
      archived: [],
      problems: [],
      error: null
    }
  }
}`,...c.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    createState: {
      status: "error",
      payload: {
        commentIds: [],
        workspaceMode: "currentWorkspace"
      },
      error: {
        code: "userReviewExport",
        message: "source files have uncommitted changes",
        raw: {}
      }
    }
  }
}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    listState: {
      status: "loading",
      target: {
        scope: "file",
        specId: "auth",
        fileKey: "tasks"
      },
      active: [],
      archived: [],
      problems: [],
      error: null
    }
  }
}`,...u.parameters?.docs?.source}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    createState: {
      status: "saving",
      payload: {
        commentIds: [CommentId.fromString("cmt_1")],
        workspaceMode: "currentWorkspace"
      }
    }
  }
}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    listState: {
      status: "ready",
      target: {
        scope: "file",
        specId: "auth",
        fileKey: "tasks"
      },
      active: [{
        id: "2026-05-06T120000Z-file-tasks-abcdef12",
        status: "completed",
        target: {
          scope: "file",
          specId: "auth",
          fileKey: "tasks"
        },
        workspace: {
          mode: "currentWorkspace",
          workspacePath: "/workspace/spec-reviewer"
        },
        specFolderPath: "/workspace/spec-reviewer/.plugin-workspace/.specs/auth",
        folderPath: "/workspace/spec-reviewer/.plugin-workspace/.specs/auth/user-review/active/2026-05-06T120000Z-file-tasks-abcdef12",
        sourceFiles: [{
          specId: "auth",
          fileKey: "tasks",
          relativePath: ".plugin-workspace/.specs/auth/tasks.md"
        }],
        commentCount: 2,
        createdAt: "2026-05-06T12:00:00Z",
        archivedAt: null,
        summary: "対応完了",
        warnings: []
      }],
      archived: [],
      problems: [],
      error: null
    },
    archiveState: {
      status: "saving",
      payload: {
        userReviewId: "2026-05-06T120000Z-file-tasks-abcdef12"
      }
    }
  }
}`,...f.parameters?.docs?.source}}},p=[`Default`,`Empty`,`Error`,`Loading`,`Creating`,`Archiving`]}))();export{f as Archiving,d as Creating,s as Default,c as Empty,l as Error,u as Loading,p as __namedExportsOrder,o as default};