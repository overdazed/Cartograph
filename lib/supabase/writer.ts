import { createClient } from "@supabase/supabase-js";

import { getServerEnv } from "../env.ts";

// The only module that uses the secret key. Every other database access goes
// through the policy-scoped clients. This exists because a run outlives the
// Clerk session token the browser holds.
export function createSupabaseWriterClient() {
  const env = getServerEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type WriterClient = ReturnType<typeof createSupabaseWriterClient>;
