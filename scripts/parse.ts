import fs from "node:fs";

import { parseRepository } from "../parser/index.ts";

/** Auto-generated docstring. */
function parseArgs(argv: string[]): { dir: string; out: string | null } {
  let dir = "";
  let out: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--out") {
      out = argv[i + 1] ?? null;
      i += 1;
    } else if (!dir) {
      dir = arg;
    }
  }
  return { dir, out };
}

const { dir, out } = parseArgs(process.argv.slice(2));

if (!dir) {
  console.error("Usage: parse <directory> [--out file.json]");
  process.exit(1);
}

const result = parseRepository(dir);

console.log(`Root: ${result.root}`);
console.log(`Adapter: ${result.adapter}`);
console.log(`Files found: ${result.summary.filesFound}`);
console.log(`Files parsed: ${result.summary.filesParsed}`);
console.log(`Files skipped: ${result.summary.filesSkipped}`);
console.log(`Folders: ${result.summary.folders}`);
console.log(`Edges: ${result.summary.edges}`);
console.log(
  `Coverage: ${result.coverage.totalImports} imports — ${result.coverage.resolvedInternal} internal, ${result.coverage.resolvedExternal} external, ${result.coverage.excluded} excluded, ${result.coverage.unresolved} unresolved`,
);
console.log(
  `Re-exports: ${result.coverage.reexportsFound} found, ${result.coverage.reexportsResolved} resolved`,
);

if (result.skipped.length > 0) {
  console.log("\nSkipped files:");
  for (const entry of result.skipped) {
    console.log(`  ${entry.path} — ${entry.reason}`);
  }
}

if (result.coverage.unresolvedImports.length > 0) {
  console.log("\nUnresolved imports:");
  for (const entry of result.coverage.unresolvedImports.slice(0, 50)) {
    console.log(`  ${entry.from}: ${entry.specifier} (${entry.kind}) — ${entry.reason}`);
  }
  if (result.coverage.unresolvedImports.length > 50) {
    console.log(`  ... and ${result.coverage.unresolvedImports.length - 50} more`);
  }
}

if (out) {
  fs.writeFileSync(out, JSON.stringify(result, null, 2));
  console.log(`\nWrote ${out}`);
}