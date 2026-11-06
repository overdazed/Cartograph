import { createClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/lib/env";

/** Auto-generated docstring. */
export function createSupabaseServerClient() {
  const env = getServerEnv();

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    accessToken: async () => {
      // Imported lazily so this module stays usable from non-request contexts
      // until a client is actually constructed.
      const { auth } = await import("@clerk/nextjs/server");
      const { getToken } = await auth();
      return (await getToken()) ?? null;
    },
  });
}
