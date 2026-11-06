"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  useUpdateNodeInternals,
  useReactFlow,
  type Node,
  type Edge as RFEdge,
  Position,
  Handle,
  Background,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";

import type { ParseResult } from "@/parser/types";
import {
  buildFoldedNodes,
  foldDirectories,
  uniqueLabels,
  directoryOf,
  nearestSurviving,
} from "@/lib/graph";

const MAX_ROWS = Infinity;
const MAX_PANEL_HEIGHT = 360;

type MapCanvasProps = {
  data: ParseResult;
  selected: string | null;
  onSelect: (id: string | null) => void;
  hovered: string | null;
  onHover: (id: string | null) => void;
  activeCategory?: string | null;
};

type FolderData = {
  id: string;
  label: string;
  collapsed: boolean;
  files: string[];
  fileCount: number;
  fanIn: number;
  fanOut: number;
  width: number;
  height: number;
  dimmed: boolean;
  categoryMatchCount: number;
  activeCategory: string | null;
  fileStats: Record<string, { fanIn: number; fanOut: number }>;
  connectedFiles: Set<string>;
  selected: string | null;
  hovered: string | null;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onSelectFile: (file: string) => void;
  onHover: (id: string | null) => void;
  onUpdateInternals?: (id: string) => void;
  onVisibilityChange?: (id: string, vis: Map<string, "above" | "below" | "visible">) => void;
};

