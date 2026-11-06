"use client";

import { useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { useAuth } from "@clerk/nextjs";

import { getClientEnv } from "@/lib/env";

export function useSupabaseClient() {
  const { getToken } = useAuth();
  const env = getClientEnv();

  return useMemo(
    () =>
      createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
        accessToken: async () => {
        if (typeof window === "undefined") return null;
        return (await getToken()) ?? null;
      },
      }),
    [env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, getToken],
  );
}
