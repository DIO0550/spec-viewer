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
  /**
   * Creates the initial state before any bundle load has been requested.
   * @returns A state with `status: "idle"` and no bundle or error.
   */
  idle: (): SpecBundleState => ({ status: "idle", bundle: null, error: null }),
  /**
   * Creates a loading state, optionally keeping the previously loaded bundle visible.
   * @param bundle - Previously loaded bundle to retain during the reload, or null when none.
   * @returns A state with `status: "loading"` carrying the given bundle.
   */
  loading: (bundle: SpecBundle | null = null): SpecBundleState => ({
    status: "loading",
    bundle,
    error: null,
  }),
  /**
   * Derives the settled state for a freshly loaded bundle based on its artifacts.
   * @param bundle - Bundle returned by the load operation.
   * @returns `status: "empty"` when the bundle has no artifacts, `status: "partialError"` when
   * any artifact failed to load, otherwise `status: "ready"`.
   */
  loaded(bundle: SpecBundle): SpecBundleState {
    if (bundle.artifacts.length === 0) {
      return { status: "empty", bundle, error: null };
    }

    if (bundle.artifacts.some((artifact) => artifact.error !== null)) {
      return { status: "partialError", bundle, error: null };
    }

    return { status: "ready", bundle, error: null };
  },
  /**
   * Creates a failed state when the bundle could not be loaded.
   * @param error - Normalized feature error describing the failure.
   * @returns A state with `status: "error"` and no bundle.
   */
  failed: (error: SpecFeatureError): SpecBundleState => ({
    status: "error",
    bundle: null,
    error,
  }),
} as const;
