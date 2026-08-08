import { expect, test } from "vitest";

import { InvalidDiffResponseError } from "@/lib/api/tauri/diffPayloadDecoder";
import { decodeSpecFileDiff } from "@/lib/api/tauri/specDiffDecoder";

import { createMinimalDetailResponse } from "./specDiffTestFixtures";

test.each([
  {
    name: "rootがrecordではない",
    createPayload: () => null,
    message: "response must be an object",
  },
  {
    name: "review.fileが欠落している",
    createPayload: () => {
      const payload = createMinimalDetailResponse();
      Reflect.deleteProperty(payload.review, "file");
      return payload;
    },
    message: "review.file must be an object",
  },
  {
    name: "changeが未知値である",
    createPayload: () => {
      const payload = createMinimalDetailResponse();
      payload.review.file.change = "moved";
      return payload;
    },
    message: "review.file.change must be one of",
  },
  {
    name: "line kindが未知値である",
    createPayload: () => {
      const payload = createMinimalDetailResponse();
      payload.review.structuredDiff.hunks = [
        { header: "@@ -1 +1 @@", lines: [{ kind: "moved", text: "line" }] },
      ];
      return payload;
    },
    message: "review.structuredDiff.hunks[0].lines[0].kind must be one of",
  },
  ...[-1, 50.5, 101].map((similarity) => ({
    name: `similarity=${similarity}`,
    createPayload: () => {
      const payload = createMinimalDetailResponse();
      payload.review.file.similarity = similarity;
      return payload;
    },
    message: "review.file.similarity must be",
  })),
  ...[-1, 0.5, Number.MAX_SAFE_INTEGER + 1].map((byteLength) => ({
    name: `byteLength=${byteLength}`,
    createPayload: () => {
      const payload = createMinimalDetailResponse();
      payload.review.oldContent.byteLength = byteLength;
      return payload;
    },
    message: "review.oldContent.byteLength must be",
  })),
  {
    name: "modeがnumberである",
    createPayload: () => {
      const payload = createMinimalDetailResponse();
      payload.review.file.newMode = 100644;
      return payload;
    },
    message: "review.file.newMode must be a string",
  },
  {
    name: "hunk headerのspaceが不正である",
    createPayload: () => {
      const payload = createMinimalDetailResponse();
      payload.review.structuredDiff.hunks = [
        { header: "@@ -1,2  +1,2 @@", lines: [] },
      ];
      return payload;
    },
    message:
      "review.structuredDiff.hunks[0].header must be a hunk header matching",
  },
  {
    name: "omitted diffにhunkがある",
    createPayload: () => {
      const payload = createMinimalDetailResponse();
      payload.review.structuredDiff = {
        state: "omitted",
        hunks: [{ header: "@@ -1 +1 @@", lines: [] }],
        reason: "diffLimit",
      };
      return payload;
    },
    message: "review.structuredDiff.hunks must be an empty array",
  },
])("decodeSpecFileDiffは不正payloadをinvalidResponseにする: $name", ({
  createPayload,
  message,
}) => {
  const payload = createPayload();

  expect(() => decodeSpecFileDiff(payload)).toThrowError(
    expect.objectContaining({
      code: "invalidResponse",
      message: expect.stringContaining(message),
      raw: payload,
    }),
  );
  expect(() => decodeSpecFileDiff(payload)).toThrow(InvalidDiffResponseError);
});
