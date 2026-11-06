import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";

async function OrganizationInfo() {
  const { orgId, orgSlug } = await auth();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-2 p-8">
      <h1 className="text-xl font-semibold">Workspace</h1>
      <p className="font-mono text-sm">Organization ID: {orgId}</p>
      <p className="font-mono text-sm">Organization slug: {orgSlug}</p>
    </main>
  );
}

export default async function DashboardPage() {
  await auth.protect();

  return (
    <Suspense fallback={<p className="p-8 text-sm">Loading workspace…</p>}>
      <OrganizationInfo />
    </Suspense>
  );
}
