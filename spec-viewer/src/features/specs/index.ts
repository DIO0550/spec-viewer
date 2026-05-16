export { MarkdownViewer } from "@/features/specs/components/MarkdownViewer";
export { SpecTabs } from "@/features/specs/components/SpecTabs";
export { SpecTree } from "@/features/specs/components/SpecTree";
export { useSpecFileWatcher } from "./hooks/useSpecFileWatcher";
export {
  useSpecs,
  type SpecDocumentState,
  type SpecTreeState,
} from "@/features/specs/hooks/useSpecs";
export type {
  MarkdownBlockMetadata,
  MarkdownBlockType,
  SpecDocument,
  SpecFile,
  SpecFileKey,
  SpecNode,
  SpecTree as SpecTreeData,
} from "@/features/specs/types/spec";
