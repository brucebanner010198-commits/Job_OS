/**
 * Backup runner (Phase 11) - `npm run backup`. The local half of "automated
 * encrypted versioned backups" (Hardening §E). Idempotent and safe to schedule:
 * by default it backs up ONLY when the latest snapshot is older than the daily
 * interval, so launchd/cron can call it freely without churning duplicates.
 *
 *   npm run backup                  # snapshot if due (scheduled), else skip
 *   npm run backup -- --force       # snapshot now regardless
 *   npm run backup -- list          # list indexed snapshots
 *   npm run backup -- restore <id>  # restore a snapshot (takes a safety snapshot first)
 *
 * Schedule it like the catch-up runner: a launchd agent with RunAtLoad +
 * StartInterval pointed at this script (the /backups page generates the plist).
 */
import { getPrimaryUser } from "@/lib/user";
import { resolveScope } from "@/lib/profiles/scope";
import {
  createBackup,
  listBackups,
  getBackupView,
  restoreBackup,
} from "@/lib/backup/service";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const user = await getPrimaryUser();
  const scope = await resolveScope(user.id);

  // restore <id>
  if (args[0] === "restore") {
    const id = args[1];
    if (!id) {
      console.error("[backup] usage: npm run backup -- restore <backupId>");
      process.exit(1);
    }
    const r = await restoreBackup(scope, id);
    if (!r.ok) {
      console.error(`[backup] restore failed: ${r.reason}`);
      process.exit(1);
    }
    console.log(
      `[backup] restored ${r.restoredEntries} entries, ${r.restoredNotes} notes ` +
        `(safety snapshot ${r.safetyBackupId}).`,
    );
    return;
  }

  // list
  if (args[0] === "list") {
    const rows = await listBackups(scope);
    if (rows.length === 0) {
      console.log("[backup] no snapshots yet.");
      return;
    }
    for (const b of rows) {
      console.log(
        `  ${b.createdAt}  ${b.trigger.padEnd(11)}  ` +
          `${b.entryCount} entries / ${b.noteCount} notes  ${b.byteSize}B  ${b.id}`,
      );
    }
    return;
  }

  // default: scheduled snapshot if due; --force overrides the due check
  const force = args.includes("--force");
  if (!force) {
    const view = await getBackupView(scope);
    if (!view.schedule.due) {
      console.log(`[backup] up to date - ${view.schedule.reason}. Skipping.`);
      return;
    }
  }

  const { record, deduped } = await createBackup(scope, {
    trigger: force ? "manual" : "scheduled",
    force,
  });
  if (deduped) {
    console.log("[backup] profile unchanged since last snapshot - deduped.");
    return;
  }
  console.log(
    `[backup] snapshot ${record.id} - ${record.entryCount} entries, ` +
      `${record.noteCount} notes, ${record.byteSize}B encrypted → ${record.fileName}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backup] fatal:", err);
    process.exit(1);
  });
