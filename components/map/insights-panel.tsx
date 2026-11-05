"use client";

import { useMemo, useState } from "react";

import type { ParseResult } from "@/parser/types";
import { computeInsights, type Insight } from "@/lib/insights";

type InsightsPanelProps = {
  data: ParseResult;
  onSelectFile?: (path: string) => void;
};

export function InsightsPanel({ data, onSelectFile }: InsightsPanelProps) {
  const [open, setOpen] = useState(false);
  const insights = useMemo(() => computeInsights(data), [data]);

  const groups: { kind: Insight["kind"]; label: string; items: Insight[] }[] = [
    { kind: "nothing-imports", label: "Nothing imports or reaches", items: insights.filter((i) => i.kind === "nothing-imports") },
    { kind: "unusual-imports", label: "Imported unusually often", items: insights.filter((i) => i.kind === "unusual-imports") },
    { kind: "cycle", label: "Import loops", items: insights.filter((i) => i.kind === "cycle") },
    { kind: "too-long", label: "Long files", items: insights.filter((i) => i.kind === "too-long") },
  ];

  return (
    <div className="border-t border-zinc-200 pt-2 dark:border-zinc-800">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-1 py-1 font-mono text-[10px] uppercase tracking-wide text-zinc-500"
      >
        <span>Insights</span>
        <span className="flex items-center gap-1">
          <span>{insights.length}</span>
          <span>{open ? "−" : "+"}</span>
        </span>
      </button>
      {open ? (
        <div className="flex max-h-64 flex-col gap-2 overflow-y-auto px-1 py-1">
          {groups.map((g) =>
            g.items.length === 0 ? null : (
              <div key={g.kind} className="flex flex-col gap-0.5">
                <div className="font-mono text-[9px] uppercase tracking-wide text-zinc-400">
                  {g.label} ({g.items.length})
                </div>
                {g.items.map((ins, i) => (
                  <button
                    key={`${ins.kind}-${i}`}
                    type="button"
                    onClick={() => onSelectFile?.(ins.path)}
                    className="block truncate text-left font-mono text-[10px] text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
                    title={ins.detail ?? ins.sentence}
                  >
                    {ins.sentence}
                  </button>
                ))}
              </div>
            ),
          )}
          {insights.length === 0 ? (
            <p className="font-mono text-[10px] text-zinc-500">No insights.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}