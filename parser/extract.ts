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
    if (call.getExpression().getKind() === SyntaxKind.ImportKeyword) {
      const arg = call.getArguments()[0];
      if (!arg || !arg.isKind(SyntaxKind.StringLiteral)) continue;
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
      continue;
    }

    const expr = call.getExpression();
    if (expr.getKind() !== SyntaxKind.Identifier) continue;
    if (expr.getText() !== "require") continue;

    const arg = call.getArguments()[0];
    if (!arg || !arg.isKind(SyntaxKind.StringLiteral)) {
      results.push({
        specifier: arg ? arg.getText() : "require()",
        kind: "require",
        typeOnly: false,
        status: "unresolved",
        target: null,
        reason: "non-literal-require",
      });
      continue;
    }
    const specifier = (arg as { getLiteralValue(): string }).getLiteralValue();
    const result = resolveImport(root, fromPath, specifier);
    results.push({
      specifier,
      kind: "require",
      typeOnly: false,
      status: result.status,
      target: result.target,
      reason: result.reason,
    });
  }

  return results;
}

export function extractExports(
  _root: string,
  _fromPath: string,
  content: string,
): string[] {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  const sourceFile = project.createSourceFile(_fromPath, content, { overwrite: true });
  const names = new Set<string>();

  for (const key of sourceFile.getExportedDeclarations().keys()) {
    if (key) names.add(key);
  }

  for (const bin of sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
    if (bin.getOperatorToken().getText() !== "=") continue;
    const left = bin.getLeft();
    const right = bin.getRight();
    const leftText = left.getText();

    if (leftText === "exports" || leftText === "module.exports") {
      if (right.isKind(SyntaxKind.ObjectLiteralExpression)) {
        for (const prop of right.getProperties()) {
          if (prop.isKind(SyntaxKind.PropertyAssignment)) {
            const name = prop.getNameNode().getText().replace(/^['"]|['"]$/g, "");
            if (name) names.add(name);
          } else if (prop.isKind(SyntaxKind.ShorthandPropertyAssignment)) {
            names.add(prop.getName());
          }
        }
      } else {
        names.add("default");
      }
      continue;
    }

    if (left.isKind(SyntaxKind.PropertyAccessExpression)) {
      const exprText = left.getExpression().getText();
      if (exprText === "exports" || exprText === "module.exports") {
        const name = left.getName();
        if (name) names.add(name);
      }
    }
  }

  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const callee = call.getExpression();
    if (!callee.isKind(SyntaxKind.PropertyAccessExpression)) continue;
    if (callee.getExpression().getText() !== "Object" || callee.getName() !== "assign") continue;
    const args = call.getArguments();
    if (args.length < 2) continue;
    const target = args[0].getText();
    if (target !== "exports" && target !== "module.exports") continue;
    const obj = args[1];
    if (!obj.isKind(SyntaxKind.ObjectLiteralExpression)) continue;
    for (const prop of obj.getProperties()) {
      if (prop.isKind(SyntaxKind.PropertyAssignment)) {
        const name = prop.getNameNode().getText().replace(/^['"]|['"]$/g, "");
        if (name) names.add(name);
      } else if (prop.isKind(SyntaxKind.ShorthandPropertyAssignment)) {
        names.add(prop.getName());
      }
    }
  }

  return [...names].sort();
}
