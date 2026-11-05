import fs from "node:fs";
import path from "node:path";

export interface FrameworkAdapter {
  name: string;
  detect(rootPath: string): boolean;
  extraExcludedDirs(): string[];
  entryPoint(filePath: string): string | null;
}

function testEntryReason(filePath: string): string | null {
  const base = (filePath.split("/").pop() ?? "").toLowerCase();
  if (/\.(test|spec)\./i.test(base)) return "reached by the test runner";
  if (/(^|\/)(__tests?__|tests?)(\/|$)/i.test(filePath)) return "reached by the test runner";
  return null;
}

function commonEntryReason(filePath: string): string | null {
  const t = testEntryReason(filePath);
  if (t) return t;
  const base = (filePath.split("/").pop() ?? "").toLowerCase();
  if (/\.(config|rc)(\.[a-z0-9]+)?$/i.test(base)) return "config file";
  if (base.startsWith(".") && base.includes("rc")) return "config file";
  return null;
}
function readPackageJson(dirPath: string): Record<string, unknown> | null {
  try {
    const raw = fs.readFileSync(path.join(dirPath, "package.json"), "utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function depsOf(pkg: Record<string, unknown> | null): Record<string, string> {
  if (!pkg) return {};
  return {
    ...((pkg.dependencies as Record<string, string>) ?? {}),
    ...((pkg.devDependencies as Record<string, string>) ?? {}),
  };
}

export const fallbackAdapter: FrameworkAdapter = {
  name: "fallback",
  detect: () => true,
  extraExcludedDirs: () => [],
  entryPoint: (filePath: string) => {
    return commonEntryReason(filePath);
  },
};

export const nextAdapter: FrameworkAdapter = {
  name: "nextjs",
  detect: (dirPath: string) => {
    const deps = depsOf(readPackageJson(dirPath));
    return Boolean(deps.next);
  },
  extraExcludedDirs: () => [],
  entryPoint: (filePath: string) => {
    const c = commonEntryReason(filePath);
    if (c) return c;
    const p = filePath.toLowerCase();
    const base = (filePath.split("/").pop() ?? "").toLowerCase();
    const name = base.replace(/\.[^.]+$/, "");
    if (name === "middleware" && (/^middleware\./.test(base) || /^src\/middleware\./.test(p))) {
      return "Next.js middleware";
    }
    if (name === "next.config" || base.startsWith("next.config.")) return "Next.js config";
    if (/(^|\/)app(\/|$)/.test(p)) {
      if (["page", "layout", "template", "loading", "error", "not-found", "route", "default"].includes(name)) {
        return "Next.js route entry";
      }
      return null;
    }
    if (/(^|\/)pages(\/|$)/.test(p)) {
      return "Next.js route";
    }
    return null;
  },
};

export const docusaurusAdapter: FrameworkAdapter = {
  name: "docusaurus",
  detect: (dirPath: string) => {
    const deps = depsOf(readPackageJson(dirPath));
    return Boolean(deps["@docusaurus/core"]);
  },
  extraExcludedDirs: () => [],
  entryPoint: (filePath: string) => {
    const c = commonEntryReason(filePath);
    if (c) return c;
    const p = filePath.toLowerCase();
    const base = (filePath.split("/").pop() ?? "").toLowerCase();
    const name = base.replace(/\.[^.]+$/, "");
    if (base.startsWith("docusaurus.config.")) return "Docusaurus config";
    if (/(^|\/)src\/pages(\/|$)/.test(p)) return "Docusaurus page";
    if (/(^|\/)docs(\/|$)/.test(p)) return "Docusaurus doc";
    if (name === "index" && p.includes("/pages/")) return "Docusaurus page";
    return null;
  },
};

const adapters: FrameworkAdapter[] = [nextAdapter, docusaurusAdapter, fallbackAdapter];

export function selectAdapter(rootPath: string): FrameworkAdapter {
  for (const adapter of adapters) {
    if (adapter.detect(rootPath)) return adapter;
  }
  return fallbackAdapter;
}

export function registerAdapter(adapter: FrameworkAdapter): void {
  adapters.splice(adapters.length - 1, 0, adapter);
}

export function adapterForFile(root: string, relPath: string): FrameworkAdapter {
  let dir = path.dirname(path.join(root, relPath));
  while (true) {
    if (fs.existsSync(path.join(dir, "package.json"))) {
      return selectAdapter(dir);
    }
    if (dir === root) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return selectAdapter(root);
}