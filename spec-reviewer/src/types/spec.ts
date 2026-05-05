export type SpecFileKey =
  | "exploration"
  | "hearing"
  | "impl"
  | "tasks"
  | "requirements"
  | "design";

export type SpecFileStatus = "present" | "missing";

export type SpecFile = Readonly<{
  key: SpecFileKey;
  label: string;
  fileName: string;
  status: SpecFileStatus;
}>;

export type SpecNode = Readonly<{
  id: string;
  label: string;
  files: readonly SpecFile[];
  children: readonly SpecNode[];
}>;

export type SpecTree = Readonly<{
  specs: readonly SpecNode[];
}>;

export type ListSpecsRequest = Readonly<{
  workspacePath: string;
}>;

export type ReadSpecFileRequest = Readonly<{
  workspacePath: string;
  specId: string;
  fileKey: SpecFileKey;
}>;

export type SpecDocument = Readonly<{
  key: SpecFileKey;
  path: string;
  contents: string | null;
  missing: boolean;
}>;
