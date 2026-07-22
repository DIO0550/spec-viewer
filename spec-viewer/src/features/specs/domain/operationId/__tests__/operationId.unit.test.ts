import { expect, test, vi } from "vitest";
import {
  OperationId,
  type OperationId as OperationIdType,
} from "@/features/specs/domain/operationId";

test("OperationId.createはspec load用の形式を持つIDを生成する", () => {
  const operationId: OperationIdType = OperationId.create();

  expect(operationId).toMatch(/^spec-load-[a-z0-9]+-[a-z0-9]+$/);
});

test("OperationId.createは生成ごとに異なるoperation identityを返す", () => {
  const dateNowSpy = vi
    .spyOn(Date, "now")
    .mockReturnValueOnce(1)
    .mockReturnValueOnce(2);
  const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.1);

  const firstOperationId = OperationId.create();
  const secondOperationId = OperationId.create();

  dateNowSpy.mockRestore();
  randomSpy.mockRestore();

  expect(firstOperationId).not.toBe(secondOperationId);
});
