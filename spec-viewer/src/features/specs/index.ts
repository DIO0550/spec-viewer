export { SpecArtifactTabs } from "@/features/specs/components/SpecArtifactTabs";
export {
  SpecArtifactViewer,
  type SpecArtifactViewerProps,
} from "@/features/specs/components/SpecArtifactViewer";
export {
  MarkdownViewer,
  type MarkdownViewerProps,
} from "@/features/specs/components/MarkdownViewer";
export {
  createRenderedBlockKey,
  readRenderedBlockModel,
  type RenderedBlockModel,
  type RenderedBlockProjection,
  type RenderedBlockType,
  type RenderedDocumentPort,
  type RenderedTextDecoration,
} from "@/features/specs/components/MarkdownViewer/renderedDocument";
export { SpecBundleState } from "@/features/specs/domain/specBundleState";
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
  SpecArtifact,
  SpecBundle,
  SpecDocument,
  SpecFile,
  SpecFileKey,
  SpecFileScope,
  SpecNode,
  SpecTree as SpecTreeData,
} from "@/features/specs/types/spec";
export { useSpecFileWatcher } from "./hooks/useSpecFileWatcher";
