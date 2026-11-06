import { parseRepository } from "../../parser/parse.ts";
import type { ParseResult } from "../../parser/types.ts";

import { createSupabaseWriterClient } from "../supabase/writer.ts";

const CHUNK = 500;

/** Auto-generated docstring. */
export function normalizeRepositoryUrl(repositoryUrl: string): string {
  const cleaned = repositoryUrl.trim().replace(/\.git$/, "").replace(/\/$/, "");
  const match = cleaned.match(/github\.com[/:]([^/]+)\/([^/]+)/i);
  if (!match) return cleaned;
  return `https://github.com/${match[1].toLowerCase()}/${match[2].toLowerCase()}`;
}

/** Auto-generated docstring. */
async function chunkInsert(
  table: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  const client = createSupabaseWriterClient();
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await client.from(table).insert(slice);
    if (error) throw new Error(`${table} insert failed: ${error.message}`);
  }
}

/** Auto-generated docstring. */
export async function findOrCreateProject(
  organizationId: string,
  repositoryUrl: string,
): Promise<string> {
  const url = normalizeRepositoryUrl(repositoryUrl);
  const client = createSupabaseWriterClient();
  /** Auto-generated docstring. */
  const lookup = async () => {
    const { data, error } = await client
      .from("projects")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("repository_url", url)
      .maybeSingle();
    if (error) throw new Error(`project lookup failed: ${error.message}`);
    return data?.id as string | undefined;
  };
  const existing = await lookup();
  if (existing) return existing;

  const { data: created, error: createError } = await client
    .from("projects")
    .insert({ organization_id: organizationId, repository_url: url, name: url })
    .select("id")
    .single();
  if (createError) {
    const reused = await lookup();
    if (reused) return reused;
    throw new Error(`project create failed: ${createError.message}`);
  }
  if (!created?.id) throw new Error("project create failed: no id");
  return created.id as string;
}

/** Auto-generated docstring. */
export async function findAnalysisByProject(projectId: string): Promise<string | null> {
  const client = createSupabaseWriterClient();
  const { data, error } = await client
    .from("analyses")
    .select("id")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw new Error(`analysis lookup failed: ${error.message}`);
  return (data?.id as string) ?? null;
}

/** Auto-generated docstring. */
export async function createAnalysis(
  organizationId: string,
  projectId: string,
  repositoryUrl: string,
): Promise<{ id: string; created: boolean }> {
  const url = normalizeRepositoryUrl(repositoryUrl);
  const client = createSupabaseWriterClient();
  const { data, error } = await client
    .from("analyses")
    .insert({
      organization_id: organizationId,
      project_id: projectId,
      repository_url: url,
      status: "pending",
      stage: "fetch",
      stage_message: "Starting",
    })
    .select("id")
    .single();
  if (error) {
    const existing = await findAnalysisByProject(projectId);
    if (existing) return { id: existing, created: false };
    throw new Error(`analysis create failed: ${error.message}`);
  }
  if (!data?.id) throw new Error("analysis create failed: no id");
  return { id: data.id as string, created: true };
}

/** Auto-generated docstring. */
export async function setStage(
  analysisId: string,
  stage: string,
  message: string,
): Promise<void> {
  const client = createSupabaseWriterClient();
  const { error } = await client
    .from("analyses")
    .update({ status: "parsing", stage, stage_message: message, updated_at: new Date().toISOString() })
    .eq("id", analysisId);
  if (error) throw new Error(`stage update failed: ${error.message}`);
}

/** Auto-generated docstring. */
export async function setFailed(
  analysisId: string,
  stage: string,
  error: string,
): Promise<void> {
  const client = createSupabaseWriterClient();
  const { error: updateError } = await client
    .from("analyses")
    .update({
      status: "failed",
      stage,
      stage_message: null,
      error,
      updated_at: new Date().toISOString(),
    })
    .eq("id", analysisId);
  if (updateError) throw new Error(`failed update failed: ${updateError.message}`);
}

