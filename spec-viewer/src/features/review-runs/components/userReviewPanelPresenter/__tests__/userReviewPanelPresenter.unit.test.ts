import { expect, test } from "vitest";

import {
  formatCreateSuccessMessage,
  formatUserReviewRecordProblem,
  formatUserReviewSummary,
} from "@/features/review-runs/components/userReviewPanelPresenter";
import type { UserReview } from "@/features/review-runs/domain/userReview";
import type { UserReviewRecordProblemKind } from "@/features/review-runs/domain/userReviewRecordProblem";

const activeReview: UserReview = {
  schemaVersion: "spec-reviewer.user-review.v1",
  id: "urv_0123456789abcdef0123456789abcdef",
  status: "active",
  target: {
    scope: "file",
    specId: "auth",
    fileKey: "tasks",
  },
  recordLocator: "urv_0123456789abcdef0123456789abcdef.json",
  commentCount: 2,
  createdAt: "2026-07-12T10:00:00Z",
  updatedAt: "2026-07-12T10:00:00Z",
  archivedAt: null,
};

test("presenterはstatus labelとsingle-JSON locatorを含むfeedbackを生成する", () => {
  expect(formatUserReviewSummary(activeReview)).toBe("受付中 / コメント 2件");
  expect(formatCreateSuccessMessage(activeReview)).toBe(
    "レビューを作成しました。2件 / urv_0123456789abcdef0123456789abcdef.json",
  );
});

test.each<{
  kind: UserReviewRecordProblemKind;
  label: string;
  description: string;
}>([
  {
    kind: "legacyRecord",
    label: "旧形式のレビュー",
    description: "フォルダ形式のレビューは一覧に表示できません。",
  },
  {
    kind: "unsupportedRecordVersion",
    label: "未対応のバージョン",
    description: "このレビューは新しいバージョンで作成されています。",
  },
  {
    kind: "malformedRecord",
    label: "壊れたレビュー",
    description: "レビューJSONの内容を読み取れませんでした。",
  },
  {
    kind: "recoverableDuplicate",
    label: "重複レコードを復旧",
    description: "同じレビューの重複から有効なレコードを使用しました。",
  },
  {
    kind: "conflictingCopies",
    label: "競合するレコード",
    description: "同じレビューIDを持つ異なるレコードがあります。",
  },
])("$kindを日本語labelとdescriptionへ変換する", ({
  kind,
  label,
  description,
}) => {
  expect(formatUserReviewRecordProblem(kind)).toEqual({
    label,
    description,
  });
});
