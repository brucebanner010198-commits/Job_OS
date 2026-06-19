"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { JobOsLogo } from "@/components/brand/job-os-logo";
import { DbBanner } from "@/components/db-banner";
import { ThemeToggle } from "@/components/theme-toggle";
import { ProfileSwitcher } from "@/components/profile-switcher";
import { PipelineRail } from "@/components/pipeline/pipeline-rail";
import { AutopilotBanner } from "@/components/pipeline/autopilot-banner";
import { SettingsToolsPanel } from "@/components/settings-tools-panel";
import type { AutopilotBannerData } from "@/lib/autopilot/banner";
import type { ProfileSummary } from "@/app/actions/profiles";
import type { PipelineStageId } from "@/lib/pipeline/stages";

export function AppShell({
  children,
  profiles,
  activeProfile,
  homeStage,
  dbError,
  autopilotBanner,
}: {
  children: React.ReactNode;
  profiles: ProfileSummary[];
  activeProfile: ProfileSummary;
  /** Highlights pipeline stage on `/` (from setup status). */
  homeStage?: PipelineStageId;
  /** When true, show database connectivity banner above page content. */
  dbError?: boolean;
  autopilotBanner?: AutopilotBannerData | null;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Mobile header */}
      <header className="flex items-center justify-between border-b border-border bg-card/40 px-4 py-3 md:hidden">
        <Link
          href="/"
          className="flex min-h-11 items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setMobileOpen(false)}
        >
          <JobOsLogo />
        </Link>
        <div className="flex items-center gap-2">
          <div className="hidden min-w-[8rem] sm:block">
            <ProfileSwitcher profiles={profiles} activeProfile={activeProfile} />
          </div>
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="min-h-11 min-w-11 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Mobile drawer + backdrop */}
      {mobileOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-50 max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-border bg-card/95 px-4 py-3 shadow-lg md:hidden">
            <div className="mb-3">
              <ProfileSwitcher profiles={profiles} activeProfile={activeProfile} />
            </div>
            <PipelineRail homeStage={homeStage} onNavigate={() => setMobileOpen(false)} />
            <SettingsToolsPanel className="mt-3" onNavigate={() => setMobileOpen(false)} />
          </div>
        </>
      )}

      {/* Desktop sidebar - pipeline rail + settings drawer only */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card/40 p-4 md:flex">
        <Link
          href="/"
          className="mb-6 flex items-center rounded-lg px-2 pt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <JobOsLogo />
        </Link>
        <PipelineRail homeStage={homeStage} className="flex-1" />
        <SettingsToolsPanel className="mt-2 px-0" />
        <div className="mt-4 space-y-3 border-t border-border px-2 pt-4">
          <ProfileSwitcher profiles={profiles} activeProfile={activeProfile} />
          <ThemeToggle />
        </div>
      </aside>

      <div className="flex-1 overflow-x-hidden">
        {dbError && (
          <div className="page-container pb-0">
            <DbBanner />
          </div>
        )}
        <AutopilotBanner data={autopilotBanner ?? null} />
        {children}
      </div>
    </div>
  );
}
