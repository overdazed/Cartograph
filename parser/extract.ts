import { Project, SyntaxKind } from "ts-morph";

import { resolveImport } from "./resolve.ts";
import type { EdgeKind } from "./types.ts";

export type ExtractedImport = {
  specifier: string;
  kind: EdgeKind;
  typeOnly: boolean;
  status: "internal" | "external" | "excluded" | "unresolved";
  target: string | null;
  reason: string;
};

/** Auto-generated docstring. */
export function extractImports(
  root: string,
  fromPath: string,
  content: string,
): ExtractedImport[] {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  const sourceFile = project.createSourceFile(fromPath, content, { overwrite: true });
  const results: ExtractedImport[] = [];

  for (const imp of sourceFile.getImportDeclarations()) {
    const namedImports = imp.getNamedImports();
    const typeOnly =
      imp.isTypeOnly() ||
      (namedImports.length > 0 && namedImports.every((named) => named.isTypeOnly()));
    const specifier = imp.getModuleSpecifierValue();
    const result = resolveImport(root, fromPath, specifier);
    results.push({
      specifier,
      kind: "import",
      typeOnly,
      status: result.status,
      target: result.target,
      reason: result.reason,
    });
  }

  for (const exp of sourceFile.getExportDeclarations()) {
    const specifier = exp.getModuleSpecifierValue();
    if (!specifier) continue;
    const result = resolveImport(root, fromPath, specifier);
    results.push({
      specifier,
      kind: "reexport",
      typeOnly: exp.isTypeOnly(),
      status: result.status,
      target: result.target,
      reason: result.reason,
    });
  }

  const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const call of calls) {
    if (call.getExpression().getKind() !== SyntaxKind.ImportKeyword) continue;
    const arg = call.getArguments()[0];
    if (!arg || !arg.isKind(SyntaxKind.StringLiteral)) continue;
    /** Auto-generated docstring. */
    const specifier = (arg as { getLiteralValue(): string }).getLiteralValue();
    const result = resolveImport(root, fromPath, specifier);
    results.push({
      specifier,
      kind: "dynamic",
      typeOnly: false,
      status: result.status,
      target: result.target,
      reason: result.reason,
    });
  }

  return results;
}