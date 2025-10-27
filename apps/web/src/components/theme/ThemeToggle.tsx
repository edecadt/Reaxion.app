"use client";

import { useMemo } from "react";

import { useTheme } from "./ThemeProvider";
import { cn } from "../../lib/utils";

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme, isReady } = useTheme();
  const isDark = isReady && theme === "dark";

  const label = useMemo(
    () => (isDark ? "Activer le thème clair" : "Activer le thème sombre"),
    [isDark],
  );

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={isDark}
      onClick={toggleTheme}
      disabled={!isReady}
      className={cn(
        "relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-[hsl(var(--border))] bg-gradient-to-br from-[#fef08a] via-[#fde68a] to-[#fbbf24] text-[hsl(var(--foreground))] transition-all duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:from-[#1f2937] dark:via-[#0f172a] dark:to-[#0f172a]",
        "overflow-hidden shadow-sm",
        className,
      )}
    >
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-all duration-500",
          isDark ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100",
        )}
      >
        <span className="relative h-5 w-5 rounded-full bg-gradient-to-br from-[#fde68a] to-[#fbbf24] shadow-[0_0_12px_rgba(251,191,36,0.55)]" />
        <span className="absolute h-[2px] w-full -translate-y-6 animate-pulse rounded-full bg-white/60" />
        <span className="absolute h-[2px] w-full translate-y-6 animate-pulse rounded-full bg-white/40" />
      </span>

      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-all duration-500",
          isDark ? "translate-y-0 opacity-100" : "translate-y-full opacity-0",
        )}
      >
        <span className="relative h-6 w-6 rounded-full bg-gradient-to-br from-[#111928] to-[#1f2937] shadow-[0_0_16px_rgba(15,23,42,0.65)]">
          <span className="absolute left-1/4 top-1/4 h-3 w-3 rounded-full bg-[#0f172a]" />
        </span>
        <span className="absolute -left-1 top-2 h-1 w-1 rounded-full bg-white/80" />
        <span className="absolute right-2 top-3 h-1 w-1 rounded-full bg-white/60" />
        <span className="absolute left-3 bottom-2 h-1 w-1 rounded-full bg-white/50" />
      </span>
    </button>
  );
}
