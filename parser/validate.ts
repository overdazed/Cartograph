import type { ParseResult, FileRecord, Edge, SkippedFile, UnresolvedImport, Coverage, Route } from "./types.ts";

export class ParseResultValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseResultValidationError";
  }
}

/** Auto-generated docstring. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Auto-generated docstring. */
function requireString(value: unknown, path: string): string {
  if (typeof value !== "string") throw new ParseResultValidationError(`${path} must be a string`);
  return value;
}

/** Auto-generated docstring. */
function requireNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ParseResultValidationError(`${path} must be a finite number`);
  }
  return value;
}

/** Auto-generated docstring. */
function requireBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") throw new ParseResultValidationError(`${path} must be a boolean`);
  return value;
}

/** Auto-generated docstring. */
function validateFileRecord(value: unknown, path: string): FileRecord {
  if (!isRecord(value)) throw new ParseResultValidationError(`${path} must be an object`);
  return {
    path: requireString(value.path, `${path}.path`),
    folder: requireString(value.folder, `${path}.folder`),
    lines: requireNumber(value.lines, `${path}.lines`),
    hash: requireString(value.hash, `${path}.hash`),
    role: value.role === null ? null : requireString(value.role, `${path}.role`),
    entryReason: value.entryReason === null ? null : requireString(value.entryReason, `${path}.entryReason`),
    exports: Array.isArray(value.exports) ? value.exports.map((v, i) => requireString(v, `${path}.exports[${i}]`)) : [],
    fanIn: requireNumber(value.fanIn, `${path}.fanIn`),
    fanOut: requireNumber(value.fanOut, `${path}.fanOut`),
  };
}

/** Auto-generated docstring. */
function validateEdge(value: unknown, path: string): Edge {
  if (!isRecord(value)) throw new ParseResultValidationError(`${path} must be an object`);
  const kind = requireString(value.kind, `${path}.kind`);
  if (kind !== "import" && kind !== "reexport" && kind !== "dynamic" && kind !== "require") {
    throw new ParseResultValidationError(`${path}.kind is invalid`);
  }
  return {
    from: requireString(value.from, `${path}.from`),
    to: requireString(value.to, `${path}.to`),
    kind: kind as Edge["kind"],
    typeOnly: requireBoolean(value.typeOnly, `${path}.typeOnly`),
  };
}

/** Auto-generated docstring. */
function validateSkipped(value: unknown, path: string): SkippedFile {
  if (!isRecord(value)) throw new ParseResultValidationError(`${path} must be an object`);
  return {
    path: requireString(value.path, `${path}.path`),
    reason: requireString(value.reason, `${path}.reason`),
  };
}

/** Auto-generated docstring. */
function validateUnresolved(value: unknown, path: string): UnresolvedImport {
  if (!isRecord(value)) throw new ParseResultValidationError(`${path} must be an object`);
  const kind = requireString(value.kind, `${path}.kind`);
  if (kind !== "import" && kind !== "reexport" && kind !== "dynamic" && kind !== "require") {
    throw new ParseResultValidationError(`${path}.kind is invalid`);
  }
  return {
    from: requireString(value.from, `${path}.from`),
    specifier: requireString(value.specifier, `${path}.specifier`),
    kind: kind as UnresolvedImport["kind"],
    reason: requireString(value.reason, `${path}.reason`),
  };
}

/** Auto-generated docstring. */
function validateCoverage(value: unknown): Coverage {
  if (!isRecord(value)) throw new ParseResultValidationError("coverage must be an object");
  if (!Array.isArray(value.unresolvedImports)) {
    throw new ParseResultValidationError("coverage.unresolvedImports must be an array");
  }
  return {
    totalImports: requireNumber(value.totalImports, "coverage.totalImports"),
    resolvedInternal: requireNumber(value.resolvedInternal, "coverage.resolvedInternal"),
    resolvedExternal: requireNumber(value.resolvedExternal, "coverage.resolvedExternal"),
    excluded: requireNumber(value.excluded, "coverage.excluded"),
    unresolved: requireNumber(value.unresolved, "coverage.unresolved"),
    reexportsFound: requireNumber(value.reexportsFound, "coverage.reexportsFound"),
    reexportsResolved: requireNumber(value.reexportsResolved, "coverage.reexportsResolved"),
    unresolvedImports: value.unresolvedImports.map((item, index) =>
      validateUnresolved(item, `coverage.unresolvedImports[${index}]`),
    ),
  };
}

/** Auto-generated docstring. */
function validateRoute(value: unknown, path: string): Route {
  if (!isRecord(value)) throw new ParseResultValidationError(`${path} must be an object`);
  return {
    method: requireString(value.method, `${path}.method`),
    path: requireString(value.path, `${path}.path`),
    filePath: requireString(value.filePath, `${path}.filePath`),
  };
}
/** Auto-generated docstring. */
export function validateParseResult(input: unknown): ParseResult {
  if (!isRecord(input)) throw new ParseResultValidationError("result must be an object");
  if (input.version !== 4) {
    throw new ParseResultValidationError(`unsupported version: ${String(input.version)}`);
  }
  if (!Array.isArray(input.files)) throw new ParseResultValidationError("files must be an array");
  if (!Array.isArray(input.edges)) throw new ParseResultValidationError("edges must be an array");
  if (!Array.isArray(input.routes)) throw new ParseResultValidationError("routes must be an array");
  if (!Array.isArray(input.skipped)) throw new ParseResultValidationError("skipped must be an array");

  const summary = input.summary;
  if (!isRecord(summary)) throw new ParseResultValidationError("summary must be an object");

  return {
    version: 4,
    root: requireString(input.root, "root"),
    adapter: requireString(input.adapter, "adapter"),
    generatedAt: requireString(input.generatedAt, "generatedAt"),
    files: input.files.map((item, index) => validateFileRecord(item, `files[${index}]`)),
    edges: input.edges.map((item, index) => validateEdge(item, `edges[${index}]`)),
    routes: input.routes.map((item, index) => validateRoute(item, `routes[${index}]`)),
    skipped: input.skipped.map((item, index) => validateSkipped(item, `skipped[${index}]`)),
    coverage: validateCoverage(input.coverage),
    summary: {
      filesFound: requireNumber(summary.filesFound, "summary.filesFound"),
      filesParsed: requireNumber(summary.filesParsed, "summary.filesParsed"),
      filesSkipped: requireNumber(summary.filesSkipped, "summary.filesSkipped"),
      folders: requireNumber(summary.folders, "summary.folders"),
      edges: requireNumber(summary.edges, "summary.edges"),
    },
  };
}