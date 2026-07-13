import { expect, test } from "vitest";

import contracts from "../../../../../../src-tauri/tests/fixtures/identity-value-object-contracts.json";
import { UserReviewId } from "@/features/review-runs/domain/userReviewId";

test.each(
  contracts.userReviewId.issued,
)("UserReviewId.parseはv1発行形式%sを受理する", (raw) => {
  expect(UserReviewId.parse(raw)).toEqual({ ok: true, value: raw });
});

test.each(
  contracts.userReviewId.legacy,
)("UserReviewId.fromDtoはlegacy folder ID %sを復元する", (raw) => {
  expect(UserReviewId.parse(raw)).toMatchObject({ ok: false });
  expect(UserReviewId.fromDto(raw)).toMatchObject({ ok: true });
});

test.each(
  contracts.userReviewId.invalid,
)("UserReviewId.fromDtoは不正な%jを拒否する", (raw) => {
  expect(UserReviewId.fromDto(raw)).toMatchObject({ ok: false });
});
