import type { SpecError } from "@/features/specs/domain/specError";
import type { SpecDocumentState } from "@/features/specs/domain/specDocumentState";
import type { SpecTreeState } from "@/features/specs/domain/specTreeState";

export type SpecFeatureErrorCode =
  | "invalidSpec"
  | "specTreeScan"
  | "specArchive"
  | "markdownRead"
  | "invalidRequest"
  | "unknown";

export type SpecFeatureError = Readonly<{
  feature: "specs";
  code: SpecFeatureErrorCode;
  message: string;
  domainError: SpecError;
  cause: unknown;
}>;

export type SpecDocumentFeatureState = SpecDocumentState<SpecFeatureError>;
export type SpecTreeFeatureState = SpecTreeState<SpecFeatureError>;
