"use client";

import { useMemo, useState } from "react";

import type { ParseResult } from "@/parser/types";
import { MapCanvas } from "@/components/map/map-canvas";
import { DetailPane } from "@/components/map/detail-pane";

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

type CanvasShellProps = { data: ParseResult };

export function CanvasShell({ data }: CanvasShellProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"structure" | "explanation">("structure");
  const coveragePercent =
    data.coverage.totalImports === 0
      ? 100
      : (data.coverage.resolvedInternal / data.coverage.totalImports) * 100;
  const showBanner = coveragePercent < 95;

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [bannerCollapsed, setBannerCollapsed] = useState(false);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const file of data.files) {
      const ext = file.path.slice(file.path.lastIndexOf(".")).toLowerCase();
      const name = ext || "other";
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count], i) => ({
        name,
        count,
        color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden text-xs">
      {/* Left rail */}
      <aside className="flex w-44 shrink-0 flex-col gap-1 border-r border-zinc-200 p-2 dark:border-zinc-800">
        <div className="px-1 py-1 font-mono text-[10px] uppercase tracking-wide text-zinc-500">
          Categories
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
        <div className="mt-auto px-1 py-1 font-mono text-[10px] text-zinc-500">
          {data.summary.filesParsed} files
        </div>
      </aside>

      {/* Middle: map */}
      <main className="relative min-w-0 flex-1">
        {showBanner ? (
          <div className="border-b border-amber-300 bg-amber-50 px-3 py-1 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
            <button
              type="button"
              className="font-mono"
              onClick={() => setBannerCollapsed((v) => !v)}
            >
              {bannerCollapsed ? "Partial graph" : "Partial graph —"}{" "}
              {coveragePercent.toFixed(0)}% of imports resolved
              {bannerCollapsed ? "" : ` (${data.coverage.unresolved} unresolved)`}
            </button>
          </div>
        ) : null}
        <MapCanvas
          data={data}
          selected={selected}
          onSelect={setSelected}
          hovered={hovered}
          onHover={setHovered}
          activeCategory={activeCategory}
        />
      </main>

      {/* Right pane: detail */}
      <aside className="w-80 shrink-0 border-l border-zinc-200 dark:border-zinc-800">
        <DetailPane
          data={data}
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
