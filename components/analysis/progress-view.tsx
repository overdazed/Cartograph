"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { useSupabaseClient } from "@/lib/supabase/client";
import { rerunAnalysis } from "@/app/actions";

const STAGES = ["fetch", "select", "parse", "store"] as const;

type Props = {
  analysisId: string;
  initialStage: string | null;
  initialMessage: string | null;
  initialStatus: string;
  initialError: string | null;
  initialUpdatedAt: string;
};

function isStale(status: string, updatedAt: string): boolean {
  if (status === "complete" || status === "failed") return false;
  const age = Date.now() - new Date(updatedAt).getTime();
  return age > 5 * 60 * 1000;
}

export function ProgressView({
  analysisId,
  initialStage,
  initialMessage,
  initialStatus,
  initialError,
  initialUpdatedAt,
}: Props) {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const [stage, setStage] = useState(initialStage ?? "fetch");
  const [message, setMessage] = useState(initialMessage ?? "Starting");
  const [status, setStatus] = useState(initialStatus);
  const [error] = useState(initialError);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const channel = supabase
      .channel(`analysis:${analysisId}`, { config: { private: true } })
      .on("broadcast", { event: "progress" }, (payload) => {
        const p = payload.payload as { status?: string; stage?: string; message?: string };
        if (p.stage) setStage(p.stage);
        if (p.message !== undefined) setMessage(p.message ?? "");
        if (p.status) setStatus(p.status);
        setUpdatedAt(new Date().toISOString());
        if (p.stage === "complete" || p.stage === "failed") {
          router.refresh();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [analysisId, supabase, router]);

  const stale = isStale(status, updatedAt);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 p-6">
      <h1 className="font-mono text-sm text-zinc-500">Analysis {analysisId.slice(0, 8)}</h1>
      <ol className="flex flex-col gap-2 border border-zinc-200 p-4 dark:border-zinc-800">
        {STAGES.map((s) => {
          const currentIndex = STAGES.indexOf(stage as (typeof STAGES)[number]);
          const thisIndex = STAGES.indexOf(s);
          const done = thisIndex < currentIndex || status === "complete";
          const active = s === stage && status !== "complete";
          return (
            <li key={s} className="flex items-center gap-2 font-mono text-xs">
              <span className={done ? "text-green-600" : active ? "text-blue-600" : "text-zinc-400"}>
                {done ? "✓" : active ? "›" : "·"}
              </span>
              <span className={active ? "font-medium" : ""}>{s}</span>
              {active && message ? <span className="text-zinc-500">— {message}</span> : null}
            </li>
          );
        })}
      </ol>
      {status === "failed" ? (
        <p className="text-sm text-red-600">{error ?? "Run failed."}</p>
      ) : null}
      {stale ? <p className="text-sm text-amber-600">Stale: no progress for 5 minutes.</p> : null}
      {status === "complete" || status === "failed" || stale ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => rerunAnalysis(analysisId))}
          className="w-fit border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
        >
          {pending ? "Starting…" : "Re-run"}
        </button>
      ) : null}
    </div>
  );
}
