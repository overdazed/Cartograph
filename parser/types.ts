export type EdgeKind = "import" | "reexport" | "dynamic" | "require";

export type FileRecord = {
  path: string;
  folder: string;
  lines: number;
  hash: string;
  role: string | null;
  entryReason: string | null;
  exports: string[];
  fanIn: number;
  fanOut: number;
};

export type Route = {
  method: string;
  path: string;
  filePath: string;
};

export type Edge = {
  from: string;
  to: string;
  kind: EdgeKind;
  typeOnly: boolean;
};

export type SkippedFile = {
  path: string;
  reason: string;
};

export type UnresolvedImport = {
  from: string;
  specifier: string;
  kind: EdgeKind;
  reason: string;
};

export type Coverage = {
  totalImports: number;
  resolvedInternal: number;
  resolvedExternal: number;
  excluded: number;
  unresolved: number;
  reexportsFound: number;
  reexportsResolved: number;
  unresolvedImports: UnresolvedImport[];
};

export type ParseResult = {
  version: number;
  root: string;
  adapter: string;
  generatedAt: string;
  files: FileRecord[];
  edges: Edge[];
  routes: Route[];
  skipped: SkippedFile[];
  coverage: Coverage;
  summary: {
    filesFound: number;
    filesParsed: number;
    filesSkipped: number;
    folders: number;
    edges: number;
  };
};