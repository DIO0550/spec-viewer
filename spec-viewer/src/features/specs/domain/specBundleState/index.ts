import type { SpecFeatureError } from "@/features/specs/domain/specError";
import type { SpecBundle } from "@/features/specs/types/spec";

export type SpecBundleState =
  | Readonly<{ status: "idle"; bundle: null; error: null }>
  | Readonly<{ status: "loading"; bundle: SpecBundle | null; error: null }>
  | Readonly<{ status: "ready"; bundle: SpecBundle; error: null }>
  | Readonly<{ status: "partialError"; bundle: SpecBundle; error: null }>
  | Readonly<{ status: "empty"; bundle: SpecBundle; error: null }>
  | Readonly<{ status: "error"; bundle: null; error: SpecFeatureError }>;

export const SpecBundleState = {
  idle: (): SpecBundleState => ({ status: "idle", bundle: null, error: null }),
  loading: (bundle: SpecBundle | null = null): SpecBundleState => ({
    status: "loading",
    bundle,
    error: null,
  }),
  loaded(bundle: SpecBundle): SpecBundleState {
    if (bundle.artifacts.length === 0) {
      return { status: "empty", bundle, error: null };
    }

    if (bundle.artifacts.some((artifact) => artifact.error !== null)) {
      return { status: "partialError", bundle, error: null };
    }

    return { status: "ready", bundle, error: null };
  },
  failed: (error: SpecFeatureError): SpecBundleState => ({
    status: "error",
    bundle: null,
    error,
  }),
} as const;
