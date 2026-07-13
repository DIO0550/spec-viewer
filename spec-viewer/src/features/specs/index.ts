export { MarkdownViewer } from "@/features/specs/components/MarkdownViewer";
export { toSpecFeatureError } from "@/features/specs/infra/tauri/specErrorMapper";
export { SpecTabs } from "@/features/specs/components/SpecTabs";
export { SpecTree } from "@/features/specs/components/SpecTree";
export { SpecFileCollection } from "@/features/specs/domain/specFileCollection";
export {
  type SpecDocumentState,
  type SpecSelectionChange,
  type SpecTreeState,
  type UseSpecsResult,
  useSpecs,
} from "@/features/specs/hooks/useSpecs";
export type {
  SpecSelectionState,
  SpecsActions,
  SpecsState,
} from "@/features/specs/hooks/useSpecs/types";
export type {
  MarkdownBlockMetadata,
  MarkdownBlockType,
  SpecDocument,
  SpecFile,
  SpecNodeCapabilities,
  SpecNodeKind,
  SpecFileKey,
  SpecNode,
  SpecTree as SpecTreeData,
} from "@/features/specs/types/spec";
export {
  type SpecFileWatchSubscriber,
  type StartSpecFileWatchCommand,
  type StopSpecFileWatchCommand,
  useSpecFileWatcher,
} from "./hooks/useSpecFileWatcher";
