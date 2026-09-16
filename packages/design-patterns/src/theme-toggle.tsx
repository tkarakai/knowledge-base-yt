"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@repo/design-system";

const defaultLabels = {
  light: "Light theme",
  system: "System theme",
  dark: "Dark theme",
  aria: "Theme: {label}. Click to switch.",
};

const options = [
  { value: "light", icon: Sun, labelKey: "light" as const },
  { value: "system", icon: Monitor, labelKey: "system" as const },
  { value: "dark", icon: Moon, labelKey: "dark" as const },
] as const;

const themeOrder: string[] = options.map((o) => o.value);

interface ThemeToggleProps {
  className?: string;
  /** When true, renders as a single icon button that cycles through themes on click. */
  collapsed?: boolean;
  /** Translated labels. Falls back to English defaults when not provided. */
  labels?: { light: string; system: string; dark: string; aria: string };
}

export function ThemeToggle({ className, collapsed = false, labels }: ThemeToggleProps) {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const l = labels ?? defaultLabels;

  // Avoid hydration mismatch: `theme` is undefined on the server,
  // so we only apply the active style after the first client render.
  useEffect(() => setMounted(true), []);

  if (collapsed) {
    const currentIndex = themeOrder.indexOf(theme ?? "system");
    const nextTheme = themeOrder[(currentIndex + 1) % themeOrder.length]!;
    const current = options.find((o) => o.value === (theme ?? "system")) ?? options[1];
    const CurrentIcon = current.icon;
    const currentLabel = l[current.labelKey];

    return (
      <button
        type="button"
        aria-label={l.aria.replace("{label}", currentLabel)}
        onClick={() => setTheme(nextTheme)}
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          "inline-flex h-9 aspect-square items-center justify-center rounded-md bg-muted text-muted-foreground transition-all duration-150 hover:text-foreground",
          className,
        )}
      >
        {mounted ? <CurrentIcon className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex h-9 items-center gap-1 rounded-md bg-muted p-1",
        className,
      )}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {options.map(({ value, icon: Icon, labelKey }) => (
        <button
          key={value}
          type="button"
          aria-label={l[labelKey]}
          onClick={() => setTheme(value)}
          className={cn(
            "flex-1 h-full aspect-square flex items-center justify-center rounded-sm transition-all duration-150",
            mounted && theme === value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
