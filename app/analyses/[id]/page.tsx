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
  created_at: string;
  updated_at: string;
};

async function loadAnalysis(id: string) {
  const supabase = createSupabaseServerClient();
  const { data: analysis, error: aErr } = await supabase
    .from("analyses")
    .select(
      "id, repository_url, status, stage, stage_message, commit_sha, error, adapter, files_found, files_parsed, imports_total, imports_resolved, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (aErr || !analysis) return null;

  const { data: files } = await supabase
    .from("files")
    .select("path, folder, line_count, content_hash")
    .eq("analysis_id", id);

  const { data: edges } = await supabase
    .from("edges")
    .select("source_path, target_path, kind, type_only")
    .eq("analysis_id", id);

  const { data: roleRows } = await supabase
    .from("file_roles")
    .select("file_path, role")
    .eq("analysis_id", id);

  const { data: routeRows } = await supabase
    .from("routes")
    .select("method, path, file_path")
    .eq("analysis_id", id);

  const fanIn = new Map<string, number>();
  const fanOut = new Map<string, number>();
  for (const e of edges ?? []) {
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
    entryReason: null,
    fanIn: fanIn.get(f.path as string) ?? 0,
    fanOut: fanOut.get(f.path as string) ?? 0,
  }));

  const routeRecords: Route[] = (routeRows ?? []).map((r) => ({
    method: r.method as string,
    path: r.path as string,
    filePath: r.file_path as string,
  }));

  const edgeRecords: Edge[] = (edges ?? []).map((e) => ({
    from: e.source_path as string,
    to: e.target_path as string,
    kind: e.kind as Edge["kind"],
    typeOnly: Boolean(e.type_only),
  }));

  const folders = new Set(fileRecords.map((f) => f.folder)).size;
  const totalImports = (analysis as AnalysisRow).imports_total ?? 0;
  const resolvedInternal = (analysis as AnalysisRow).imports_resolved ?? 0;

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
      resolvedExternal: 0,
      excluded: 0,
      unresolved: Math.max(0, totalImports - resolvedInternal),
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