/** Auto-generated docstring. */
export async function setComplete(
  analysisId: string,
  commitSha: string,
): Promise<void> {
  const client = createSupabaseWriterClient();
  const { error } = await client
    .from("analyses")
    .update({
      status: "complete",
      stage: "complete",
      stage_message: "Done",
      commit_sha: commitSha,
      error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", analysisId);
  if (error) throw new Error(`complete update failed: ${error.message}`);
}

/** Auto-generated docstring. */
export async function storeParseResult(
  analysisId: string,
  organizationId: string,
  result: ParseResult,
): Promise<void> {
  const client = createSupabaseWriterClient();

  const deleteEdges = await client.from("edges").delete().eq("analysis_id", analysisId);
  if (deleteEdges.error) throw new Error(`edges delete failed: ${deleteEdges.error.message}`);
  const deleteFiles = await client.from("files").delete().eq("analysis_id", analysisId);
  if (deleteFiles.error) throw new Error(`files delete failed: ${deleteFiles.error.message}`);
  const deleteRoles = await client.from("file_roles").delete().eq("analysis_id", analysisId);
  if (deleteRoles.error) throw new Error(`file_roles delete failed: ${deleteRoles.error.message}`);
  const deleteRoutes = await client.from("routes").delete().eq("analysis_id", analysisId);
  if (deleteRoutes.error) throw new Error(`routes delete failed: ${deleteRoutes.error.message}`);

  const fileRows = result.files.map((file) => ({
    analysis_id: analysisId,
    organization_id: organizationId,
    path: file.path,
    folder: file.folder,
    line_count: file.lines,
    byte_size: null,
    content_hash: file.hash,
    entry_reason: file.entryReason,
  }));
  await chunkInsert("files", fileRows);

  // Record coverage on the analysis row.
  const { error: coverageError } = await client
    .from("analyses")
    .update({
      files_found: result.summary.filesFound,
      files_parsed: result.summary.filesParsed,
      imports_total: result.coverage.totalImports,
      imports_resolved: result.coverage.resolvedInternal,
      imports_resolved_external: result.coverage.resolvedExternal,
      imports_excluded: result.coverage.excluded,
      adapter: result.adapter,
      updated_at: new Date().toISOString(),
    })
    .eq("id", analysisId);
  if (coverageError) throw new Error(`coverage update failed: ${coverageError.message}`);

  const fileIdByPath = new Map<string, string>();
  let from = 0;
  while (true) {
    const { data: page, error: pageError } = await client
      .from("files")
      .select("id, path")
      .eq("analysis_id", analysisId)
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (pageError) throw new Error(`file re-read failed: ${pageError.message}`);
    if (!page || page.length === 0) break;
    for (const row of page) fileIdByPath.set(row.path as string, row.id as string);
    if (page.length < 1000) break;
    from += 1000;
  }

  const roleRows = result.files
    .filter((file) => file.role)
    .map((file) => ({
      analysis_id: analysisId,
      organization_id: organizationId,
      file_path: file.path,
      role: file.role as string,
      source: "convention",
    }));
  if (roleRows.length > 0) await chunkInsert("file_roles", roleRows);

  const routeRows = result.routes.map((route) => ({
    analysis_id: analysisId,
    organization_id: organizationId,
    method: route.method,
    path: route.path,
    file_path: route.filePath,
  }));
  if (routeRows.length > 0) await chunkInsert("routes", routeRows);

  const edgePayload = result.edges
    .filter((edge) => fileIdByPath.has(edge.from) && fileIdByPath.has(edge.to))
    .map((edge) => ({
      source_path: edge.from,
      target_path: edge.to,
      kind: edge.kind,
      type_only: edge.typeOnly,
    }));
  const { error: edgeError } = await client.rpc("insert_analysis_edges", {
    p_analysis_id: analysisId,
    p_organization_id: organizationId,
    p_edges: edgePayload,
  });
  if (edgeError) throw new Error(`edge insert failed: ${edgeError.message}`);
}

/** Auto-generated docstring. */
export async function getAnalysisSummary(analysisId: string): Promise<{ files: number; edges: number }> {
  const client = createSupabaseWriterClient();
  const { count: fileCount, error: fileError } = await client
    .from("files")
    .select("id", { count: "exact", head: true })
    .eq("analysis_id", analysisId);
  if (fileError) throw new Error(`file count failed: ${fileError.message}`);
  const { count: edgeCount, error: edgeError } = await client
    .from("edges")
    .select("id", { count: "exact", head: true })
    .eq("analysis_id", analysisId);
  if (edgeError) throw new Error(`edge count failed: ${edgeError.message}`);
  return { files: fileCount ?? 0, edges: edgeCount ?? 0 };
}

// Re-export parser entry for convenience of callers.
export { parseRepository };
