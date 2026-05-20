export type CommentStatus = "open" | "resolved";

const commentStatusFilterValues = ["all", "open", "resolved"] as const;

export type CommentStatusFilter = (typeof commentStatusFilterValues)[number];

/**
 * 入力値をコメントステータスフィルタへ変換する。
 *
 * @param value - 外部境界または UI 状態から渡される入力値
 * @returns 有効なフィルタ。不正値の場合は null
 */
function parseCommentStatusFilter(
  value: unknown,
): CommentStatusFilter | null {
  if (value === null || value === undefined) {
    return CommentStatusFilter.All;
  }

  if (!isCommentStatusFilter(value)) {
    return null;
  }

  return value;
}

/**
 * 入力値がコメントステータスフィルタか判定する。
 *
 * @param value - 判定対象
 * @returns コメントステータスフィルタの場合 true
 */
function isCommentStatusFilter(value: unknown): value is CommentStatusFilter {
  switch (value) {
    case "all":
    case "open":
    case "resolved":
      return true;
    default:
      return false;
  }
}

/**
 * コメントステータスフィルタを IPC 互換の文字列へ変換する。
 *
 * @param filter - コメントステータスフィルタ
 * @returns IPC payload と同じ文字列
 */
function stringifyCommentStatusFilter(
  filter: CommentStatusFilter,
): CommentStatusFilter {
  return filter;
}

/**
 * コメントのステータスがフィルタ条件に一致するか判定する。
 *
 * @param filter - コメントステータスフィルタ
 * @param status - コメントステータス
 * @returns 表示対象の場合 true
 */
function matchesCommentStatusFilter(
  filter: CommentStatusFilter,
  status: CommentStatus,
): boolean {
  if (filter === "all") {
    return true;
  }

  return status === filter;
}

export const CommentStatusFilter = {
  All: "all",
  Open: "open",
  Resolved: "resolved",
  values: commentStatusFilterValues,
  parse: parseCommentStatusFilter,
  is: isCommentStatusFilter,
  toString: stringifyCommentStatusFilter,
  matches: matchesCommentStatusFilter,
} as const;
