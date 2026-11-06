import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProgressView } from "@/components/analysis/progress-view";
import { CanvasShell } from "@/components/map/canvas-shell";
import { rerunAnalysis } from "@/app/actions";

import type { ParseResult, FileRecord, Edge, Route } from "@/parser/types";

type AnalysisRow = {
  id: string;
  repository_url: string;
  status: string;
  stage: string | null;
  stage_message: string | null;
  commit_sha: string | null;
  error: string | null;
  adapter: string | null;
  files_found: number | null;
  files_parsed: number | null;
  imports_total: number | null;
  imports_resolved: number | null;
  imports_resolved_external: number | null;
  imports_excluded: number | null;
  created_at: string;
  updated_at: string;
};

async function loadAnalysis(id: string) {
  const supabase = createSupabaseServerClient();
  const { data: analysis, error: aErr } = await supabase
    .from("analyses")
    .select(
      "id, repository_url, status, stage, stage_message, commit_sha, error, adapter, files_found, files_parsed, imports_total, imports_resolved, imports_resolved_external, imports_excluded, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (aErr || !analysis) return null;

  const fetchAll = async <T,>(table: string, columns: string): Promise<T[]> => {
    const rows: T[] = [];
    let from = 0;
    while (true) {
      const { data } = await supabase
        .from(table)
        .select(columns)
        .eq("analysis_id", id)
        .range(from, from + 999)
        .order("id", { ascending: true });
      if (!data || data.length === 0) break;
      rows.push(...(data as T[]));
      if (data.length < 1000) break;
      from += 1000;
    }
    return rows;
  };

  const files = await fetchAll<{ path: string; folder: string | null; line_count: number | null; content_hash: string | null; entry_reason: string | null }>("files", "path, folder, line_count, content_hash, entry_reason");
  const edges = await fetchAll<{ source_path: string; target_path: string; kind: string; type_only: boolean | null }>("edges", "source_path, target_path, kind, type_only");
  const roleRows = await fetchAll<{ file_path: string; role: string }>("file_roles", "file_path, role");
  const routeRows = await fetchAll<{ method: string; path: string; file_path: string }>("routes", "method, path, file_path");

  const fanIn = new Map<string, number>();
  const fanOut = new Map<string, number>();
  const seenPairs = new Set<string>();
  for (const e of edges) {
    const pair = `${e.source_path}\u0000${e.target_path}`;
    if (seenPairs.has(pair)) continue;
    seenPairs.add(pair);
    fanOut.set(e.source_path, (fanOut.get(e.source_path) ?? 0) + 1);
    fanIn.set(e.target_path, (fanIn.get(e.target_path) ?? 0) + 1);
  }

  const roleByPath = new Map<string, string>();
  for (const r of roleRows ?? []) roleByPath.set(r.file_path as string, r.role as string);

  const fileRecords: FileRecord[] = (files ?? []).map((f) => ({
    path: f.path as string,
    folder: (f.folder as string) ?? ".",
    lines: (f.line_count as number) ?? 0,
    hash: (f.content_hash as string) ?? "",
    role: roleByPath.get(f.path as string) ?? null,
    entryReason: (f.entry_reason as string) ?? null,
    fanIn: fanIn.get(f.path as string) ?? 0,
    fanOut: fanOut.get(f.path as string) ?? 0,
  }));

  const routeRecords: Route[] = (routeRows ?? []).map((r) => ({
    method: r.method as string,
    path: r.path as string,
    filePath: r.file_path as string,
  }));

  const edgeRecords: Edge[] = edges.map((e) => ({
    from: e.source_path as string,
    to: e.target_path as string,
    kind: e.kind as Edge["kind"],
    typeOnly: Boolean(e.type_only),
  }));

  const folders = new Set(fileRecords.map((f) => f.folder)).size;
  const totalImports = (analysis as AnalysisRow).imports_total ?? 0;
  const externalImports = (analysis as AnalysisRow).imports_resolved_external ?? 0;
  const excludedImports = (analysis as AnalysisRow).imports_excluded ?? 0;
  const resolvedInternal = (analysis as AnalysisRow).imports_resolved ?? 0;
  const unresolvedImportsCount = Math.max(0, totalImports - resolvedInternal - externalImports - excludedImports);

  const parseResult: ParseResult = {
    version: 3,
    root: analysis.repository_url as string,
    adapter: ((analysis as AnalysisRow).adapter as string) ?? "stored",
    generatedAt: analysis.updated_at as string,
    files: fileRecords,
    edges: edgeRecords,
    routes: routeRecords,
    skipped: [],
    coverage: {
      totalImports,
      resolvedInternal,
      resolvedExternal: externalImports,
      excluded: excludedImports,
      unresolved: unresolvedImportsCount,
      reexportsFound: 0,
      reexportsResolved: 0,
      unresolvedImports: [],
    },
    summary: {
      filesFound: (analysis as AnalysisRow).files_found ?? fileRecords.length,
      filesParsed: (analysis as AnalysisRow).files_parsed ?? fileRecords.length,
      filesSkipped: ((analysis as AnalysisRow).files_found ?? fileRecords.length) - fileRecords.length,
      folders,
      edges: edgeRecords.length,
    },
  };

  return { analysis: analysis as AnalysisRow, parseResult };
}

export const instant = false;

export default async function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  await auth.protect();
  const { id } = await params;
  const loaded = await loadAnalysis(id);
  if (!loaded) notFound();

  const { analysis, parseResult } = loaded;

  const knownAdapters = new Set(["nextjs", "nestjs", "docusaurus", "react", "fallback"]);
  if (analysis.status === "complete" && !knownAdapters.has(String((analysis as AnalysisRow).adapter ?? ""))) {
    await rerunAnalysis(id);
  }

  if (analysis.status !== "complete") {
    return (
      <ProgressView
        analysisId={analysis.id}
        initialStage={analysis.stage}
        initialMessage={analysis.stage_message}
        initialStatus={analysis.status}
        initialError={analysis.error}
        initialUpdatedAt={analysis.updated_at}
      />
    );
  }

  return (
    <Suspense fallback={<p className="p-8 text-sm">Loading map…</p>}>
      <div className="h-[calc(100vh-64px)] w-full">
        <CanvasShell data={parseResult} analysisId={id} />
      </div>
    </Suspense>
  );
}
