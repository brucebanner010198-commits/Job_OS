/**
 * Backups & export page (Phase 11, plan Hardening §E). The master profile is the
 * single most irreplaceable thing in Job OS, so this surface lets you:
 *   - take an encrypted, versioned snapshot on demand (and see the daily schedule),
 *   - restore any snapshot (always preceded by an automatic safety snapshot),
 *   - one-click export a portable plaintext copy of your own data,
 *   - and copy a launchd agent that runs `npm run backup` daily + on wake.
 *
 * Server component: the view loads through safeDb and degrades to a pure offline
 * preview when Postgres is unreachable, so the page always renders. The launchd
 * plist is generated server-side by reusing Phase 9's pure renderer.
 */
import { getAppContext } from "@/lib/app-context";
import { safeDb } from "@/lib/safe";
import { DbBanner } from "@/components/db-banner";
import { Badge } from "@/components/ui/badge";
import { getBackupView, previewBackup } from "@/lib/backup/service";
import { BACKUP_INTERVAL_SEC, type BackupView } from "@/lib/backup/types";
import {
  buildLaunchdConfig,
  renderLaunchdPlist,
  launchdInstall,
  launchdPlistPath,
} from "@/lib/scheduler/launchd";
import { BackupPanel, type LaunchdInfo } from "@/components/backups/backup-panel";

export const dynamic = "force-dynamic";

export default async function BackupsPage() {
  const res = await safeDb<BackupView | null>(async () => {
    const { scope } = await getAppContext();
    return getBackupView(scope);
  }, null);

  // The only reason getBackupView fails is the DB being unreachable, so preview
  // ⇔ dbError. An empty backup list with a live DB is a real (live) state.
  const usePreview = res.dbError || !res.data;
  const view: BackupView = usePreview ? previewBackup() : (res.data as BackupView);

  // Backup launchd agent - reuse Phase 9's pure generator pointed at `npm run backup`.
  const cwd = process.cwd();
  const cfg = buildLaunchdConfig({
    workingDirectory: cwd,
    label: "com.jobos.backup",
    intervalSec: BACKUP_INTERVAL_SEC,
    npmScript: "backup",
    logPath: `${cwd}/.backups/backup.log`,
  });
  const launchd: LaunchdInfo = {
    label: cfg.label,
    intervalSec: cfg.intervalSec,
    plistPath: launchdPlistPath(cfg.label),
    plist: renderLaunchdPlist(cfg),
    install: launchdInstall(cfg),
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Backups &amp; export
          </h1>
          {usePreview ? (
            <Badge variant="muted" className="text-[10px]">
              sample preview
            </Badge>
          ) : (
            <Badge variant="success" className="text-[10px]">
              live data
            </Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Your master profile is the one thing here you can&apos;t rebuild. Every
          snapshot is <strong>encrypted at rest</strong> (AES-256-GCM) with a key
          that never leaves this machine, and stored as a versioned file you can
          restore from. Restores always take a safety snapshot first, so nothing is
          ever lost.
        </p>
      </header>

      {res.dbError && <DbBanner />}

      <BackupPanel view={view} launchd={launchd} preview={usePreview} />
    </main>
  );
}
