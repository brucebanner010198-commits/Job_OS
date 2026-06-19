"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Settings,
  LayoutDashboard,
  Plug,
  ShieldCheck,
  Network,
  Users,
  TrendingUp,
  Gauge,
  Mic,
  FileText,
  Target,
  Upload,
  BookOpen,
  Building2,
} from "lucide-react";
import { LiveStatusBadge } from "@/components/live-status-badge";
import { MODULES, type LiveAdapterStatus } from "@/lib/modules";
import { cn } from "@/lib/utils";

const LIVE_BY_HREF = Object.fromEntries(
  MODULES.filter((m) => m.href).map((m) => [m.href!, m.liveStatus]),
) as Record<string, LiveAdapterStatus>;

const TOOL_LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/training", label: "Training hub", icon: BookOpen },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/backups", label: "Backups", icon: ShieldCheck },
  { href: "/linkedin", label: "LinkedIn", icon: Network },
  { href: "/warm-path", label: "Warm path", icon: Users },
  { href: "/boosters", label: "Boosters", icon: TrendingUp },
  { href: "/outcomes", label: "Outcomes", icon: Gauge },
] as const;

const MODULE_LINKS = [
  { href: "/import", label: "Import resume", icon: Upload },
  { href: "/master-resume", label: "Master resume", icon: Mic },
  { href: "/goals", label: "Career goals", icon: Target },
  { href: "/resume", label: "Tailor resume", icon: FileText },
  { href: "/companies", label: "Company brief", icon: Building2 },
] as const;

export function SettingsToolsPanel({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("border-t border-border pt-3", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center justify-between rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Settings & tools
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </button>

      {open && (
        <nav className="mt-1 flex flex-col gap-0.5 pb-1">
          {TOOL_LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                className={cn(
                  "flex min-h-11 items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors",
                  active
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">{label}</span>
                {LIVE_BY_HREF[href] && (
                  <LiveStatusBadge status={LIVE_BY_HREF[href]} />
                )}
              </Link>
            );
          })}
          <div className="my-2 border-t border-border" />
          <p className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Modules
          </p>
          {MODULE_LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                className={cn(
                  "flex min-h-11 items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors",
                  active
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">{label}</span>
                {LIVE_BY_HREF[href] && (
                  <LiveStatusBadge status={LIVE_BY_HREF[href]} />
                )}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
