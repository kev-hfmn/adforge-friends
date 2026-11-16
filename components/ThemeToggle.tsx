"use client";

import { useEffect, useSyncExternalStore } from "react";

type Theme = "light" | "dark" | "system";
const KEY = "adforge-theme";
const OPTIONS: { id: Theme; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
];

const listeners = new Set<() => void>();

function readTheme(): Theme {
  const stored = localStorage.getItem(KEY);
  return stored === "light" || stored === "system" ? stored : "dark";
}

function apply(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function choose(next: Theme) {
  localStorage.setItem(KEY, next);
  apply(next);
  listeners.forEach((listener) => listener());
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "dark" as Theme);

  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  return (
    <div className="border-t border-border p-3">
      <p className="px-1 text-xs text-muted-foreground">Theme</p>
      <div className="mt-1 grid grid-cols-3 gap-1" role="group" aria-label="Theme">
        {OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={theme === option.id}
            onClick={() => choose(option.id)}
            className={`min-h-10 rounded-lg text-xs ${
              theme === option.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-surface-hover"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
