import { expect, test } from "vitest";

import contracts from "../../../../../src-tauri/tests/fixtures/identity-value-object-contracts.json";
import { CommentId } from "@/shared/domain/commentId";

test.each(
  contracts.commentId.issued,
)("CommentId.parseは新規発行形式%sを受理する", (raw) => {
  expect(CommentId.parse(raw)).toEqual({ ok: true, value: raw });
});

test.each(
  contracts.commentId.legacy,
)("CommentId.fromDtoはlegacy ID %sを復元する", (raw) => {
  expect(CommentId.parse(raw)).toMatchObject({ ok: false });
  expect(CommentId.fromDto(raw)).toMatchObject({ ok: true });
});

test.each(
  contracts.commentId.invalidIssued,
)("CommentId.parseは不正な新規発行値%jを拒否する", (raw) => {
  expect(CommentId.parse(raw)).toMatchObject({ ok: false });
});

test.each(
  contracts.commentId.invalidRestore,
)("CommentId.fromDtoは復元不能な%jを拒否する", (raw) => {
  expect(CommentId.fromDto(raw)).toMatchObject({ ok: false });
});
