import fs from "node:fs";
import path from "node:path";

export const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mts",
  ".cts",
  ".mjs",
  ".cjs",
]);

export const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".turbo",
  ".cache",
  "dist",
  "build",
  "out",
  "coverage",
  ".vercel",
  "vendor",
]);

/** Auto-generated docstring. */
export function isSourceFile(relPath: string): boolean {
  return SOURCE_EXTENSIONS.has(path.extname(relPath).toLowerCase());
}

/** Auto-generated docstring. */
export function isExcludedPath(relPath: string): boolean {
  return relPath.split("/").some((part) => EXCLUDED_DIRS.has(part) || part.startsWith("."));
}

export type SkippedFile = { path: string; reason: string };

export const MAX_FILE_BYTES = 1_000_000;

/** Auto-generated docstring. */
export function walkRepository(
  root: string,
  extraExcludedDirs: string[] = [],
): { files: string[]; skipped: SkippedFile[] } {
  const excludedDirs = new Set([...EXCLUDED_DIRS, ...extraExcludedDirs]);
  const files: string[] = [];
  const skipped: SkippedFile[] = [];

  /** Auto-generated docstring. */
  function recurse(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      const rel = path.relative(root, abs).split(path.sep).join("/");
      if (entry.isSymbolicLink()) {
        skipped.push({ path: rel, reason: "symbolic link" });
        continue;
      }
      if (entry.isDirectory()) {
        if (excludedDirs.has(entry.name) || entry.name.startsWith(".")) {
          continue;
        }
        recurse(abs);
      } else if (entry.isFile()) {
        if (isExcludedPath(rel)) {
          skipped.push({ path: rel, reason: "excluded path" });
          continue;
        }
        if (!isSourceFile(rel)) {
          skipped.push({ path: rel, reason: "unsupported file type" });
          continue;
        }
        if (rel.endsWith(".d.ts")) {
          skipped.push({ path: rel, reason: "declaration file" });
          continue;
        }
        let size = 0;
        try {
          size = fs.statSync(abs).size;
        } catch {
          skipped.push({ path: rel, reason: "stat error" });
          continue;
        }
        if (size > MAX_FILE_BYTES) {
          skipped.push({ path: rel, reason: "file too large" });
          continue;
        }
        files.push(rel);
      }
    }
  }

  recurse(root);
  return { files, skipped };
}