"use client";

import { useMemo, useState } from "react";

import type { ParseResult } from "@/parser/types";
import { MapCanvas } from "@/components/map/map-canvas";
import { DetailPane } from "@/components/map/detail-pane";
import { ALL_FRAMEWORK_CATEGORIES } from "@/lib/rail-taxonomy";

const CATEGORY_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

type CanvasShellProps = { data: ParseResult; analysisId?: string };

export function CanvasShell({ data, analysisId }: CanvasShellProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"structure" | "explanation">("structure");
  const graphRelevantTotal = data.coverage.resolvedInternal + data.coverage.unresolved;
  const coveragePercent =
    graphRelevantTotal === 0
      ? 100
      : (data.coverage.resolvedInternal / graphRelevantTotal) * 100;
  const showBanner = data.coverage.unresolved > 0;

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [bannerCollapsed, setBannerCollapsed] = useState(false);
  const [centreView, setCentreView] = useState<"map" | "routes">("map");

  const categories = useMemo(() => {
    const master = ALL_FRAMEWORK_CATEGORIES;
    const counts = new Map<string, number>();
    for (const file of data.files) {
      let key: string | null = file.role;
      if (!key || !master.includes(key)) key = "Unclassified";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const orderedKeys = master;

    return orderedKeys.map((name, i) => ({
      name,
      count: counts.get(name) ?? 0,
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    }));
  }, [data]);

  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden text-xs">
      {/* Left rail */}
      <aside className="flex w-44 shrink-0 flex-col gap-1 border-r border-zinc-200 p-2 dark:border-zinc-800">
        <div className="px-1 py-1 font-mono text-[10px] tracking-wide text-zinc-500">
          Categories · {data.summary.filesParsed} files
        </div>
        {categories.map((c) => (
          <button
            key={c.name}
            type="button"
            onClick={() => setActiveCategory((prev) => (prev === c.name ? null : c.name))}
            className={`flex w-full items-center gap-2 rounded px-1 py-1 text-left text-zinc-700 dark:text-zinc-300 ${activeCategory === c.name ? "bg-zinc-200 dark:bg-zinc-700" : ""}`}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: c.color }}
            />
            <span className="truncate">{c.name}</span>
            <span className="ml-auto font-mono text-zinc-500">{c.count}</span>
          </button>
        ))}
      </aside>

      {/* Middle: map */}
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {showBanner ? (
          <div className="border-b border-amber-300 bg-amber-50 px-3 py-1 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
            <button
              type="button"
              className="font-mono"
              onClick={() => setBannerCollapsed((v) => !v)}
            >
              {bannerCollapsed ? "Partial graph" : "Partial graph —"}{" "}
              {coveragePercent.toFixed(0)}% of graph-relevant imports resolved
              {bannerCollapsed ? "" : ` (${data.coverage.unresolved} unresolved)`}
            </button>
          </div>
        ) : null}
        <div className="flex shrink-0 border-b border-zinc-200 dark:border-zinc-800">
          <button type="button" onClick={() => setCentreView("map")} className={`px-3 py-1.5 text-[11px] ${centreView === "map" ? "border-b border-blue-500 text-zinc-900 dark:text-zinc-100" : "text-zinc-500"}`}>Map</button>
          <button type="button" onClick={() => setCentreView("routes")} className={`px-0 py-1.5 text-[11px] ${centreView === "routes" ? "border-b border-blue-500 text-zinc-900 dark:text-zinc-100" : "text-zinc-500"}`}>Routes&nbsp;&nbsp;{data.routes.length}</button>
        </div>
        {centreView === "map" ? (
          <div className="min-h-0 flex-1">
            <MapCanvas
              data={data}
              selected={selected}
              onSelect={setSelected}
              hovered={hovered}
              onHover={setHovered}
              activeCategory={activeCategory}
            />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto p-3">
            <p className="mb-2 text-[10px] text-zinc-500">Listed only where the method and the full path are both written in the code.</p>
            {data.routes.length === 0 ? (
              <p className="text-[11px] text-zinc-500">{data.adapter === "fallback" ? "no framework adapter" : "none extracted"}</p>
            ) : (
              <table className="w-full font-mono text-[11px]">
                <thead className="text-zinc-500">
                  <tr>
                    <th className="px-2 py-1 text-left font-normal">Method</th>
                    <th className="px-2 py-1 text-left font-normal">Path</th>
                    <th className="px-2 py-1 text-left font-normal">File</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {data.routes.map((r, i) => (
                                      <tr key={i} className={`cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 border-l-2 ${selected === r.filePath ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-b-0" : "border-transparent"}`} onClick={() => setSelected(r.filePath)}>
                      <td className="px-2 py-1 text-zinc-100">{r.method}</td>
                      <td className="px-2 py-1 text-zinc-300">{r.path}</td>
                      <td className="px-2 py-1 text-zinc-500">{r.filePath}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>

      {/* Right pane: detail */}
      <aside className="w-80 shrink-0 border-l border-zinc-200 dark:border-zinc-800">
        <DetailPane
          data={data}
          analysisId={analysisId}
          selected={selected}
          onSelect={setSelected}
          hovered={hovered}
          onHover={setHovered}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </aside>
    </div>
  );
}
