"use server";

import { auth } from "@clerk/nextjs/server";
import { after } from "next/server";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { submitAnalysis, runAnalysis } from "../lib/pipeline/run.ts";

export async function rerunAnalysis(analysisId: string): Promise<void> {
  const { orgId } = await auth();
  if (!orgId) throw new Error("No organization selected");
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("analyses")
    .select("repository_url")
    .eq("id", analysisId)
    .maybeSingle();
  const repositoryUrl = data?.repository_url as string | undefined;
  if (!repositoryUrl) throw new Error("Analysis not found");

  await createSupabaseServerClient().from("analyses").update({
    status: "parsing",
    stage: "fetch",
    stage_message: "Starting",
    updated_at: new Date().toISOString(),
  }).eq("id", analysisId);

  after(async () => {
    await runAnalysis(analysisId, repositoryUrl, orgId);
  });
  redirect(`/analyses/${analysisId}`);
}

export async function submitRepository(formData: FormData): Promise<void> {
  const repositoryUrl = String(formData.get("repositoryUrl") ?? "").trim();
  if (!repositoryUrl) return;
  const { orgId } = await auth();
  if (!orgId) {
    throw new Error("No organization selected");
  }
  const { analysisId, created } = await submitAnalysis(repositoryUrl, orgId);
  if (created) {
    after(async () => {
      await runAnalysis(analysisId, repositoryUrl, orgId);
    });
  }
  redirect(`/analyses/${analysisId}`);
}
