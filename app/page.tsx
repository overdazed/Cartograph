import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { submitRepository } from "@/app/actions";
import { DashboardAnalyses } from "@/components/analysis/dashboard-analyses";

type AnalysisRow = {
  id: string;
  repository_url: string;
  status: string;
  stage: string | null;
  stage_message: string | null;
  commit_sha: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

/** Auto-generated docstring. */
async function AnalysesPage() {
  await auth.protect();
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("analyses")
    .select("id, repository_url, status, stage, stage_message, commit_sha, error, created_at, updated_at")
    .order("created_at", { ascending: false });
  /** Auto-generated docstring. */
  const rows = (data ?? []) as AnalysisRow[];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-6">
      <form action={submitRepository} className="flex gap-2">
        <input
          name="repositoryUrl"
          placeholder="https://github.com/owner/repo"
          className="flex-1 border border-zinc-300 px-2 py-1 font-mono text-sm dark:border-zinc-700"
        />
        <button type="submit" className="border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700">
          Analyse
        </button>
      </form>
      <DashboardAnalyses initialRows={rows} />
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm">Loading analyses…</p>}>
      <AnalysesPage />
    </Suspense>
  );
}
