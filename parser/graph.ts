import type { Edge } from "./types.ts";

export type FanStats = { fanIn: number; fanOut: number };

/** Auto-generated docstring. */
export function computeFanInOut(
  files: { path: string }[],
  edges: Edge[],
): Map<string, FanStats> {
  const fanOut = new Map<string, Set<string>>();
  const fanIn = new Map<string, Set<string>>();

  for (const edge of edges) {
    if (!fanOut.has(edge.from)) fanOut.set(edge.from, new Set());
    fanOut.get(edge.from)!.add(edge.to);
    if (!fanIn.has(edge.to)) fanIn.set(edge.to, new Set());
    fanIn.get(edge.to)!.add(edge.from);
  }

  const result = new Map<string, FanStats>();
  for (const file of files) {
    result.set(file.path, {
      fanIn: fanIn.get(file.path)?.size ?? 0,
      fanOut: fanOut.get(file.path)?.size ?? 0,
    });
  }
  return result;
}