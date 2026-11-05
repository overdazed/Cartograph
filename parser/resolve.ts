import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

import { EXCLUDED_DIRS, isSourceFile } from "./walk.ts";

export type ResolveStatus = "internal" | "external" | "excluded" | "unresolved";

export type ResolveResult = {
  status: ResolveStatus;
  target: string | null;
  reason: string;
};

const optionsCache = new Map<string, ts.CompilerOptions>();

function findNearestConfig(startDir: string, root: string): string | null {
  let dir = startDir;
  while (true) {
    for (const name of ["tsconfig.json", "jsconfig.json"]) {
      const candidate = path.join(/*turbopackIgnore: true*/ dir, name);
      if (fs.existsSync(candidate)) return candidate;
    }
    if (dir === root) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
    if (!dir.startsWith(root)) break;
  }
  return null;
}

function loadOptions(root: string, fromAbs: string): ts.CompilerOptions {
  const configPath = findNearestConfig(path.dirname(fromAbs), root);
  const cacheKey = configPath ?? "__default__";
  if (optionsCache.has(cacheKey)) return optionsCache.get(cacheKey)!;

  let options: ts.CompilerOptions = {};
  if (configPath) {
    const read = ts.readConfigFile(configPath, ts.sys.readFile);
    if (!read.error && read.config) {
      const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, path.dirname(configPath));
      options = parsed.options;
    }
  }

  if (!options.moduleResolution) {
    options.moduleResolution = ts.ModuleResolutionKind.Bundler;
  }
  if (options.allowJs === undefined) options.allowJs = true;
  if (!options.baseUrl) options.baseUrl = root;

  optionsCache.set(cacheKey, options);
  return options;
}

function toRootRelative(root: string, absPath: string): string | null {
  const rel = path.relative(root, absPath);
  if (rel === "") return ".";
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join("/");
}

function isExcludedRel(rel: string): boolean {
  return rel.split("/").some((part) => EXCLUDED_DIRS.has(part) || part.startsWith("."));
}

function isDeclaration(rel: string): boolean {
  return rel.endsWith(".d.ts");
}

function hasPathAlias(options: ts.CompilerOptions, specifier: string): boolean {
  const paths = options.paths;
  if (!paths) return false;
  for (const pattern of Object.keys(paths)) {
    if (pattern === specifier) return true;
    const star = pattern.indexOf("*");
    if (star === -1) continue;
    const prefix = pattern.slice(0, star);
    const suffix = pattern.slice(star + 1);
    if (
      specifier.startsWith(prefix) &&
      specifier.endsWith(suffix) &&
      specifier.length >= prefix.length + suffix.length
    ) {
      return true;
    }
  }
  return false;
}

export function resolveImport(root: string, fromRel: string, specifier: string): ResolveResult {
  const clean = specifier.trim().split("?")[0].split("#")[0];
  if (/^https?:\/\//.test(clean) || /^\/\//.test(clean)) {
    return { status: "external", target: null, reason: "external module" };
  }

  const fromAbs = path.join(root, fromRel);
  const options = loadOptions(root, fromAbs);

  const host: ts.ModuleResolutionHost = {
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    getCurrentDirectory: () => path.dirname(fromAbs),
    getDirectories: ts.sys.getDirectories,
    useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
  };

  const resolved = ts.resolveModuleName(clean, fromAbs, options, host);

  if (resolved.resolvedModule) {
    const resolvedFileName = resolved.resolvedModule.resolvedFileName;
    const rel = toRootRelative(root, resolvedFileName);

    if (rel === null) {
      return { status: "external", target: null, reason: "outside repository" };
    }
    if (rel.split("/").includes("node_modules")) {
      return { status: "external", target: null, reason: "external module" };
    }
    if (isExcludedRel(rel)) {
      return { status: "excluded", target: null, reason: "excluded path" };
    }
    if (isDeclaration(rel)) {
      return { status: "excluded", target: null, reason: "declaration file" };
    }
    if (!isSourceFile(rel)) {
      return { status: "excluded", target: null, reason: "unsupported file type" };
    }
    return { status: "internal", target: rel, reason: "resolved" };
  }

  const isRelative = clean.startsWith(".") || clean.startsWith("/") || /^[a-zA-Z]:/.test(clean);
  if (isRelative || hasPathAlias(options, clean)) {
    // Filesystem fallback for in-repo files TypeScript won't resolve (css, json, etc.)
    if (isRelative) {
      const fromDir = path.dirname(fromAbs);
      const abs = path.resolve(fromDir, clean);
      const rel = toRootRelative(root, abs);
      if (rel !== null && fs.existsSync(abs)) {
        if (isExcludedRel(rel)) return { status: "excluded", target: null, reason: "excluded path" };
        if (isDeclaration(rel)) return { status: "excluded", target: null, reason: "declaration file" };
        if (!isSourceFile(rel)) return { status: "excluded", target: null, reason: "unsupported file type" };
        return { status: "internal", target: rel, reason: "resolved" };
      }
    }
    return { status: "unresolved", target: null, reason: "module not found" };
  }

  return { status: "external", target: null, reason: "external module" };
}
