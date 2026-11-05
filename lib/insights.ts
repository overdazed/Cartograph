import type { ParseResult, FileRecord } from "@/parser/types";

export type InsightKind =
  | "nothing-imports"
  | "unusual-imports"
  | "cycle"
  | "too-long";

export type Insight = {
  kind: InsightKind;
  path: string;
  sentence: string;
  detail?: string;
};

const TOO_LONG_LINES = 1000;

function kosarajuSCCs(nodes: string[], adj: Map<string, string[]>): string[][] {
  const visited = new Set<string>();
  const order: string[] = [];
  for (const start of nodes) {
    if (visited.has(start)) continue;
    const stack: { node: string; it: Iterator<string> }[] = [];
    visited.add(start);
    stack.push({ node: start, it: (adj.get(start) ?? [])[Symbol.iterator]() });
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      const next = top.it.next();
      if (next.done) {
        order.push(top.node);
        stack.pop();
        continue;
      }
      const nb = next.value as string;
      if (visited.has(nb)) continue;
      visited.add(nb);
      stack.push({ node: nb, it: (adj.get(nb) ?? [])[Symbol.iterator]() });
    }
  }

  const radj = new Map<string, string[]>();
  for (const n of nodes) radj.set(n, []);
  for (const [u, vs] of adj) {
    for (const v of vs) {
      const list = radj.get(v);
      if (list) list.push(u);
    }
  }

  const visited2 = new Set<string>();
  const sccs: string[][] = [];
  for (let i = order.length - 1; i >= 0; i -= 1) {
    const start = order[i];
    if (visited2.has(start)) continue;
    const comp: string[] = [];
    const stack = [start];
    visited2.add(start);
    while (stack.length > 0) {
      const u = stack.pop() as string;
      comp.push(u);
      for (const v of radj.get(u) ?? []) {
        if (!visited2.has(v)) {
          visited2.add(v);
          stack.push(v);
        }
      }
    }
    sccs.push(comp);
  }
  return sccs;
}

function findCycleInSCC(sccNodes: string[], adj: Map<string, string[]>): string[] | null {
  const set = new Set(sccNodes);
  const start = sccNodes[0];
  if (adj.get(start)?.some((n) => n === start)) return [start];

  const path: string[] = [start];
  const visited = new Set<string>([start]);
  const itStack: Iterator<string>[] = [
    (adj.get(start) ?? []).filter((n) => set.has(n))[Symbol.iterator](),
  ];

  while (path.length > 0) {
    const top = itStack[itStack.length - 1];
    const next = top.next();
    if (next.done) {
      const node = path.pop() as string;
      visited.delete(node);
      itStack.pop();
      continue;
    }
    const nb = next.value as string;
    if (nb === start) {
      return [...path];
    }
    if (visited.has(nb)) continue;
    visited.add(nb);
    path.push(nb);
    itStack.push((adj.get(nb) ?? []).filter((n) => set.has(n))[Symbol.iterator]());
  }
  return null;
}

function findCycles(files: FileRecord[], edges: ParseResult["edges"]): string[][] {
  const nodes = files.map((f) => f.path);
  const nodeSet = new Set(nodes);
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n, []);
  for (const e of edges) {
    if (e.typeOnly) continue;
    if (!nodeSet.has(e.from) || !nodeSet.has(e.to)) continue;
    adj.get(e.from)!.push(e.to);
  }
  for (const [k, v] of adj) adj.set(k, [...new Set(v)]);

  const sccs = kosarajuSCCs(nodes, adj);
  const cycles: string[][] = [];
  for (const scc of sccs) {
    if (scc.length === 1) {
      if (adj.get(scc[0])?.includes(scc[0])) cycles.push([scc[0]]);
      continue;
    }
    const cycle = findCycleInSCC(scc, adj);
    if (cycle) cycles.push(cycle);
    if (cycles.length >= 10) break;
  }
  return cycles;
}

export function computeInsights(data: ParseResult): Insight[] {
  const files = data.files;
  const edges = data.edges;

  const nothingImports = files
    .filter((f) => f.fanIn === 0 && f.entryReason === null)
    .sort((a, b) => a.path.localeCompare(b.path))
    .map<Insight>((f) => ({
      kind: "nothing-imports",
      path: f.path,
      sentence: `${f.path} is imported by nothing.`,
    }));

  const fanIns = files.map((f) => f.fanIn).filter((n) => n > 0);
  const mean = fanIns.reduce((a, b) => a + b, 0) / (fanIns.length || 1);
  const variance =
    fanIns.reduce((a, b) => a + (b - mean) ** 2, 0) / (fanIns.length || 1);
  const std = Math.sqrt(variance);
  const threshold = Math.max(5, mean + 2 * std);
  const unusual = files
    .filter((f) => f.fanIn >= threshold)
    .sort((a, b) => b.fanIn - a.fanIn || a.path.localeCompare(b.path))
    .map<Insight>((f) => ({
      kind: "unusual-imports",
      path: f.path,
      sentence: `${f.path} is imported by an unusual number of files.`,
    }));

  const cycles = findCycles(files, edges);
  const cycleInsights = cycles.map<Insight>((c) => ({
    kind: "cycle",
    path: c[0],
    sentence: `${c[0]} is part of an import cycle.`,
    detail: c.join(" → ") + " → " + c[0],
  }));

  const tooLong = files
    .filter((f) => f.lines >= TOO_LONG_LINES)
    .sort((a, b) => b.lines - a.lines || a.path.localeCompare(b.path))
    .map<Insight>((f) => ({
      kind: "too-long",
      path: f.path,
      sentence: `${f.path} is unusually long.`,
    }));

  return [...nothingImports, ...unusual, ...cycleInsights, ...tooLong];
}