export { getUnknownErrorMessage } from "./errorMessage";
export {
  createWorkspaceDisplayName,
  dedupeRecentWorkspaces,
  normalizeRecentWorkspace,
  normalizeWorkspacePath,
  parseRecentWorkspaces,
  recentWorkspaceLimit,
  recordRecentWorkspace,
  removeRecentWorkspace,
  type RecentWorkspace,
} from "./recentWorkspaces";
export {
  thirdPartyLicenses,
  type ThirdPartyLicense,
} from "./thirdPartyLicenses";
export { uiText } from "./uiText";
export {
  createWorkspaceDropCandidate,
  extractBrowserDropPaths,
  type WorkspaceDropCandidate,
} from "./workspaceDrop";
