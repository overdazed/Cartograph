import { auth } from "@clerk/nextjs/server";
import { OrganizationSwitcher } from "@clerk/nextjs";
import { Suspense, Fragment } from "react";

import { createSupabaseServerClient } from "@/lib/supabase/server";

type AnalysisRow = {
  id: string;
  repository_url: string;
  status: string;
  commit_sha: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

const STATUSES = ["parsing", "queued", "complete", "failed", "pending"] as const;

function StatusIcon({ status }: { status: string }) {
  const common = "h-3.5 w-3.5";
  switch (status) {
    case "parsing":
      return (
        <svg viewBox="0 0 16 16" className={common} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 2a6 6 0 1 0 6 6" strokeLinecap="round" />
        </svg>
      );
    case "queued":
      return (
        <svg viewBox="0 0 16 16" className={common} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 4h10M3 8h10M3 12h6" strokeLinecap="round" />
        </svg>
      );
    case "complete":
      return (
        <svg viewBox="0 0 16 16" className={common} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3.5 8.5 6.5 11.5 12.5 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "failed":
      return (
        <svg viewBox="0 0 16 16" className={common} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 4 12 12M12 4 4 12" strokeLinecap="round" />
        </svg>
      );
    case "pending":
      return (
        <svg viewBox="0 0 16 16" className={common} fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="5" />
          <path d="M8 5v3l2 1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 16 16" className={common} fill="currentColor">
          <circle cx="8" cy="8" r="2" />
        </svg>
      );
  }
}

async function AnalysesList() {
  await auth();
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("analyses")
    .select("id, repository_url, status, commit_sha, error, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    return <p className="text-sm text-red-600">Failed to load analyses: {error.message}</p>;
  }

  const rows = (data ?? []) as AnalysisRow[];

  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<string, number>;
  for (const row of rows) {
    if (counts[row.status] !== undefined) counts[row.status] += 1;
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-6 md:flex-row">
        <aside className="w-full shrink-0 md:w-48">
          <OrganizationSwitcher
            hidePersonal
            afterSelectOrganizationUrl="/"
            appearance={{
              elements: {
                organizationSwitcherTrigger: "text-base font-semibold tracking-tight !text-zinc-900 dark:!text-zinc-100",
                organizationPreviewMainIdentifier: "text-base font-semibold tracking-tight !text-zinc-900 dark:!text-zinc-100",
                organizationPreviewAvatarBox: "hidden",
              },
            }}
          />
          <p className="mt-1 font-mono text-xs text-zinc-500">{rows.length} analyses</p>
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
        <OrganizationSwitcher
          hidePersonal
          afterSelectOrganizationUrl="/"
          appearance={{
            elements: {
              organizationSwitcherTrigger: "text-base font-semibold tracking-tight !text-zinc-900 dark:!text-zinc-100",
              organizationPreviewMainIdentifier: "text-base font-semibold tracking-tight !text-zinc-900 dark:!text-zinc-100",
              organizationPreviewAvatarBox: "hidden",
            },
          }}
        />
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
                <tr key={row.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                  <td className="truncate px-3 py-2 font-mono text-zinc-900 dark:text-zinc-100">
                    {(() => {
                      const path = row.repository_url.replace(/^https:\/\/github\.com\//, "");
                      const slash = path.indexOf("/");
                      if (slash === -1) return path;
                      return (
                        <>
                          <span className="text-zinc-500">{path.slice(0, slash + 1)}</span>
                          <span className="text-zinc-900 dark:text-zinc-100">{path.slice(slash + 1)}</span>
                        </>
                      );
                    })()}
                    {row.status === "failed" && row.error ? (
                      <div className="mt-0.5 truncate font-mono text-[11px] text-zinc-500">
                        {row.error}
                      </div>
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

async function AnalysesPage() {
  await auth.protect();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-6">
      <AnalysesList />
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
