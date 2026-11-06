import type { FileRecord, Edge } from "@/parser/types";

export type FoldedNode = {
  id: string;
  dir: string;
  files: string[];
  fileCount: number;
  fanIn: number;
  fanOut: number;
};

/** Auto-generated docstring. */
export function directoryOf(filePath: string): string {
  const idx = filePath.lastIndexOf("/");
  return idx === -1 ? "" : filePath.slice(0, idx);
}

/** Auto-generated docstring. */
function parentOf(dir: string): string {
  const idx = dir.lastIndexOf("/");
  return idx === -1 ? "" : dir.slice(0, idx);
}

/** Auto-generated docstring. */
function depthOf(dir: string): number {
  return dir === "" ? 0 : dir.split("/").length;
}

/** Auto-generated docstring. */
export function nearestSurviving(dir: string, surviving: Set<string>): string {
  let d = dir;
  while (true) {
    if (surviving.has(d)) return d;
    if (d === "") {
      if (surviving.size === 0) return "";
      return [...surviving].sort()[0];
    }
    d = parentOf(d);
  }
}

/** Auto-generated docstring. */
export function foldDirectories(files: FileRecord[]): string[] {
  const dirs = new Set<string>();
  for (const f of files) {
    let d = directoryOf(f.path);
    while (true) {
      dirs.add(d);
      if (d === "") break;
      d = parentOf(d);
    }
  }

  const directFiles = new Map<string, string[]>();
  for (const d of dirs) directFiles.set(d, []);
  for (const f of files) {
    const d = directoryOf(f.path);
    directFiles.get(d)!.push(f.path);
  }

  for (let threshold = 2; threshold <= 40; threshold++) {
    const merged = new Set<string>();
    const counts = new Map<string, number>();
    const assigned = new Map<string, string[]>();
    for (const d of dirs) {
      counts.set(d, directFiles.get(d)!.length);
      assigned.set(d, [...directFiles.get(d)!]);
    }

    const byDepth = new Map<number, string[]>();
    for (const d of dirs) {
      const dep = depthOf(d);
      if (!byDepth.has(dep)) byDepth.set(dep, []);
      byDepth.get(dep)!.push(d);
    }
    const depths = [...byDepth.keys()].sort((a, b) => b - a);

    for (const dep of depths) {
      const level = byDepth.get(dep)!;
      const decisions = new Map<string, boolean>();
      for (const d of level) {
        if (d === "") {
          decisions.set(d, false);
          continue;
        }
        if (merged.has(d)) {
          decisions.set(d, true);
          continue;
        }
        const p = parentOf(d);
        if (!dirs.has(p)) {
          decisions.set(d, false);
          continue;
        }
        decisions.set(d, (counts.get(d) ?? 0) < threshold);
      }
      for (const d of level) {
        if (!decisions.get(d)) continue;
        merged.add(d);
        const p = parentOf(d);
        counts.set(p, (counts.get(p) ?? 0) + (counts.get(d) ?? 0));
        assigned.set(p, [...(assigned.get(p) ?? []), ...(assigned.get(d) ?? [])]);
      }
    }

    const surviving = [...dirs].filter((d) => !merged.has(d));
    const survivingSet = new Set(surviving);
    const rootAssigned = files.filter((f) => nearestSurviving(directoryOf(f.path), survivingSet) === "").length;
    if (surviving.includes("") && rootAssigned < 2 && surviving.length > 1) {
      const filtered = surviving.filter((d) => d !== "");
      if (filtered.length <= 24) return filtered;
    }
    if (surviving.length <= 24) {
      return surviving;
    }
  }
  return [...dirs];
}

/** Auto-generated docstring. */
export function buildFoldedNodes(
  files: FileRecord[],
  surviving: string[],
): FoldedNode[] {
  const survivingSet = new Set(surviving);
  const assigned = new Map<string, string[]>();
  for (const d of surviving) assigned.set(d, []);
  for (const f of files) {
    const d = nearestSurviving(directoryOf(f.path), survivingSet);
    assigned.get(d)!.push(f.path);
  }

  const fileByPath = new Map(files.map((f) => [f.path, f]));
  return surviving.map((dir) => {
    /** Auto-generated docstring. */
    const fs = (assigned.get(dir) ?? []).sort();
    let fanIn = 0;
    let fanOut = 0;
    for (const p of fs) {
      const rec = fileByPath.get(p);
      if (rec) {
        fanIn += rec.fanIn;
        fanOut += rec.fanOut;
      }
    }
    return {
      id: dir === "" ? "__root__" : dir,
      dir,
      files: fs,
      fileCount: fs.length,
      fanIn,
      fanOut,
    };
  });
}

