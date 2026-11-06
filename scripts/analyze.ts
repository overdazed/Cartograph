import { submitAnalysis, runAnalysis } from "../lib/pipeline/run.ts";
import { getAnalysisSummary } from "../lib/pipeline/store.ts";
import { createSupabaseWriterClient } from "../lib/supabase/writer.ts";

/** Auto-generated docstring. */
function parseArgs(argv: string[]): {
  url: string;
  orgId: string;
  rerun: boolean;
} {
  let url = "";
  let orgId = "";
  let rerun = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--org") {
      orgId = argv[i + 1] ?? "";
      i += 1;
    } else if (arg === "--rerun") {
      rerun = true;
    } else if (!url) {
      url = arg;
    }
  }
  return { url, orgId, rerun };
}

const { url, orgId, rerun } = parseArgs(process.argv.slice(2));
if (!url || !orgId) {
  console.error("Usage: pnpm analyze <url> --org <id> [--rerun]");
  process.exit(1);
}

const { analysisId, created } = await submitAnalysis(url, orgId);
if (!created && !rerun) {
  const summary = await getAnalysisSummary(analysisId);
  console.log(`Existing analysis ${analysisId}: ${summary.files} files, ${summary.edges} edges`);
  process.exit(0);
}

const outcome = await runAnalysis(analysisId, url, orgId);
const { data: statusRow } = await createSupabaseWriterClient()
  .from("analyses")
  .select("status, error")
  .eq("id", analysisId)
  .maybeSingle();
const summary = await getAnalysisSummary(analysisId);
console.log(`Analysis ${analysisId}: ${summary.files} files, ${summary.edges} edges`);
if (!outcome.ok || statusRow?.status !== "complete") {
  if (statusRow?.error) console.error(statusRow.error);
  else if (outcome.error) console.error(outcome.error);
  process.exit(1);
}
