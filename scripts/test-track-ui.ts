/**
 * Contract test for the Phase 6 Track UI (page + two client components).
 * These are React components, so this asserts the load-bearing integration
 * points statically: exact server-action imports, exhaustive AppStatus /
 * EmailCategory maps (cross-checked against the real type module), readOnly
 * gating, and the required safety copy. Run: npx tsx scripts/test-track-ui.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BOARD_COLUMNS } from "@/lib/track/types";
import type { AppStatus, EmailCategory } from "@/lib/track/types";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const PAGE = read("app/(app)/track/page.tsx");
const BOARD = read("components/track/track-board.tsx");
const INBOX = read("components/track/inbox-proposals.tsx");

// Full enums (no runtime list of every status exists; BOARD_COLUMNS omits SKIPPED).
const ALL_STATUSES: AppStatus[] = [
  ...BOARD_COLUMNS,
  "SKIPPED",
];
const ALL_CATEGORIES: EmailCategory[] = [
  "INTERVIEW_INVITE",
  "ASSESSMENT",
  "RECRUITER_OUTREACH",
  "APPLICATION_RECEIVED",
  "SOFT_REJECTION",
  "REJECTION",
  "OFFER",
  "NOT_JOB",
];

let pass = 0;
let fail = 0;
const fails: string[] = [];

function check(name: string, ok: boolean) {
  if (ok) pass++;
  else {
    fail++;
    fails.push(name);
  }
}

// --- Page ---------------------------------------------------------------------
check("page: force-dynamic", PAGE.includes('export const dynamic = "force-dynamic"'));
check("page: TrackPage server component", /export default async function TrackPage/.test(PAGE));
check("page: awaits searchParams", PAGE.includes("await searchParams"));
check("page: imports service trio", /getBoardView/.test(PAGE) && /listProposalViews/.test(PAGE) && /previewTrack/.test(PAGE) && PAGE.includes('"@/lib/track/service"'));
check("page: imports gmailStatus", /gmailStatus/.test(PAGE) && PAGE.includes('"@/lib/gmail"'));
check("page: imports disconnectGmailAction", PAGE.includes("disconnectGmailAction") && PAGE.includes('"@/app/actions/track"'));
check("page: safeDb fallback", PAGE.includes("safeDb<Loaded>") && PAGE.includes("board: []") && PAGE.includes("proposals: []"));
check("page: usePreview branch", PAGE.includes("usePreview") && PAGE.includes("previewTrack()"));
check("page: safety subtitle", PAGE.includes("never moves a job") && PAGE.includes("a person always makes that change"));
check("page: DbBanner on dbError", PAGE.includes("{dbError && <DbBanner />}"));
check("page: gmail=connected notice", PAGE.includes('gmail === "connected"') && PAGE.includes("Gmail connected."));
check("page: gmail=error notice", PAGE.includes('gmail === "error"') && PAGE.includes("try reconnecting"));
check("page: gmail=unconfigured notice", PAGE.includes('gmail === "unconfigured"') && PAGE.includes("GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET"));
check("page: connected-as line", PAGE.includes("status.live") && PAGE.includes("Connected as"));
check("page: disconnect form", PAGE.includes("await disconnectGmailAction()") && PAGE.includes("Disconnect"));
check("page: connect link", PAGE.includes('href="/api/gmail/auth"') && PAGE.includes("Connect Gmail"));
check("page: enable hint when !enabled", PAGE.includes("!status.enabled") && PAGE.includes("Google OAuth client id/secret"));
check("page: preview-vs-live indicator", PAGE.includes("sample preview") && PAGE.includes("live data"));
check("page: renders children with readOnly", PAGE.includes("<InboxProposals proposals={proposals} readOnly={usePreview} />") && PAGE.includes("<TrackBoard board={board} readOnly={usePreview} />"));

// --- Board --------------------------------------------------------------------
check("board: use client", BOARD.startsWith("/**") && BOARD.includes('"use client"'));
check("board: props", BOARD.includes("board: BoardColumnView[]") && BOARD.includes("readOnly: boolean"));
check("board: imports moveApplicationAction", BOARD.includes("moveApplicationAction") && BOARD.includes('"@/app/actions/track"'));
check("board: imports BOARD_COLUMNS", BOARD.includes("BOARD_COLUMNS") && BOARD.includes('"@/lib/track/types"'));
check("board: useTransition + refresh", BOARD.includes("useTransition") && BOARD.includes("router.refresh()"));
check("board: move calls action(appId, to)", BOARD.includes("moveApplicationAction(appId, to)"));
check("board: select disabled in readOnly", BOARD.includes("disabled={readOnly || pending}"));
check("board: column title + count", BOARD.includes("{col.title}") && BOARD.includes("{col.apps.length}"));
check("board: route badge", BOARD.includes("{app.route &&"));
for (const s of ALL_STATUSES) {
  check(`board: STATUS_VARIANT[${s}]`, new RegExp(`${s}:`).test(BOARD.split("STATUS_VARIANT")[1] ?? ""));
  check(`board: STATUS_LABEL[${s}]`, new RegExp(`${s}:`).test(BOARD.split("STATUS_LABEL")[1] ?? ""));
  check(`board: COLUMN_ACCENT[${s}]`, new RegExp(`${s}:`).test(BOARD.split("COLUMN_ACCENT")[1] ?? ""));
}

// --- Inbox proposals ----------------------------------------------------------
check("inbox: use client", INBOX.startsWith("/**") && INBOX.includes('"use client"'));
check("inbox: props", INBOX.includes("proposals: ProposalView[]") && INBOX.includes("readOnly: boolean"));
check("inbox: imports the three actions", INBOX.includes("syncInboxAction") && INBOX.includes("confirmProposalAction") && INBOX.includes("dismissProposalAction") && INBOX.includes('"@/app/actions/track"'));
check("inbox: useTransition + refresh", INBOX.includes("useTransition") && INBOX.includes("router.refresh()"));
check("inbox: sync disabled in readOnly", INBOX.includes("connect a database to sync"));
check("inbox: confirm/dismiss disabled in readOnly", INBOX.includes("disabled={readOnly || pending}") && INBOX.includes("preview - connect a database to act"));
check("inbox: confirm calls action", INBOX.includes("act(confirmProposalAction)"));
check("inbox: dismiss calls action", INBOX.includes("act(dismissProposalAction)"));
check("inbox: proposed move from->to", INBOX.includes("proposal.fromStatus ? STATUS_LABEL[proposal.fromStatus]") && INBOX.includes("STATUS_LABEL[proposal.toStatus]"));
check("inbox: rationale", INBOX.includes("{proposal.rationale}"));
check("inbox: soft chip", INBOX.includes("proposal.soft") && INBOX.includes("soft rejection"));
check("inbox: requiresConfirm tag", INBOX.includes("proposal.requiresConfirm") && INBOX.includes("needs your confirmation"));
check("inbox: event time + cancel", INBOX.includes("proposal.eventStart") && INBOX.includes("proposal.eventCancelled") && INBOX.includes("(canceled)") && INBOX.includes("line-through"));
check("inbox: empty state", INBOX.includes("No pending proposals. Sync your inbox to check for updates."));
for (const c of ALL_CATEGORIES) {
  check(`inbox: CATEGORY_VARIANT[${c}]`, new RegExp(`${c}:`).test(INBOX.split("CATEGORY_VARIANT")[1] ?? ""));
  check(`inbox: CATEGORY_LABEL[${c}]`, new RegExp(`${c}:`).test(INBOX.split("CATEGORY_LABEL")[1] ?? ""));
}

// --- Report -------------------------------------------------------------------
const total = pass + fail;
if (fail > 0) {
  console.log(`FAILURES (${fail}):`);
  for (const f of fails) console.log("  ✗ " + f);
}
console.log(`track-ui ${pass}/${total}`);
process.exit(fail === 0 ? 0 : 1);
