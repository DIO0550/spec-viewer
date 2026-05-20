export type CommentStatus = "open" | "resolved";

const commentStatusFilterValues = ["all", "open", "resolved"] as const;

export type CommentStatusFilter = (typeof commentStatusFilterValues)[number];

export const CommentStatusFilter = {
  All: "all",
  Open: "open",
  Resolved: "resolved",
  values: commentStatusFilterValues,
  /**
   * 入力値をコメントステータスフィルタへ変換する。
   *
   * @param value - 外部境界または UI 状態から渡される入力値
   * @returns 有効なフィルタ。不正値の場合は null
   */
  parse(value: unknown): CommentStatusFilter | null {
    if (value === null || value === undefined) {
      return CommentStatusFilter.All;
    }

    if (!CommentStatusFilter.is(value)) {
      return null;
    }

    return value;
  },
  /**
   * 入力値がコメントステータスフィルタか判定する。
   *
   * @param value - 判定対象
   * @returns コメントステータスフィルタの場合 true
   */
  is(value: unknown): value is CommentStatusFilter {
    switch (value) {
      case "all":
      case "open":
      case "resolved":
        return true;
      default:
        return false;
    }
  },
  /**
   * コメントステータスフィルタを IPC 互換の文字列へ変換する。
   *
   * @param filter - コメントステータスフィルタ
   * @returns IPC payload と同じ文字列
   */
  toString(filter: CommentStatusFilter): CommentStatusFilter {
    return filter;
  },
  /**
   * コメントのステータスがフィルタ条件に一致するか判定する。
   *
   * @param filter - コメントステータスフィルタ
   * @param status - コメントステータス
   * @returns 表示対象の場合 true
   */
  matches(filter: CommentStatusFilter, status: CommentStatus): boolean {
    if (filter === "all") {
      return true;
    }

    return status === filter;
  },
} as const;
