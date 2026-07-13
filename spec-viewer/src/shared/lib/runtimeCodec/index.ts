export type RuntimeDecodeError = Readonly<{
  path: string;
  expected: string;
  actual: string;
}>;

export type RuntimeDecodeResult<Value> =
  | Readonly<{ ok: true; value: Value }>
  | Readonly<{ ok: false; error: RuntimeDecodeError }>;

export type RuntimeCodec<Value> = Readonly<{
  decode(value: unknown, path?: string): RuntimeDecodeResult<Value>;
}>;

type CodecValue<Codec> =
  Codec extends RuntimeCodec<infer Value> ? Value : never;
type ObjectShape = Readonly<Record<string, RuntimeCodec<unknown>>>;
type DecodedObject<Shape extends ObjectShape> = Readonly<{
  [Key in keyof Shape]: CodecValue<Shape[Key]>;
}>;

const success = <Value>(value: Value): RuntimeDecodeResult<Value> => ({
  ok: true,
  value,
});

const failure = (
  path: string,
  expected: string,
  value: unknown,
): RuntimeDecodeResult<never> => ({
  ok: false,
  error: { path, expected, actual: describeActual(value) },
});

const string: RuntimeCodec<string> = {
  decode(value, path = "$") {
    return typeof value === "string"
      ? success(value)
      : failure(path, "string", value);
  },
};

const nonEmptyString: RuntimeCodec<string> = {
  decode(value, path = "$") {
    return typeof value === "string" && value.trim().length > 0
      ? success(value)
      : failure(path, "non-empty string", value);
  },
};

const boolean: RuntimeCodec<boolean> = {
  decode(value, path = "$") {
    return typeof value === "boolean"
      ? success(value)
      : failure(path, "boolean", value);
  },
};

const number: RuntimeCodec<number> = {
  decode(value, path = "$") {
    return typeof value === "number" && Number.isFinite(value)
      ? success(value)
      : failure(path, "finite number", value);
  },
};

const nonNegativeInteger: RuntimeCodec<number> = {
  decode(value, path = "$") {
    return typeof value === "number" &&
      Number.isSafeInteger(value) &&
      value >= 0
      ? success(value)
      : failure(path, "non-negative integer", value);
  },
};

const isoDateTime: RuntimeCodec<string> = {
  decode(value, path = "$") {
    return typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
        value,
      ) &&
      !Number.isNaN(Date.parse(value))
      ? success(value)
      : failure(path, "ISO date-time string", value);
  },
};

const unknown: RuntimeCodec<unknown> = {
  decode(value) {
    return success(value);
  },
};

function array<Value>(
  item: RuntimeCodec<Value>,
): RuntimeCodec<readonly Value[]> {
  return {
    decode(value, path = "$") {
      if (!Array.isArray(value)) {
        return failure(path, "array", value);
      }

      const decoded: Value[] = [];
      for (const [index, entry] of value.entries()) {
        const result = item.decode(entry, `${path}[${index}]`);
        if (!result.ok) {
          return result;
        }
        decoded.push(result.value);
      }

      return success(decoded);
    },
  };
}

function object<Shape extends ObjectShape>(
  shape: Shape,
): RuntimeCodec<DecodedObject<Shape>> {
  return {
    decode(value, path = "$") {
      if (!isRecord(value)) {
        return failure(path, "object", value);
      }

      const decoded: Record<string, unknown> = {};
      for (const [key, codec] of Object.entries(shape)) {
        const result = codec.decode(value[key], `${path}.${key}`);
        if (!result.ok) {
          return result;
        }
        decoded[key] = result.value;
      }

      return success(decoded as DecodedObject<Shape>);
    },
  };
}

function nullable<Value>(
  codec: RuntimeCodec<Value>,
): RuntimeCodec<Value | null> {
  return {
    decode(value, path = "$") {
      return value === null ? success(null) : codec.decode(value, path);
    },
  };
}

function optional<Value>(
  codec: RuntimeCodec<Value>,
): RuntimeCodec<Value | undefined> {
  return {
    decode(value, path = "$") {
      return value === undefined
        ? success(undefined)
        : codec.decode(value, path);
    },
  };
}

function literalUnion<
  const Values extends readonly (string | number | boolean)[],
>(values: Values): RuntimeCodec<Values[number]> {
  return {
    decode(value, path = "$") {
      if (values.some((candidate) => candidate === value)) {
        return success(value as Values[number]);
      }

      return failure(
        path,
        `one of ${values.map((entry) => JSON.stringify(entry)).join(", ")}`,
        value,
      );
    },
  };
}

function map<Input, Output>(
  codec: RuntimeCodec<Input>,
  mapper: (value: Input) => Output,
): RuntimeCodec<Output> {
  return {
    decode(value, path = "$") {
      const result = codec.decode(value, path);
      return result.ok ? success(mapper(result.value)) : result;
    },
  };
}

export const RuntimeCodec = {
  string,
  nonEmptyString,
  boolean,
  number,
  nonNegativeInteger,
  isoDateTime,
  unknown,
  array,
  object,
  nullable,
  optional,
  literalUnion,
  map,
} as const;

export class IpcResponseDecodeError extends Error {
  readonly code = "invalidResponse";

  constructor(
    readonly command: string,
    readonly path: string,
    readonly expected: string,
    readonly actual: string,
  ) {
    super(
      `Invalid ${command} response at ${path}: expected ${expected}, received ${actual}`,
    );
    this.name = "IpcResponseDecodeError";
  }
}

export function decodeRuntimeValue<Value>(
  command: string,
  codec: RuntimeCodec<Value>,
  value: unknown,
): Value {
  const result = codec.decode(value);
  if (result.ok) {
    return result.value;
  }

  throw new IpcResponseDecodeError(
    command,
    result.error.path,
    result.error.expected,
    result.error.actual,
  );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describeActual(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}
