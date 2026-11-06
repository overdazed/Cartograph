import fs from "node:fs";
import path from "node:path";

import { Project, SyntaxKind } from "ts-morph";

import type { Route } from "./types.ts";

export interface FrameworkAdapter {
  name: string;
  detect(rootPath: string): boolean;
  extraExcludedDirs(): string[];
  entryPoint(filePath: string): string | null;
  role(filePath: string, content?: string): string | null;
  routes(filePath: string, content: string): Route[];
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
  role: (filePath: string, content?: string) => {
    const p = filePath.toLowerCase();
    const base = (filePath.split("/").pop() ?? "").toLowerCase();
    const name = base.replace(/\.[^.]+$/, "");
    if (name === "middleware") return "Middleware";
    if (name.startsWith("instrumentation")) return "Instrumentation";
    if (["robots", "sitemap", "manifest", "favicon", "icon", "apple-icon", "opengraph-image", "twitter-image"].includes(name)) return "Metadata files";
    if (/^next\.config\./i.test(base)) return "Config files";
    if (/(^|\/)components(\/|$)/.test(p)) return "Components";
    if (/(^|\/)hooks(\/|$)/.test(p)) return "Hooks";
    if (content && /["']use server["']/.test(content)) return "Server actions";
    if (/(\.test\.|\.spec\.|__tests?__|\/tests?\/)/i.test(filePath)) return "Tests";
    return null;
  },
  routes: () => [],
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
  role: (filePath: string, content?: string) => {
    const p = filePath.toLowerCase();
    const base = (filePath.split("/").pop() ?? "").toLowerCase();
    const name = base.replace(/\.[^.]+$/, "");
    if (/(^|\/)app(\/|$)/.test(p)) {
      if (name === "page") return "Page routes";
      if (name === "route") return "API endpoints";
      if (name === "layout") return "Layouts";
      if (["loading", "error", "not-found", "template", "default"].includes(name)) return "Loading & error UI";
    }
    if (/(^|\/)pages(\/|$)/.test(p)) {
      if (/(^|\/)pages\/api(\/|$)/.test(p)) return "API endpoints";
      return "Page routes";
    }
    if (name === "middleware") return "Middleware";
    if (name.startsWith("instrumentation")) return "Instrumentation";
    if (["robots", "sitemap", "manifest", "favicon", "icon", "apple-icon", "opengraph-image", "twitter-image"].includes(name)) return "Metadata files";
    if (/^next\.config\./i.test(base)) return "Config files";
    if (/(\.test\.|\.spec\.|__tests?__|\/tests?\/)/i.test(filePath)) return "Tests";
    if (/(^|\/)components(\/|$)/.test(p)) return "Components";
    if (/(^|\/)hooks(\/|$)/.test(p)) return "Hooks";
    if (content && /["']use server["']/.test(content)) return "Server actions";
    return null;
  },
  routes: (filePath: string, content: string): Route[] => {
    const p = filePath.toLowerCase();
    const base = (filePath.split("/").pop() ?? "").toLowerCase();
    const name = base.replace(/\.[^.]+$/, "");
    if (name !== "route" || !/(^|\/)app(\/|$)/.test(p)) return [];
    const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
    const sourceFile = project.createSourceFile(filePath, content, { overwrite: true });
    const exported = sourceFile.getExportedDeclarations();
    const methods: string[] = [];
    const httpMethods = new Set(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]);
    for (const [exportName] of exported) {
      const upper = exportName.toUpperCase();
      if (httpMethods.has(upper)) methods.push(upper);
    }
    if (methods.length === 0) return [];
    const parts = filePath.split("/");
    let appIndex = parts.findIndex((seg) => seg.toLowerCase() === "app");
    if (appIndex === -1) {
      const srcIndex = parts.findIndex((seg) => seg.toLowerCase() === "src");
      if (srcIndex !== -1 && parts[srcIndex + 1]?.toLowerCase() === "app") appIndex = srcIndex + 1;
    }
    if (appIndex === -1) return [];
    const segments = parts
      .slice(appIndex + 1, -1)
      .filter((seg) => !/^\(.*\)$/.test(seg));
    const routePath = segments.length === 0 ? "/" : "/" + segments.join("/");
    return methods.map((method) => ({ method, path: routePath, filePath }));
  },
};

export const nestAdapter: FrameworkAdapter = {
  name: "nestjs",
  detect: (dirPath: string) => {
    const deps = depsOf(readPackageJson(dirPath));
    return Boolean(deps["@nestjs/core"] || deps["@nestjs/common"]);
  },
  extraExcludedDirs: () => [],
  entryPoint: (filePath: string) => commonEntryReason(filePath),
  role: (filePath: string) => {
    const base = (filePath.split("/").pop() ?? "").toLowerCase();
    if (/\.controller\./i.test(base)) return "Controllers";
    if (/\.service\./i.test(base)) return "Services";
    if (/\.module\./i.test(base)) return "Modules";
    if (/\.entity\./i.test(base)) return "Entities";
    return null;
  },
  routes: (filePath: string, content: string): Route[] => {
    const base = (filePath.split("/").pop() ?? "").toLowerCase();
    if (!/\.controller\./i.test(base)) return [];
    const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
    const sourceFile = project.createSourceFile(filePath, content, { overwrite: true });
    const httpMap: Record<string, string> = {
      Get: "GET",
      Post: "POST",
      Put: "PUT",
      Delete: "DELETE",
      Patch: "PATCH",
      Options: "OPTIONS",
      Head: "HEAD",
      All: "ALL",
    };
    const out: Route[] = [];
    for (const cls of sourceFile.getClasses()) {
      const controllerDec = cls.getDecorator("Controller");
      if (!controllerDec) continue;
      const ctrlArg = controllerDec.getArguments()[0];
      let prefix = "";
      if (ctrlArg) {
        if (!ctrlArg.isKind(SyntaxKind.StringLiteral)) return [];
        prefix = ctrlArg.getLiteralValue();
      }
      for (const method of cls.getMethods()) {
        for (const dec of method.getDecorators()) {
          const httpMethod = httpMap[dec.getName()];
          if (!httpMethod) continue;
          const arg = dec.getArguments()[0];
          let sub = "";
          if (arg) {
            if (!arg.isKind(SyntaxKind.StringLiteral)) continue;
            sub = arg.getLiteralValue();
          }
          const segments = [prefix, sub]
            .map((s) => s.replace(/^\/+|\/+$/g, ""))
            .filter((s) => s.length > 0);
          const routePath = segments.length === 0 ? "/" : "/" + segments.join("/");
          out.push({ method: httpMethod, path: routePath, filePath });
        }
      }
    }
    return out;
  },
};

export const reactAdapter: FrameworkAdapter = {
  name: "react",
  detect: (dirPath: string) => {
    const deps = depsOf(readPackageJson(dirPath));
    return Boolean(deps.react);
  },
  extraExcludedDirs: () => [],
  entryPoint: (filePath: string) => commonEntryReason(filePath),
  role: (filePath: string) => {
    const idx = filePath.lastIndexOf(".");
    const ext = idx === -1 ? "" : filePath.slice(idx).toLowerCase();
    return ext || "other";
  },
  routes: () => [],
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
  role: (filePath: string) => {
    const idx = filePath.lastIndexOf(".");
    const ext = idx === -1 ? "" : filePath.slice(idx).toLowerCase();
    return ext || "other";
  },
  routes: () => [],
};

const adapters: FrameworkAdapter[] = [nextAdapter, nestAdapter, docusaurusAdapter, reactAdapter, fallbackAdapter];

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