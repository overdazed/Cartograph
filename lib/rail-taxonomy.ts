export const RAIL_TAXONOMY: Record<string, string[]> = {
  nextjs: [
    "Page routes",
    "API endpoints",
    "Server actions",
    "Layouts",
    "Loading & error UI",
    "Components",
    "Hooks",
    "Middleware",
    "Metadata files",
    "Instrumentation",
    "Config files",
    "Tests",
    "Unclassified",
  ],
  nestjs: ["Controllers", "Services", "Modules", "Entities", "Unclassified"],
  express: [
    "Routers",
    "Controllers",
    "Services",
    "Models",
    "Middleware",
    "Unclassified",
  ],
};

export const ALL_FRAMEWORK_CATEGORIES: string[] = [
  ...RAIL_TAXONOMY.nextjs,
  ...RAIL_TAXONOMY.nestjs.filter((c) => !RAIL_TAXONOMY.nextjs.includes(c)),
  ...RAIL_TAXONOMY.express.filter(
    (c) => ![...RAIL_TAXONOMY.nextjs, ...RAIL_TAXONOMY.nestjs].includes(c),
  ),
];

/** Auto-generated docstring. */
export function railCategoriesFor(adapter: string): string[] {
  return RAIL_TAXONOMY[adapter] ?? [];
}