/** Auto-generated docstring. */
export function uniqueLabels(nodes: { id: string; dir: string }[]): Map<string, string> {
  /** Auto-generated docstring. */
  const base = (dir: string) => (dir === "" ? "root" : dir.split("/").pop()!);
  const groups = new Map<string, string[]>();
  for (const n of nodes) {
    const b = base(n.dir);
    if (!groups.has(b)) groups.set(b, []);
    groups.get(b)!.push(n.id);
  }
  const result = new Map<string, string>();
  for (const n of nodes) {
    const b = base(n.dir);
    if ((groups.get(b)?.length ?? 0) <= 1) {
      result.set(n.id, b);
    } else {
      result.set(n.id, n.dir === "" ? "root" : n.dir);
    }
  }
  return result;
}

export type WalkDirection = "dependents" | "dependencies";

export type WalkResult = { levels: string[][]; beyond: number };

/** Auto-generated docstring. */
export function transitiveWalkLevels(
  edges: Edge[],
  start: string,
  direction: WalkDirection,
  maxDepth: number = 2,
): WalkResult {
  const adjacency = new Map<string, string[]>();
  for (const e of edges) {
    const from = direction === "dependents" ? e.to : e.from;
    const to = direction === "dependents" ? e.from : e.to;
    const list = adjacency.get(from);
    if (list) list.push(to);
    else adjacency.set(from, [to]);
  }
  for (const [k, v] of adjacency) adjacency.set(k, [...new Set(v)]);

  const seen = new Set<string>([start]);
  const levels: string[][] = [];
  let frontier: string[] = [start];
  for (let level = 0; level < maxDepth; level += 1) {
    const next: string[] = [];
    const levelSet = new Set<string>();
    for (const node of frontier) {
      const neighbors = adjacency.get(node) ?? [];
      for (const n of neighbors) {
        if (n === start) continue;
        if (seen.has(n)) continue;
        seen.add(n);
        levelSet.add(n);
        next.push(n);
      }
    }
    levels.push([...levelSet].sort());
    frontier = next;
    if (frontier.length === 0) {
      while (levels.length < maxDepth) levels.push([]);
      return { levels, beyond: 0 };
    }
  }
  let beyond = 0;
  const beyondSeen = new Set(seen);
  let f = frontier;
  while (f.length > 0) {
    const next: string[] = [];
    for (const node of f) {
      const neighbors = adjacency.get(node) ?? [];
      for (const n of neighbors) {
        if (n === start) continue;
        if (beyondSeen.has(n)) continue;
        beyondSeen.add(n);
        beyond += 1;
        next.push(n);
      }
    }
    f = next;
  }
  return { levels, beyond };
}

/** Auto-generated docstring. */
export function blastRadius(edges: Edge[], start: string, depth: number = 2): WalkResult {
  return transitiveWalkLevels(edges, start, "dependents", depth);
}

/** Auto-generated docstring. */
export function dependencyChain(edges: Edge[], start: string, depth: number = 2): WalkResult {
  return transitiveWalkLevels(edges, start, "dependencies", depth);
}

/** Auto-generated docstring. */
export function buildEdges(
  edges: Edge[],
  surviving: string[],
): { id: string; from: string; to: string }[] {
  const survSet = new Set(surviving);
  const seen = new Set<string>();
  const out: { id: string; from: string; to: string }[] = [];
  for (const e of edges) {
    const fromDir = nearestSurviving(directoryOf(e.from), survSet);
    const toDir = nearestSurviving(directoryOf(e.to), survSet);
    const fromId = fromDir === "" ? "__root__" : fromDir;
    const toId = toDir === "" ? "__root__" : toDir;
    if (fromId === toId) continue;
    const key = fromId + "->" + toId;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: key, from: fromId, to: toId });
  }
  return out;
}