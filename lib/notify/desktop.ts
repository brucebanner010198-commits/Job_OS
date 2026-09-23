/**
 * macOS notification for "a human is needed", so the user hears about it even
 * when the Job OS tab is not in front. SERVER-ONLY, local machine only.
 *
 * Off when not on macOS, in tests (NODE_ENV=test), or with JOBOS_DESKTOP_NOTIFY=0.
 * Text is passed to osascript as arguments, never spliced into the script.
 * Best-effort: a failure is ignored.
 */
import { execFile } from "node:child_process";

const SCRIPT = "on run argv\ndisplay notification (item 2 of argv) with title (item 1 of argv) sound name \"Glass\"\nend run";

export function notifyDesktop(title: string, message: string): void {
  if (process.platform !== "darwin") return;
  if (process.env.NODE_ENV === "test" || process.env.JOBOS_DESKTOP_NOTIFY === "0") return;
  const clean = (s: string) => s.replace(/[\u0000-\u001f]/g, " ").slice(0, 200);
  execFile("osascript", ["-e", SCRIPT, clean(title), clean(message)], { timeout: 5_000 }, () => undefined);
}
