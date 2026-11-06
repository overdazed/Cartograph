"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OrganizationSwitcher } from "@clerk/nextjs";
import { Fragment } from "react";

import { useSupabaseClient } from "@/lib/supabase/client";
import { StatusIcon } from "@/components/analysis/status-icon";

type Row = {
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

const STATUSES = ["parsing", "queued", "complete", "failed", "pending"] as const;

/** Auto-generated docstring. */
function isStale(status: string, updatedAt: string): boolean {
  if (status === "complete" || status === "failed") return false;
  return Date.now() - new Date(updatedAt).getTime() > 5 * 60 * 1000;
}

/** Auto-generated docstring. */
export function DashboardAnalyses({ initialRows }: { initialRows: Row[] }) {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(initialRows);
  }, [initialRows]);

  useEffect(() => {
    const channels = rows
      .filter((r) => r.status !== "complete" && r.status !== "failed")
      .map((r) => {
        const channel = supabase
          .channel(`analysis:${r.id}`, { config: { private: true } })
          .on("broadcast", { event: "progress" }, (payload) => {
            const p = payload.payload as { status?: string; stage?: string; message?: string };
            setRows((prev) =>
              prev.map((row) =>
                row.id === r.id
                  ? {
                      ...row,
                      status: p.status ?? row.status,
                      stage: p.stage ?? row.stage,
                      stage_message: p.message ?? row.stage_message,
                      updated_at: new Date().toISOString(),
                    }
                  : row,
              ),
            );
          })
          .subscribe();
        return channel;
      });

    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [supabase]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<string, number>;
  for (const row of rows) {
    if (counts[row.status] !== undefined) counts[row.status] += 1;
  }
  const staleCount = rows.filter((r) => isStale(r.status, r.updated_at)).length;

  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-6 md:flex-row">
        <aside className="w-full shrink-0 md:w-48">
          <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/" />
          <p className="mt-1 font-mono text-xs text-zinc-500">0 analyses</p>
        </aside>
        <div className="flex-1 border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No analyses yet for this team.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <aside className="w-full shrink-0 md:w-48">
        <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/" />
        <p className="mt-1 font-mono text-xs text-zinc-500">{rows.length} analyses</p>
        <ul className="mt-4 flex flex-col gap-1">
          {STATUSES.map((status) => (
            <li key={status} className="flex items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-500">
              <span className="flex items-center gap-1.5">
                <StatusIcon status={status} />
                <span>{status}</span>
              </span>
              <span className="font-mono">{counts[status]}</span>
            </li>
          ))}
          <li className="flex items-center justify-between gap-2 text-xs text-amber-600">
            <span>stale</span>
            <span className="font-mono">{staleCount}</span>
          </li>
        </ul>
      </aside>
      <div className="min-w-0 flex-1 overflow-x-auto border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 text-xs font-normal text-zinc-500 dark:border-zinc-800">
            <tr>
              <th className="px-3 py-1.5 text-left font-normal">Repository</th>
              <th className="px-3 py-1.5 text-left font-normal">State</th>
              <th className="px-3 py-1.5 text-left font-normal">Commit</th>
              <th className="px-3 py-1.5 text-left font-normal">Started</th>
              <th className="px-3 py-1.5 text-left font-normal">Finished</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.map((row) => (
              <Fragment key={row.id}>
                <tr key={row.id} onClick={() => router.push(`/analyses/${row.id}`)} className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900">
                  <td className="truncate px-3 py-2 font-mono text-zinc-900 dark:text-zinc-100">
                    {row.repository_url.replace(/^https:\/\/github\.com\//, "")}
                    {row.status === "failed" && row.error ? (
                      <div className="mt-0.5 truncate font-mono text-[11px] text-zinc-500">{row.error}</div>
                    ) : null}
                    {isStale(row.status, row.updated_at) ? (
                      <div className="mt-0.5 font-mono text-[11px] text-amber-600">stale</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1.5">
                      <span className={row.status === "queued" ? "text-zinc-400 dark:text-zinc-600" : "text-zinc-900 dark:text-zinc-100"}>
                        <StatusIcon status={row.status} />
                      </span>
                      <span className={`font-mono text-xs ${row.status === "queued" ? "text-zinc-400 dark:text-zinc-600" : "text-zinc-900 dark:text-zinc-100"}`}>
                        {row.status}
                      </span>
                      {row.stage_message ? <span className="font-mono text-[11px] text-zinc-500">{row.stage_message}</span> : null}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-zinc-500">
                    {row.commit_sha ? row.commit_sha.slice(0, 7) : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-zinc-500">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-zinc-500">
                    {new Date(row.updated_at).toLocaleString()}
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