/** Auto-generated docstring. */
function FolderNode({ data }: { data: FolderData }) {
  const d = data;
  const opacity = d.dimmed ? 0.25 : 1;
  const nodeHovered = d.hovered === d.id || (d.hovered !== null && d.files.includes(d.hovered));
  const hoverRing = nodeHovered ? " ring-2 ring-blue-500" : "";
  const [aboveCount, setAboveCount] = useState(0);
  const [belowCount, setBelowCount] = useState(0);

  const lastBucketRef = useRef<number>(-1);
  const measureCounts = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const rowH = 14;
    const bucket = Math.floor(el.scrollTop / rowH);
    if (bucket === lastBucketRef.current) return;
    lastBucketRef.current = bucket;
    const above = Math.max(0, bucket);
    const visibleRows = Math.max(1, Math.ceil((el.scrollTop + el.clientHeight) / rowH) - above);
    const total = d.files.length;
    let below = Math.max(0, total - above - visibleRows);
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
      below = 0;
    }
    const effectiveVisible = total - above - below;
    const vis = new Map<string, "above" | "below" | "visible">();
    for (let i = 0; i < total; i++) {
      const f = d.files[i];
      if (i < above) vis.set(f, "above");
      else if (i >= above + effectiveVisible) vis.set(f, "below");
      else vis.set(f, "visible");
    }
    setAboveCount(above);
    setBelowCount(below);
    d.onVisibilityChange?.(d.id, vis);
  }, [d]);
  useEffect(() => {
    measureCounts();
  }, [measureCounts]);
  const rafId = useRef<number | null>(null);
  const countRafRef = useRef<number | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const above = aboveCount;
  const below = belowCount;
  if (d.collapsed) {
    return (
      <div
        style={{ width: d.width, height: d.height, opacity }}
        className={`flex cursor-pointer flex-col justify-center rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] shadow-sm dark:border-zinc-700 dark:bg-zinc-900${hoverRing}`}
        onMouseEnter={() => d.onHover(d.id)}
        onMouseLeave={() => d.onHover(null)}
      >
        <Handle type="target" position={Position.Left} />
        <div className="truncate font-medium">{d.label}</div>
        <div className="font-mono text-[8px] text-zinc-500">
          {d.fileCount} files · <span className="text-green-600 dark:text-green-400">←{d.fanIn}</span>  <span className="text-amber-600 dark:text-amber-400">{d.fanOut}→</span>
          {d.activeCategory ? <span className="ml-1 text-blue-600 dark:text-blue-400">{d.categoryMatchCount}/{d.fileCount}</span> : null}
        </div>
        <Handle type="source" position={Position.Right} />
      </div>
    );
  }
  const shown = d.files.slice(0, MAX_ROWS);
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        d.onSelect(d.id);
      }}
      style={{ width: d.width, opacity }}
      className="flex flex-col overflow-hidden rounded border border-zinc-300 bg-white text-[11px] shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
    >
      <Handle type="target" position={Position.Left} id="__node__" />
      <div
        onClick={(e) => {
          e.stopPropagation();
          d.onToggle(d.id);
          d.onSelect(d.id);
        }}
        className={`flex cursor-pointer items-center justify-between gap-2 border-b border-zinc-200 px-2 py-1 font-medium dark:border-zinc-800 ${d.hovered === d.id ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}
        onMouseEnter={() => d.onHover(d.id)}
        onMouseLeave={() => d.onHover(null)}
      >
        <span className="truncate">{d.label}</span>
        <span className="shrink-0 font-mono text-[8px] text-zinc-500">
          {d.fileCount} · <span className="text-green-600 dark:text-green-400">←{d.fanIn}</span>  <span className="text-amber-600 dark:text-amber-400">{d.fanOut}→</span>
          {d.activeCategory ? <span className="ml-1 text-blue-600 dark:text-blue-400">{d.categoryMatchCount}/{d.fileCount}</span> : null}
        </span>
      </div>
      <div className="relative min-h-[14px] px-2 py-0.5 font-mono text-[10px] text-zinc-500">{above > 0 ? `${above} files above` : ""}
        <Handle type="target" position={Position.Left} id="__above__" style={{ opacity: 0, background: "transparent", border: "none", width: 4, height: 4 }} />
        <Handle type="source" position={Position.Right} id="__above__" style={{ opacity: 0, background: "transparent", border: "none", width: 4, height: 4 }} />
      </div>
      <div ref={scrollRef} className={d.files.length < 25 ? "flex-1 min-h-0 flex flex-col overflow-y-auto overflow-x-hidden no-scrollbar" : "h-[332px] flex flex-col overflow-y-auto overflow-x-hidden no-scrollbar"} onWheelCapture={(e) => e.stopPropagation()} onScroll={() => {
  if (rafId.current) cancelAnimationFrame(rafId.current);
  rafId.current = requestAnimationFrame(() => d.onUpdateInternals?.(d.id));
  if (countRafRef.current) cancelAnimationFrame(countRafRef.current);
  countRafRef.current = requestAnimationFrame(() => measureCounts());
}}>
        {shown.map((f, idx) => {
          const short = f.split("/").pop()!;
          return (
            <div
              ref={idx === 0 ? rowRef : undefined}
              data-file={f}
              key={f}
              onClick={(e) => {
                e.stopPropagation();
                d.onSelectFile(f);
              }}
              onMouseEnter={() => d.onHover(f)}
              onMouseLeave={() => d.onHover(null)}
              className={`relative flex items-center justify-between px-2 py-0 hover:bg-zinc-100 dark:hover:bg-zinc-800 ${d.selected === f ? "bg-zinc-200 dark:bg-zinc-700 sticky top-0 bottom-0 z-10" : ""} ${d.hovered === f ? "bg-blue-50 dark:bg-blue-950" : ""} ${d.selected !== null && d.selected !== f && !d.connectedFiles.has(f) ? "opacity-30" : ""}`}
            >
              <Handle type="target" position={Position.Left} id={f} style={{ opacity: 0 }} />
              <Handle type="source" position={Position.Right} id={f} style={{ opacity: 0 }} />
              <span className="truncate font-mono text-[10px]">{short}</span>
              <span className="shrink-0 font-mono text-[8px] text-zinc-500">
                <span className="text-green-600 dark:text-green-400">←{d.fileStats[f]?.fanIn ?? 0}</span>  <span className="text-amber-600 dark:text-amber-400">{d.fileStats[f]?.fanOut ?? 0}→</span>
              </span>
            </div>
          );
        })}

      </div>
      <div className="relative min-h-[14px] px-2 py-0.5 font-mono text-[10px] text-zinc-500">{below > 0 ? `${below} files below` : ""}
        <Handle type="target" position={Position.Left} id="__below__" style={{ opacity: 0, background: "transparent", border: "none", width: 4, height: 4 }} />
        <Handle type="source" position={Position.Right} id="__below__" style={{ opacity: 0, background: "transparent", border: "none", width: 4, height: 4 }} />
      </div>
      <Handle type="source" position={Position.Right} id="__node__" />
    </div>
  );
}

const nodeTypes = { folder: FolderNode };

/** Auto-generated docstring. */
function Inner({ data, selected, onSelect, hovered, onHover, activeCategory }: MapCanvasProps) {
  const updateNodeInternals = useUpdateNodeInternals();
  const { fitView } = useReactFlow();

  const surviving = useMemo(() => foldDirectories(data.files), [data]);
  const survivingSet = useMemo(() => new Set(surviving), [surviving]);
  const nodesInfo = useMemo(() => buildFoldedNodes(data.files, surviving), [data, surviving]);
  const labels = useMemo(() => uniqueLabels(nodesInfo.map((n) => ({ id: n.id, dir: n.dir }))), [nodesInfo]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [visibilityMap, setVisibilityMap] = useState<Map<string, Map<string, "above" | "below" | "visible">>>(new Map());
  const toggle = useCallback((id: string) => {
      setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    // update selection outside state updater
    if (open.has(id)) onSelect(null);
    else onSelect(id);
  }, [open, onSelect]);

  const selectFile = useCallback((file: string) => {
    onSelect(selected === file ? null : file);
  }, [selected, onSelect]);



  const autoOpenedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!selected || !data.files.some((f) => f.path === selected)) {
      // collapse auto-opened on deselect
      setOpen((prev) => {
        let changed = false;
        const next = new Set(prev);
        for (const id of autoOpenedRef.current) {
          if (next.has(id)) { next.delete(id); changed = true; }
        }
        return changed ? next : prev;
      });
      autoOpenedRef.current = new Set();
      return;
    }
    const dirs = new Set<string>();
    dirs.add(directoryOf(selected));
    for (const e of data.edges) {
      if (e.from === selected) dirs.add(directoryOf(e.to));
      if (e.to === selected) dirs.add(directoryOf(e.from));
    }
    const newFolderIds = new Set<string>();
    for (const dir of dirs) {
      const folder = nearestSurviving(dir, survivingSet);
      newFolderIds.add(folder === "" ? "__root__" : folder);
    }
    const t1 = window.setTimeout(() => {
      setOpen((prev) => {
        let changed = false;
        const next = new Set(prev);
        // collapse previously auto-opened not in new set
        for (const id of autoOpenedRef.current) {
          if (!newFolderIds.has(id) && next.has(id)) {
            next.delete(id);
            changed = true;
          }
        }
        for (const id of newFolderIds) {
          if (!next.has(id)) {
            next.add(id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
      autoOpenedRef.current = newFolderIds;
    }, 0);
    const t2 = window.setTimeout(() => {
      const el = document.querySelector(`[data-file="${CSS.escape(selected)}"]`);
      if (el) el.scrollIntoView({ block: "nearest", inline: "nearest" });
    }, 150);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [selected, data.files, data.edges, survivingSet]);

  const roleByPath = useMemo(() => new Map(data.files.map((f) => [f.path, f.role])), [data]);
  const fileStats = useMemo(
    () => Object.fromEntries(data.files.map((f) => [f.path, { fanIn: f.fanIn, fanOut: f.fanOut }])),
    [data.files],
  );
  const connectedFiles = useMemo(() => {
    const set = new Set<string>();
    if (!selected) return set;
    if (data.files.some((f) => f.path === selected)) {
      set.add(selected);
    }
    for (const e of data.edges) {
      if (e.from === selected || e.to === selected) {
        set.add(e.from);
        set.add(e.to);
      }
      // if selected is a folder, include edges of its files
    }
    // if selected is a folder id, include all files in connected folders? keep file-level endpoints of edges where either endpoint's folder == selected
    if (!data.files.some((f) => f.path === selected)) {
      for (const e of data.edges) {
        const fromDir = nearestSurviving(directoryOf(e.from), survivingSet);
        const toDir = nearestSurviving(directoryOf(e.to), survivingSet);
        const fromId = fromDir === "" ? "__root__" : fromDir;
        const toId = toDir === "" ? "__root__" : toDir;
        if (fromId === selected || toId === selected) {
          set.add(e.from);
          set.add(e.to);
        }
      }
    }
    return set;
  }, [selected, data, survivingSet]);
const connectedNodes = useMemo(() => {
    const set = new Set<string>();
    if (!selected) return set;
    for (const e of data.edges) {
      const fromDir = nearestSurviving(directoryOf(e.from), survivingSet);
      const toDir = nearestSurviving(directoryOf(e.to), survivingSet);
      const fromId = fromDir === "" ? "__root__" : fromDir;
      const toId = toDir === "" ? "__root__" : toDir;
      if (fromId === toId) continue;
      if (e.from === selected || e.to === selected || fromId === selected || toId === selected) {
        set.add(fromId);
        set.add(toId);
      }
    }
    if (data.files.some((f) => f.path === selected)) {
      const f = data.files.find((x) => x.path === selected);
      if (f) {
        const d = nearestSurviving(directoryOf(f.path), survivingSet);
        set.add(d === "" ? "__root__" : d);
      }
    } else {
      set.add(selected);
    }
    return set;
  }, [selected, data, survivingSet]);

  const connectedEdgeKeys = useMemo(() => {
    const set = new Set<string>();
    if (!selected) return set;
    for (const e of data.edges) {
      const fromDir = nearestSurviving(directoryOf(e.from), survivingSet);
      const toDir = nearestSurviving(directoryOf(e.to), survivingSet);
      const fromId = fromDir === "" ? "__root__" : fromDir;
      const toId = toDir === "" ? "__root__" : toDir;
      if (fromId === toId) continue;
      if (!(e.from === selected || e.to === selected || fromId === selected || toId === selected)) continue;
      let srcHandle: string | null = open.has(fromId) ? "__node__" : null;
      if (srcHandle === "__node__" && (e.from === selected || e.to === selected)) { const v = visibilityMap.get(fromId)?.get(e.from); srcHandle = v === "above" ? "__above__" : v === "below" ? "__below__" : e.from; }
      let tgtHandle: string | null = open.has(toId) ? "__node__" : null;
      if (tgtHandle === "__node__" && (e.from === selected || e.to === selected)) { const v = visibilityMap.get(toId)?.get(e.to); tgtHandle = v === "above" ? "__above__" : v === "below" ? "__below__" : e.to; }
      set.add(`${fromId}|${srcHandle}|${toId}|${tgtHandle}`);
    }
    return set;
  }, [selected, open, data, survivingSet, visibilityMap]);

  const incomingEdgeKeys = useMemo(() => {
    const set = new Set<string>();
    if (!selected) return set;
    const selIsFile = data.files.some((f) => f.path === selected);
    for (const e of data.edges) {
      const fromDir = nearestSurviving(directoryOf(e.from), survivingSet);
      const toDir = nearestSurviving(directoryOf(e.to), survivingSet);
      const fromId = fromDir === "" ? "__root__" : fromDir;
      const toId = toDir === "" ? "__root__" : toDir;
      if (fromId === toId) continue;
      if (!(e.from === selected || e.to === selected || fromId === selected || toId === selected)) continue;
      const incoming = selIsFile ? e.to === selected : toId === selected;
      if (!incoming) continue;
      let srcHandle: string | null = open.has(fromId) ? "__node__" : null;
      if (srcHandle === "__node__" && (e.from === selected || e.to === selected)) { const v = visibilityMap.get(fromId)?.get(e.from); srcHandle = v === "above" ? "__above__" : v === "below" ? "__below__" : e.from; }
      let tgtHandle: string | null = open.has(toId) ? "__node__" : null;
      if (tgtHandle === "__node__" && (e.from === selected || e.to === selected)) { const v = visibilityMap.get(toId)?.get(e.to); tgtHandle = v === "above" ? "__above__" : v === "below" ? "__below__" : e.to; }
      set.add(`${fromId}|${srcHandle}|${toId}|${tgtHandle}`);
    }
    return set;
  }, [selected, open, data, survivingSet, visibilityMap]);

  const outgoingEdgeKeys = useMemo(() => {
    const set = new Set<string>();
    if (!selected) return set;
    const selIsFile = data.files.some((f) => f.path === selected);
    for (const e of data.edges) {
      const fromDir = nearestSurviving(directoryOf(e.from), survivingSet);
      const toDir = nearestSurviving(directoryOf(e.to), survivingSet);
      const fromId = fromDir === "" ? "__root__" : fromDir;
      const toId = toDir === "" ? "__root__" : toDir;
      if (fromId === toId) continue;
      if (!(e.from === selected || e.to === selected || fromId === selected || toId === selected)) continue;
      const outgoing = selIsFile ? e.from === selected : fromId === selected;
      if (!outgoing) continue;
      let srcHandle: string | null = open.has(fromId) ? "__node__" : null;
      if (srcHandle === "__node__" && (e.from === selected || e.to === selected)) { const v = visibilityMap.get(fromId)?.get(e.from); srcHandle = v === "above" ? "__above__" : v === "below" ? "__below__" : e.from; }
      let tgtHandle: string | null = open.has(toId) ? "__node__" : null;
      if (tgtHandle === "__node__" && (e.from === selected || e.to === selected)) { const v = visibilityMap.get(toId)?.get(e.to); tgtHandle = v === "above" ? "__above__" : v === "below" ? "__below__" : e.to; }
      set.add(`${fromId}|${srcHandle}|${toId}|${tgtHandle}`);
    }
    return set;
  }, [selected, open, data, survivingSet, visibilityMap]);

  const structuralNodes: Node[] = useMemo(() => {
    return nodesInfo.map((n) => {
      const collapsed = !open.has(n.id);
      const label = labels.get(n.id) ?? n.id;
      let width: number;
      let height: number;
      if (collapsed) {
        width = Math.max(120, label.length * 7 + 24);
        height = Math.max(44, 40 + Math.min(n.fanIn, 60));
      } else {
        const visibleRows = Math.min(n.files.length, MAX_ROWS);
        const longest = n.files.reduce((m, f) => Math.max(m, (f.split("/").pop() ?? "").length), 0);
        width = Math.max(200, longest * 7 + 60);
        height = Math.min(MAX_PANEL_HEIGHT, 20 + visibleRows * 14 + (n.files.length > MAX_ROWS ? 14 : 0) + 2);
      }
      const categoryMatchCount = activeCategory
        ? n.files.filter((p) => {
            const role = roleByPath.get(p) ?? null;
            const key = role ? role : "Unclassified";
            return (key || "Unclassified") === activeCategory;
          }).length
        : 0;
      const dimmed = false;
      return {
        id: n.id,
        type: "folder",
        position: { x: 0, y: 0 },
        data: {
          id: n.id,
          label,
          collapsed,
          files: n.files,
          fileCount: n.fileCount,
          fanIn: n.fanIn,
          fanOut: n.fanOut,
          width,
          height,
          dimmed,
          categoryMatchCount,
          activeCategory: activeCategory ?? null,
          fileStats,
          connectedFiles: new Set<string>(),
          selected: null,
          hovered: null,
          onToggle: toggle,
          onSelect,
          onSelectFile: selectFile,
          onHover,
          onUpdateInternals: (id: string) => updateNodeInternals(id),
          onVisibilityChange: (id: string, vis: Map<string, "above" | "below" | "visible">) => {
            setVisibilityMap((prev) => {
              const old = prev.get(id);
              if (old && old.size === vis.size && [...vis].every(([k, v]) => old.get(k) === v)) return prev;
              const next = new Map(prev);
              next.set(id, vis);
              return next;
            });
          },
        },
        width,
        height,
      };
    });
  }, [nodesInfo, open, labels, toggle, selectFile, fileStats, updateNodeInternals, onHover, onSelect, activeCategory, roleByPath]);

  const baseEdges: RFEdge[] = useMemo(() => {
    const seen = new Set<string>();
    const out: RFEdge[] = [];
    for (const e of data.edges) {
      const fromDir = nearestSurviving(directoryOf(e.from), survivingSet);
      const toDir = nearestSurviving(directoryOf(e.to), survivingSet);
      const fromId = fromDir === "" ? "__root__" : fromDir;
      const toId = toDir === "" ? "__root__" : toDir;
      if (fromId === toId) continue;
      const srcHandle = open.has(fromId) ? "__node__" : null;
      const tgtHandle = open.has(toId) ? "__node__" : null;
      const key = `${fromId}|${srcHandle}|${toId}|${tgtHandle}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: key,
        source: fromId,
        target: toId,
        sourceHandle: srcHandle,
        targetHandle: tgtHandle,
        style: { opacity: 0.9, strokeWidth: 1, stroke: "#94a3b8" },
      });
    }
    return out;
  }, [data, open, survivingSet]);

  const layouted = useMemo(() => {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: "LR", nodesep: 40, ranksep: 60 });
    g.setDefaultEdgeLabel(() => ({}));
    for (const n of structuralNodes) {
      g.setNode(n.id, { width: n.width ?? 120, height: n.height ?? 40 });
    }
    for (const e of baseEdges) {
      g.setEdge(e.source, e.target);
    }
    dagre.layout(g);
    const nodes = structuralNodes.map((n) => {
      const pos = g.node(n.id);
      return { ...n, position: { x: pos.x - (n.width ?? 0) / 2, y: pos.y - (n.height ?? 0) / 2 } };
    });
    return { nodes };
  }, [structuralNodes, baseEdges]);

  const displayNodes = useMemo(() => {
    const activeNodeIds = new Set<string>();
    if (activeCategory) {
      for (const n of layouted.nodes) {
        if (((n.data as { categoryMatchCount?: number }).categoryMatchCount ?? 0) > 0) activeNodeIds.add(n.id);
      }
    }
    return layouted.nodes.map((n) => {
      const selectedDimmed = selected !== null && !connectedNodes.has(n.id);
      const categoryDimmed = activeCategory !== null && !activeNodeIds.has(n.id);
      const dimmed = selectedDimmed || categoryDimmed;
      return {
        ...n,
        data: {
          ...n.data,
          dimmed,
          connectedFiles,
          selected,
          activeCategory: activeCategory ?? null,
        },
      };
    });
  }, [layouted.nodes, selected, connectedNodes, connectedFiles, activeCategory]);

  const hoveredNodes = useMemo(
    () => displayNodes.map((n) => ({ ...n, data: { ...n.data, hovered } })),
    [displayNodes, hovered],
  );

  const displayEdges: RFEdge[] = useMemo(() => {
    const categoryNodeIds = new Set<string>();
    if (activeCategory) {
      for (const n of nodesInfo) {
        const match = n.files.some((f) => {
          const role = roleByPath.get(f) ?? null;
          const key = role ? role : "Unclassified";
          return (key || "Unclassified") === activeCategory;
        });
        if (match) categoryNodeIds.add(n.id);
      }
    }
    const seen = new Set<string>();
    const out: RFEdge[] = [];
    for (const e of data.edges) {
      const fromDir = nearestSurviving(directoryOf(e.from), survivingSet);
      const toDir = nearestSurviving(directoryOf(e.to), survivingSet);
      const fromId = fromDir === "" ? "__root__" : fromDir;
      const toId = toDir === "" ? "__root__" : toDir;
      if (fromId === toId) continue;
      let srcHandle: string | null = open.has(fromId) ? "__node__" : null;
      if (srcHandle === "__node__" && (e.from === selected || e.to === selected)) { const v = visibilityMap.get(fromId)?.get(e.from); srcHandle = v === "above" ? "__above__" : v === "below" ? "__below__" : e.from; }
      let tgtHandle: string | null = open.has(toId) ? "__node__" : null;
      if (tgtHandle === "__node__" && (e.from === selected || e.to === selected)) { const v = visibilityMap.get(toId)?.get(e.to); tgtHandle = v === "above" ? "__above__" : v === "below" ? "__below__" : e.to; }
      const key = `${fromId}|${srcHandle}|${toId}|${tgtHandle}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const bright = connectedEdgeKeys.has(key);
      let stroke = "#94a3b8";
      if (selected && bright) {
        if (incomingEdgeKeys.has(key)) stroke = "#10b981";
        else if (outgoingEdgeKeys.has(key)) stroke = "#f59e0b";
      }
      const selectedDimmed = selected !== null && !bright;
      const categoryDimmed = activeCategory !== null && !(categoryNodeIds.has(fromId) && categoryNodeIds.has(toId));
      const dimmed = selectedDimmed || categoryDimmed;
      out.push({
        id: key,
        source: fromId,
        target: toId,
        sourceHandle: srcHandle,
        targetHandle: tgtHandle,
        style: { opacity: dimmed ? 0.15 : 0.9, strokeWidth: 1, stroke },
      });
    }
    return out;
  }, [data, open, survivingSet, selected, connectedEdgeKeys, incomingEdgeKeys, outgoingEdgeKeys, visibilityMap, activeCategory, nodesInfo, roleByPath]);

  useEffect(() => {
    for (const id of open) updateNodeInternals(id);
  }, [selected, open, visibilityMap, updateNodeInternals]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => fitView({ padding: 0.1 }));
    return () => cancelAnimationFrame(raf);
  }, [open, fitView]);


  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={hoveredNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        onPaneClick={() => onSelect(null)}
        onNodeClick={(_, node) => {
          if (open.has(node.id)) onSelect(node.id);
          else toggle(node.id);
        }}
        onNodeMouseEnter={(_, node) => onHover(node.id)}
        onNodeMouseLeave={() => onHover(null)}
        fitView
        minZoom={0.1}
      >
        <Background gap={16} size={1} />
      </ReactFlow>
    </div>
  );
}

/** Auto-generated docstring. */
export function MapCanvas({ data, selected, onSelect, hovered, onHover, activeCategory = null }: MapCanvasProps) {
  return (
    <ReactFlowProvider>
      <Inner data={data} selected={selected} onSelect={onSelect} hovered={hovered} onHover={onHover} activeCategory={activeCategory} />
    </ReactFlowProvider>
  );
}