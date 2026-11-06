"use client";

import { useMemo, useState, useTransition } from "react";

import type { ParseResult, FileRecord } from "@/parser/types";
import { foldDirectories, buildFoldedNodes, blastRadius, dependencyChain } from "@/lib/graph";
import { InsightsPanel } from "@/components/map/insights-panel";
import { rerunAnalysis } from "@/app/actions";

type DetailPaneProps = {
  data: ParseResult;
  analysisId?: string;
  selected: string | null;
  onSelect: (id: string | null) => void;
  hovered: string | null;
  onHover: (id: string | null) => void;
  activeTab: "structure" | "explanation";
  onTabChange: (tab: "structure" | "explanation") => void;
};

function kindOf(path: string, file?: FileRecord): string {
  if (file?.role) return file.role;
  const idx = path.lastIndexOf(".");
  return idx === -1 ? "other" : path.slice(idx).toLowerCase();
}

export function DetailPane({
  data,
  analysisId,
  selected,
  onSelect,
  hovered,
  onHover,
  activeTab,
  onTabChange,
}: DetailPaneProps) {
  const [blastMode, setBlastMode] = useState<"dependents" | "dependencies" | null>(null);
  const fileByPath = useMemo(
    () => new Map(data.files.map((f) => [f.path, f])),
    [data],
  );

  const [pending, startTransition] = useTransition();

  const surviving = useMemo(() => foldDirectories(data.files), [data]);
  const foldedNodes = useMemo(
    () => buildFoldedNodes(data.files, surviving),
    [data, surviving],
  );

  const selectedFile = selected ? fileByPath.get(selected) ?? null : null;
  const selectedNode = selected
    ? foldedNodes.find((n) => n.id === selected) ?? null
    : null;

  const repoName = data.root.split(/[\\/]/).filter(Boolean).pop() ?? data.root;

  const mostDepended = useMemo(
    () => [...data.files].sort((a, b) => b.fanIn - a.fanIn || a.path.localeCompare(b.path)).slice(0, 10),
    [data],
  );
  const dependedCount = useMemo(
    () => data.files.filter((f) => f.fanIn > 0).length,
    [data],
  );
  const nothingImports = useMemo(
    () => data.files.filter((f) => f.fanIn === 0).sort((a, b) => b.fanOut - a.fanOut || a.path.localeCompare(b.path)),
    [data],
  );
  const unidentifiedCount = useMemo(
    () => data.files.filter((f) => f.role === null).length,
    [data],
  );

  const edgeMarkers = (from: string, to: string): string => {
    const relevant = data.edges.filter((e) => e.from === from && e.to === to);
    const labels: string[] = [];
    if (relevant.some((e) => e.kind === "reexport")) labels.push("re-export");
    if (relevant.some((e) => e.kind === "dynamic")) labels.push("dynamic");
    if (relevant.some((e) => e.typeOnly)) labels.push("type-only");
    return labels.join(" ");
  };
  const imports = useMemo(() => {
    if (!selectedFile) return [];
    const set = new Set<string>();
    for (const e of data.edges) if (e.from === selected) set.add(e.to);
    return [...set].sort();
  }, [data, selected, selectedFile]);
  const dependents = useMemo(() => {
    if (!selectedFile) return [];
    const set = new Set<string>();
    for (const e of data.edges) if (e.to === selected) set.add(e.from);
    return [...set].sort();
  }, [data, selected, selectedFile]);

  const blastList = useMemo(() => {
    if (!selectedFile || !blastMode) return null;
    const fn = blastMode === "dependents" ? blastRadius : dependencyChain;
    return fn(data.edges, selected!, 2);
  }, [selectedFile, blastMode, data, selected]);
  const folderKindCounts = useMemo(() => {
    if (!selectedNode) return [];
    const counts = new Map<string, number>();
    for (const p of selectedNode.files) {
      const k = kindOf(p, fileByPath.get(p));
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [selectedNode, fileByPath]);

  function PathButton({ path }: { path: string }) {
    const isHovered = hovered === path;
    const lastSlash = path.lastIndexOf("/");
    const dir = lastSlash === -1 ? "" : path.slice(0, lastSlash);
    const name = lastSlash === -1 ? path : path.slice(lastSlash + 1);
    let shortDir = dir;
    const maxTotal = 38;
    const maxDir = Math.max(6, maxTotal - name.length - 1);
    if (dir.length > maxDir) {
      shortDir = dir.slice(0, Math.max(4, maxDir - 3)) + "...";
    }
    return (
      <button
        type="button"
        onClick={() => onSelect(path)}
        onMouseEnter={() => onHover(path)}
        onMouseLeave={() => onHover(null)}
        className={`block w-full whitespace-nowrap text-left font-mono text-[11px] border-l-4 pl-2 ${selected === path ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : isHovered ? "border-transparent bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "border-transparent"}`}
        title={path}
      >
        {dir ? (
          <>
            <span className="text-zinc-500">{shortDir}{shortDir !== dir ? " " : "/"}</span>
            <span className="text-zinc-100">{name}</span>
          </>
        ) : (
          <span className="text-zinc-100">{name}</span>
        )}
      </button>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden text-xs">
      {selected ? (
        <>
          {selectedNode ? (
            <div className="shrink-0 border-b border-l-4 border-blue-500 border-zinc-200 px-2 py-1 dark:border-zinc-800">
              <div className="font-mono text-[10px] text-zinc-500">folder</div>
              <div className="font-mono text-[11px] font-bold text-zinc-100">
                {selectedNode.id === "__root__" ? "root" : selectedNode.dir + "/"}
              </div>
            </div>
          ) : selectedFile ? (
            <div className="shrink-0 border-b border-l-4 border-blue-500 border-zinc-200 px-2 py-1 dark:border-zinc-800">
              <div className="font-mono text-[10px] text-zinc-500">file</div>
              <div className="font-mono text-[11px] font-bold text-zinc-100">{selectedFile.path}</div>
            </div>
          ) : null}
          <div className="flex shrink-0 border-b border-zinc-200 dark:border-zinc-800">
            <button
            type="button"
            onClick={() => onTabChange("structure")}
            className={`px-3 py-1.5 text-[11px] ${activeTab === "structure" ? "border-b-2 border-blue-500 text-zinc-900 dark:text-zinc-100" : "text-zinc-500"}`}
          >
            Structure
          </button>
          <button
            type="button"
            onClick={() => onTabChange("explanation")}
            className={`px-3 py-1.5 text-[11px] ${activeTab === "explanation" ? "border-b-2 border-blue-500 text-zinc-900 dark:text-zinc-100" : "text-zinc-500"}`}
          >
            Explanation
          </button>
        </div>
      </>
    ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {!selected ? (
          <div className="flex flex-col gap-3">
            <div className="font-mono text-[11px] text-zinc-900 dark:text-zinc-100">{repoName}</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="border border-zinc-800 p-2">
                <div className="font-mono text-[10px] text-zinc-500">Files</div>
                <div className="font-mono text-[12px] text-zinc-100">{data.summary.filesParsed}</div>
                <div className="font-mono text-[9px] text-zinc-500">{data.summary.filesSkipped} skipped</div>
              </div>
              <div className="border border-zinc-800 p-2">
                <div className="font-mono text-[10px] text-zinc-500">Imports</div>
                <div className="font-mono text-[12px] text-zinc-100">{data.coverage.totalImports}</div>
                <div className="font-mono text-[9px] text-zinc-500">{data.coverage.unresolved} unresolved</div>
              </div>
              <div className="border border-zinc-800 p-2">
                <div className="font-mono text-[10px] text-zinc-500">Routes</div>
                <div className="font-mono text-[12px] text-zinc-100">
                  {data.adapter === "fallback" ? "—" : data.routes.length}
                </div>
                <div className="font-mono text-[9px] text-zinc-500">
                  {data.adapter === "fallback" ? "no framework adapter" : "extracted"}
                </div>
              </div>
            </div>
            <div className="font-mono text-[10px] text-zinc-500">
              framework: {data.adapter === "fallback" ? "none detected" : data.adapter}
            </div>
            <div className="font-mono text-[10px] text-zinc-500">
              no framework adapter
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-zinc-500">
                <span>Most depended on by files importing it</span>
                <span>{dependedCount}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                {mostDepended.map((f) => (
                  <div key={f.path} className="flex min-w-0 items-center gap-2">
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <PathButton path={f.path} />
                    </div>
                    <span className="shrink-0 font-mono text-[10px] text-green-600 dark:text-green-400">←{f.fanIn}</span>
                  </div>
                ))}
              </div>
              {dependedCount > mostDepended.length ? (
                <div className="mt-1 font-mono text-[10px] text-zinc-500">
                  {dependedCount - mostDepended.length} more not listed
                </div>
              ) : null}
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-zinc-500">
                <span>Imported by nothing where reading starts</span>
                <span>{nothingImports.length}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                {nothingImports.slice(0, 10).map((f) => (
                  <div key={f.path} className="flex min-w-0 items-center gap-2">
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <PathButton path={f.path} />
                    </div>
                    <span className="shrink-0 font-mono text-[10px] text-amber-600 dark:text-amber-400">{f.fanOut}{"→"}</span>
                  </div>
                ))}
              </div>
              {nothingImports.length > 10 ? (
                <div className="mt-1 font-mono text-[10px] text-zinc-500">
                  {nothingImports.length - 10} more not listed
                </div>
              ) : null}
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-zinc-500">
                <span>Unidentified by convention</span>
                <span>{unidentifiedCount}</span>
              </div>
              <div className="font-mono text-[10px] text-zinc-500">
                {data.adapter === "fallback" ? "No framework adapter applied, so no file was matched to a role." : "Files no convention matched."}
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-zinc-500">
                <span>Routes</span>
                <span>{data.routes.length}</span>
              </div>
              {data.routes.length === 0 ? (
                <p className="text-[11px] text-zinc-500">
                  {data.adapter === "fallback" ? "no framework adapter" : "none extracted"}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full font-mono text-[10px]">
                    <thead className="text-zinc-500">
                      <tr>
                        <th className="px-1 py-0.5 text-left font-normal">Method</th>
                        <th className="px-1 py-0.5 text-left font-normal">Path</th>
                        <th className="px-1 py-0.5 text-left font-normal">File</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {data.routes.map((r, i) => (
                        <tr key={`${r.method}-${r.path}-${i}`}>
                          <td className="px-1 py-0.5 text-zinc-100">{r.method}</td>
                          <td className="px-1 py-0.5 text-zinc-300">{r.path}</td>
                          <td className="px-1 py-0.5">
                            <button
                              type="button"
                              onClick={() => onSelect(r.filePath)}
                              className="truncate text-left text-zinc-500 hover:text-zinc-100"
                              title={r.filePath}
                            >
                              {r.filePath}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {analysisId ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => rerunAnalysis(analysisId))}
                className="w-fit border border-zinc-300 px-3 py-1 text-[11px] dark:border-zinc-700"
              >
                {pending ? "Starting…" : "Re-run"}
              </button>
            ) : null}
            <InsightsPanel data={data} onSelectFile={onSelect} />
          </div>
        ) : activeTab === "explanation" ? (
          <p className="text-[11px] text-zinc-500">
            Nothing fills this yet. An explanation appears here once there is a model call to fill it with.
          </p>
        ) : selectedFile ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className="text-zinc-500">Kind</span>
                <span className="h-2.5 w-2.5 rounded-sm bg-zinc-600" />
                <span className="text-zinc-100">{kindOf(selectedFile.path, selectedFile)}</span>
              </div>
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-zinc-500">Folder</span>
                <span className="text-zinc-100">
                  {selectedFile.path.includes("/") ? selectedFile.path.slice(0, selectedFile.path.lastIndexOf("/")) : "(root)"}
                </span>
              </div>
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-zinc-500">Length</span>
                <span className="text-zinc-100">{selectedFile.lines} lines</span>
              </div>
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-zinc-500">Depends on</span>
                <span className="text-amber-600 dark:text-amber-400">{imports.length} files</span>
              </div>
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-zinc-500">Depended on by</span>
                <span className="text-green-600 dark:text-green-400">{dependents.length} files</span>
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center gap-2 font-mono text-[10px] text-zinc-500">
                <span>Blast radius / dependency chain (2 levels)</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setBlastMode(blastMode === "dependents" ? null : "dependents")}
                  className={`border px-2 py-1 font-mono text-[10px] ${blastMode === "dependents" ? "border-blue-500 text-blue-600" : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"}`}
                >
                  Blast radius
                </button>
                <button
                  type="button"
                  onClick={() => setBlastMode(blastMode === "dependencies" ? null : "dependencies")}
                  className={`border px-2 py-1 font-mono text-[10px] ${blastMode === "dependencies" ? "border-blue-500 text-blue-600" : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"}`}
                >
                  Dependency chain
                </button>
              </div>
              {blastMode && blastList ? (
                <div className="mt-1 flex flex-col gap-1">
                  {blastList.levels.every((l) => l.length === 0) ? (
                    <p className="text-[11px] text-zinc-500">none</p>
                  ) : (
                    blastList.levels.map((level, i) =>
                      level.length === 0 ? null : (
                        <div key={i} className="flex flex-col gap-0.5">
                          <div className="font-mono text-[9px] tracking-wide text-zinc-400">
                            {i + 1} step{i === 0 ? "" : "s"} away · {level.length}
                          </div>
                          {level.map((p) => (
                            <div key={p} className="flex min-w-0 items-center gap-2">
                              <div className="min-w-0 flex-1 overflow-hidden">
                                <PathButton path={p} />
                              </div>
                            </div>
                          ))}
                        </div>
                      ),
                    )
                  )}
                  {blastList.beyond > 0 ? (
                    <div className="font-mono text-[9px] text-zinc-500">
                      {blastList.beyond} more files further out
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-zinc-500">
                <span>Imports</span>
                <span className="text-amber-600 dark:text-amber-400">{imports.length}{"→"}</span>
              </div>
              {imports.length === 0 ? (
                <p className="text-[11px] text-zinc-500">none</p>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {imports.map((p) => (
                    <div key={p} className="flex min-w-0 items-center gap-2">
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <PathButton path={p} />
                      </div>
                      <span className="shrink-0 font-mono text-[9px] text-zinc-500">
                        {edgeMarkers(selected!, p)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-zinc-500">
                <span>Imported by</span>
                <span className="text-green-600 dark:text-green-400">{"←"}{dependents.length}</span>
              </div>
              {dependents.length === 0 ? (
                <p className="text-[11px] text-zinc-500">none</p>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {dependents.map((p) => (
                    <div key={p} className="flex min-w-0 items-center gap-2">
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <PathButton path={p} />
                      </div>
                      <span className="shrink-0 font-mono text-[9px] text-zinc-500">
                        {edgeMarkers(p, selected!)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : selectedNode ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-zinc-500">Files</span>
                <span className="text-zinc-100">{selectedNode.fileCount}</span>
              </div>
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-zinc-500">Imported from outside by</span>
                <span className="text-green-600 dark:text-green-400">{selectedNode.fanIn} files</span>
              </div>
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-zinc-500">Imports from outside</span>
                <span className="text-amber-600 dark:text-amber-400">{selectedNode.fanOut} files</span>
              </div>
            </div>
            <div>
              <div className="mb-1 font-mono text-[10px] text-zinc-500">
                Kinds of file inside
              </div>
              <div className="flex flex-col gap-0.5">
                {folderKindCounts.map(([k, n]) => (
                  <div key={k} className="flex items-center justify-between font-mono text-[11px]">
                    <span className="text-zinc-700 dark:text-zinc-300">{k}</span>
                    <span className="text-zinc-500">{n}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}