import type { SpecFileKey } from "@/features/specs";
import type { SpecId } from "@/shared/domain/specId";

/**
 * 現在の選択の同一性を表す3値（既存のリセット effect と同一のキー）。
 * 選択変更リセットの deps・export/refresh のスコープガードの両方に使う。
 *
 * 参照安定性の方針: resetKeys オブジェクトは App で毎レンダー inline 生成してよい（useMemo 不要）。
 * 受け取る各フックは effect の deps にオブジェクトそのものではなく
 * `resetKeys.workspaceRoot, resetKeys.specId, resetKeys.fileKey` のプリミティブ3値を列挙するため、
 * オブジェクト参照の変化は effect 発火に影響しない（既存 effect の deps と等価）。
 *
 * deps の書き方（実装ガイド — 型システムでは強制できないため明示する）:
 *   ❌ useEffect(() => { ... }, [resetKeys]);  // オブジェクト参照が毎レンダー変わり多重発火する
 *   ✅ useEffect(() => { ... }, [resetKeys.workspaceRoot, resetKeys.specId, resetKeys.fileKey]);
 */
export type SpecViewResetKeys = Readonly<{
  workspaceRoot: string | null;
  specId: SpecId | null;
  fileKey: SpecFileKey | null;
}>;

export type NavigationDirection = "next" | "previous";
