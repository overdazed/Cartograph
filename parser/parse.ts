import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { walkRepository } from "./walk.ts";
import { extractImports } from "./extract.ts";
import { computeFanInOut } from "./graph.ts";
import { selectAdapter, adapterForFile } from "./adapters.ts";
import type { Edge, EdgeKind, FileRecord, ParseResult, SkippedFile } from "./types.ts";

function countLines(content: string): number {
  if (content === "") return 0;
  const newlines = (content.match(/\n/g) ?? []).length;
  return content.endsWith("\n") ? newlines : newlines + 1;
}

export function parseRepository(rootPath: string): ParseResult {
  const root = path.resolve(rootPath);
  const adapter = selectAdapter(root);
  const walked = walkRepository(root, adapter.extraExcludedDirs());

  const allSkipped: SkippedFile[] = [...walked.skipped];
  const parsed: { path: string; content: string }[] = [];

  for (const rel of walked.files) {
    const abs = path.join(root, rel);
    let content: string;
    try {
      content = fs.readFileSync(abs, "utf8");
    } catch (error) {
      allSkipped.push({
        path: rel,
        reason: `read error: ${error instanceof Error ? error.message : String(error)}`,
      });
      continue;
    }
    parsed.push({ path: rel, content });
  }

  const fileRecords = new Map<string, FileRecord>();
  for (const entry of parsed) {
    const folder = path.dirname(entry.path).split(path.sep).join("/");
    const fileAdapter = adapterForFile(root, entry.path);
    fileRecords.set(entry.path, {
      path: entry.path,
      folder: folder === "." ? "." : folder,
      lines: countLines(entry.content),
      hash: crypto.createHash("sha256").update(entry.content).digest("hex"),
      role: fileAdapter.role(entry.path, entry.content),
      entryReason: fileAdapter.entryPoint(entry.path),
      fanIn: 0,
      fanOut: 0,
    });
  }

  const edges: Edge[] = [];
  const edgeKeys = new Set<string>();
  const routes: ParseResult["routes"] = [];
  const unresolvedImports: ParseResult["coverage"]["unresolvedImports"] = [];

  let totalImports = 0;
  let resolvedInternal = 0;
  let resolvedExternal = 0;
  let excluded = 0;
  let unresolved = 0;
  let reexportsFound = 0;
  let reexportsResolved = 0;

  function addEdge(from: string, to: string, kind: EdgeKind, typeOnly: boolean): void {
    const key = `${from}\u0000${to}\u0000${kind}\u0000${typeOnly}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push({ from, to, kind, typeOnly });
  }

  for (const entry of parsed) {
    let extracted;
    try {
      extracted = extractImports(root, entry.path, entry.content);
    } catch (error) {
      allSkipped.push({
        path: entry.path,
        reason: `parse error: ${error instanceof Error ? error.message : String(error)}`,
      });
      fileRecords.delete(entry.path);
      continue;
    }

    for (const r of adapterForFile(root, entry.path).routes(entry.path, entry.content)) {
      routes.push(r);
    }

    for (const item of extracted) {
      totalImports += 1;
      if (item.kind === "reexport") reexportsFound += 1;
      if (item.status === "internal" && item.target) {
        resolvedInternal += 1;
        if (item.kind === "reexport") reexportsResolved += 1;
        addEdge(entry.path, item.target, item.kind, item.typeOnly);
      } else if (item.status === "external") {
        resolvedExternal += 1;
      } else if (item.status === "excluded") {
        excluded += 1;
      } else {
        unresolved += 1;
        unresolvedImports.push({
          from: entry.path,
          specifier: item.specifier,
          kind: item.kind,
          reason: item.reason,
        });
      }
    }
  }

  const fanStats = computeFanInOut([...fileRecords.keys()].map((path) => ({ path })), edges);
  for (const record of fileRecords.values()) {
    const stats = fanStats.get(record.path);
    record.fanIn = stats?.fanIn ?? 0;
    record.fanOut = stats?.fanOut ?? 0;
  }

  const files = [...fileRecords.values()].sort((a, b) => a.path.localeCompare(b.path));
  edges.sort(
    (a, b) =>
      a.from.localeCompare(b.from) ||
      a.to.localeCompare(b.to) ||
      a.kind.localeCompare(b.kind),
  );
  allSkipped.sort((a, b) => a.path.localeCompare(b.path));
  unresolvedImports.sort((a, b) => a.from.localeCompare(b.from) || a.specifier.localeCompare(b.specifier));

  const folders = new Set(files.map((file) => file.folder)).size;

  return {
    version: 3,
    root,
    adapter: adapter.name,
    generatedAt: new Date().toISOString(),
    files,
    edges,
    routes: routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method)),
    skipped: allSkipped,
    coverage: {
      totalImports,
      resolvedInternal,
      resolvedExternal,
      excluded,
      unresolved,
      reexportsFound,
      reexportsResolved,
      unresolvedImports,
    },
    summary: {
      filesFound: files.length + allSkipped.length,
      filesParsed: files.length,
      filesSkipped: allSkipped.length,
      folders,
      edges: edges.length,
    },
  };
}