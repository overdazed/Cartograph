"use client";

import { useSyncExternalStore } from "react";

type Theme = "system" | "light" | "dark";

function resolve(theme: Theme): "light" | "dark" {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = resolve(theme);
}

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function getSnapshot(): Theme {
  if (typeof window === "undefined") return "system";
  return (localStorage.getItem("theme") as Theme | null) ?? "system";
}

function getServerSnapshot(): Theme {
  return "system";
}

function subscribe(callback: () => void) {
  listeners.add(callback);

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onMediaChange = () => {
    if (getSnapshot() === "system") {
      apply("system");
      callback();
    }
  };
  media.addEventListener("change", onMediaChange);

  const onStorage = (e: StorageEvent) => {
    if (e.key === "theme") {
      apply((e.newValue as Theme | null) ?? "system");
      callback();
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(callback);
    media.removeEventListener("change", onMediaChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function choose(next: Theme) {
    localStorage.setItem("theme", next);
    apply(next);
    emit();
  }

  const options: Theme[] = ["system", "light", "dark"];

  return (
    <div role="group" aria-label="Theme" className="flex items-center gap-1 text-sm">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={theme === option}
          onClick={() => choose(option)}
          className="rounded border px-2 py-1 capitalize"
        >
          {option}
        </button>
      ))}
    </div>
  );
}
