import { parseRepository } from "../../parser/parse.ts";
import type { ParseResult } from "../../parser/types.ts";

import { fetchRepository } from "./fetch.ts";
import {
  findOrCreateProject,
  findAnalysisByProject,
  createAnalysis,
  setStage,
  setFailed,
  setComplete,
  storeParseResult,
} from "./store.ts";

export type SubmitResult = {
  analysisId: string;
  created: boolean;
};

/** Auto-generated docstring. */
export async function submitAnalysis(
  repositoryUrl: string,
  organizationId: string,
): Promise<SubmitResult> {
  const projectId = await findOrCreateProject(organizationId, repositoryUrl);
  const existing = await findAnalysisByProject(projectId);
  if (existing) {
    return { analysisId: existing, created: false };
  }
  const created = await createAnalysis(organizationId, projectId, repositoryUrl);
  return { analysisId: created.id, created: created.created };
}

/** Auto-generated docstring. */
export async function runAnalysis(
  analysisId: string,
  repositoryUrl: string,
  organizationId: string,
): Promise<{ ok: boolean; error?: string }> {
  let fetched: { rootPath: string; commitSha: string; cleanup: () => void } | null = null;
  let currentStage = "fetch";
  try {
    currentStage = "fetch";
    await setStage(analysisId, "fetch", "Fetching repository archive");
    fetched = await fetchRepository(repositoryUrl);

    currentStage = "select";
    await setStage(analysisId, "select", "Selecting source files");

    currentStage = "parse";
    const result: ParseResult = parseRepository(fetched.rootPath);

    await setStage(analysisId, "parse", `Parsed ${result.summary.filesParsed} files, ${result.summary.filesSkipped} skipped`);
    currentStage = "store";
    await setStage(analysisId, "store", `Storing ${result.summary.filesParsed} files and ${result.edges.length} edges`);
    await storeParseResult(analysisId, organizationId, result);

    await setComplete(analysisId, fetched.commitSha);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await setFailed(analysisId, currentStage, message).catch(() => undefined);
    return { ok: false, error: message };
  } finally {
    fetched?.cleanup();
    if (!fetched) {
      // nothing to clean
    }
  }
}
