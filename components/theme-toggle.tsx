"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-1",
        className,
      )}
      role="group"
      aria-label="Theme"
      suppressHydrationWarning
    >
      <button
        type="button"
        onClick={() => setTheme("light")}
        className={cn(
          "rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground",
          resolvedTheme === "light" && "bg-card text-foreground shadow-sm",
        )}
        aria-label="Light mode"
        aria-pressed={resolvedTheme === "light"}
      >
        <Sun className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        className={cn(
          "rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground",
          resolvedTheme === "dark" && "bg-card text-foreground shadow-sm",
        )}
        aria-label="Dark mode"
        aria-pressed={resolvedTheme === "dark"}
      >
        <Moon className="h-4 w-4" />
      </button>
    </div>
  );
}
