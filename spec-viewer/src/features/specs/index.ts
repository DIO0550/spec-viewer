export { MarkdownViewer } from "@/features/specs/components/MarkdownViewer";
export { SpecTabs } from "@/features/specs/components/SpecTabs";
export { SpecTree } from "@/features/specs/components/SpecTree";
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
  SpecFileKey,
  SpecFileScope,
  SpecNode,
  SpecTree as SpecTreeData,
} from "@/features/specs/types/spec";
export { useSpecFileWatcher } from "./hooks/useSpecFileWatcher";
