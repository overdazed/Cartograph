export function getClientEnv() {
  const read = (name: string): string => {
    const value = process.env[name];
    if (!value || !value.trim()) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
  };

  return {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: read("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
    NEXT_PUBLIC_SUPABASE_URL: read("NEXT_PUBLIC_SUPABASE_URL"),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: read(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ),
  };
}

export function getServerEnv() {
  return {
    ...getClientEnv(),
    CLERK_SECRET_KEY: (() => {
      const value = process.env.CLERK_SECRET_KEY;
      if (!value || !value.trim()) {
        throw new Error("Missing required environment variable: CLERK_SECRET_KEY");
      }
      return value;
    })(),
  };
}
