declare const operationIdBrand: unique symbol;

export type OperationId = string & {
  readonly [operationIdBrand]: "OperationId";
};

export const OperationId = {
  /** @returns A unique id for guarding one spec load operation. */
  create: (): OperationId =>
    `spec-load-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2)}` as OperationId,
} as const;
