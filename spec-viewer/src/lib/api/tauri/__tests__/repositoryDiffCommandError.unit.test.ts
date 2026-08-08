import { expect, test } from "vitest";

import { InvalidDiffResponseError } from "@/lib/api/tauri/diffPayloadDecoder";
import { GIT_BACKEND_ERROR_CODES } from "@/lib/api/tauri/gitBackendErrorCode";
import {
  createRepositoryCommandErrorCompanion,
  isRepositoryBackendErrorCode,
  isRepositoryCommandErrorCode,
  REPOSITORY_BACKEND_ERROR_CODES,
  REPOSITORY_ONLY_ERROR_CODES,
} from "@/lib/api/tauri/repositoryDiffCommandError";

const companion = createRepositoryCommandErrorCompanion("load_repository_diff");

test.each(
  REPOSITORY_BACKEND_ERROR_CODES,
)("backend error code=%sをそのまま正規化する", (code) => {
  const normalized = companion.fromUnknown({ code, message: `${code} failed` });

  expect(normalized).toEqual({
    command: "load_repository_diff",
    code,
    message: `${code} failed`,
    raw: { code, message: `${code} failed` },
  });
});

test("REPOSITORY_BACKEND_ERROR_CODESは共有21とrepository固有3の24要素である", () => {
  expect(REPOSITORY_BACKEND_ERROR_CODES).toHaveLength(24);
  expect(new Set(REPOSITORY_BACKEND_ERROR_CODES)).toEqual(
    new Set([...GIT_BACKEND_ERROR_CODES, ...REPOSITORY_ONLY_ERROR_CODES]),
  );
});

test("commandフィールドが無いreject payloadを正規化する", () => {
  const normalized = companion.fromUnknown({
    code: "staleCursor",
    message: "cursor expired",
  });

  expect(normalized.command).toBe("load_repository_diff");
  expect(normalized.code).toBe("staleCursor");
});

test.each([
  "invalidResponse",
  "unknown",
])("command固有code=%sはbackend codeではないがcommand codeである", (code) => {
  expect(isRepositoryBackendErrorCode(code)).toBe(false);
  expect(isRepositoryCommandErrorCode(code)).toBe(true);
});

test.each([
  "workspaceDetection",
  "configLoad",
  "specTreeScan",
])("Spec固有code=%sはrepository command codeではない", (code) => {
  expect(isRepositoryCommandErrorCode(code)).toBe(false);
});

test("未知codeのreject payloadはunknownへ落とす", () => {
  const normalized = companion.fromUnknown({
    code: "somethingElse",
    message: "nope",
  });

  expect(normalized.code).toBe("unknown");
  expect(normalized.message).toBe("Unknown load_repository_diff failure");
});

test("Errorインスタンスはmessageを保ってunknownへ落とす", () => {
  const error = new Error("boom");
  const normalized = companion.fromUnknown(error);

  expect(normalized).toMatchObject({ code: "unknown", message: "boom" });
  expect(normalized.raw).toBe(error);
});

test("文字列のrejectはそのままmessageになる", () => {
  expect(companion.fromUnknown("plain failure")).toMatchObject({
    code: "unknown",
    message: "plain failure",
    raw: "plain failure",
  });
});

test.each([
  { name: "null", value: null },
  { name: "undefined", value: undefined },
  { name: "数値", value: 42 },
])("$nameのrejectをunknownへ正規化する", ({ value }) => {
  const normalized = companion.fromUnknown(value);

  expect(normalized.code).toBe("unknown");
  expect(normalized.raw).toBe(value);
});

test("invalidResponseはInvalidDiffResponseErrorのrawを引き継ぐ", () => {
  const raw = { response: "broken" };
  const error = new InvalidDiffResponseError("base.state must be known", raw);

  expect(companion.invalidResponse(error)).toEqual({
    command: "load_repository_diff",
    code: "invalidResponse",
    message: "base.state must be known",
    raw,
  });
});

test.each([
  "traverse_repository_ignored",
  "load_repository_file",
])("companionはcommand=%sを正規化結果へ刻む", (command) => {
  expect(
    createRepositoryCommandErrorCompanion(command).fromUnknown({
      code: "io",
      message: "io failure",
    }).command,
  ).toBe(command);
});
