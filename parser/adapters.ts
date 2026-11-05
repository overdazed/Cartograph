// Adapter interface. Defined here so parser core never imports framework code;
// adapters register themselves by calling registerAdapter.
export interface FrameworkAdapter {
  name: string;
  detect(rootPath: string): boolean;
  extraExcludedDirs(): string[];
}

export const fallbackAdapter: FrameworkAdapter = {
  name: "fallback",
  detect: () => true,
  extraExcludedDirs: () => [],
};

const adapters: FrameworkAdapter[] = [fallbackAdapter];

export function selectAdapter(rootPath: string): FrameworkAdapter {
  for (const adapter of adapters) {
    if (adapter.detect(rootPath)) return adapter;
  }
  return fallbackAdapter;
}

export function registerAdapter(adapter: FrameworkAdapter): void {
  adapters.splice(adapters.length - 1, 0, adapter);
}