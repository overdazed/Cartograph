/** Auto-generated docstring. */
export function getClientEnv() {
  const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!clerkPublishableKey || !clerkPublishableKey.trim()) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
  }
  if (!supabaseUrl || !supabaseUrl.trim()) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!supabasePublishableKey || !supabasePublishableKey.trim()) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  return {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPublishableKey,
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabasePublishableKey,
  };
}

/** Auto-generated docstring. */
export function getServerEnv() {
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!clerkSecretKey || !clerkSecretKey.trim()) {
    throw new Error("Missing required environment variable: CLERK_SECRET_KEY");
  }
  if (!supabaseSecretKey || !supabaseSecretKey.trim()) {
    throw new Error("Missing required environment variable: SUPABASE_SECRET_KEY");
  }

  return {
    ...getClientEnv(),
    CLERK_SECRET_KEY: clerkSecretKey,
    SUPABASE_SECRET_KEY: supabaseSecretKey,
  };
}
