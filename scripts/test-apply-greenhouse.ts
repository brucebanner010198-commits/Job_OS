/**
 * Greenhouse form filler gate: offline, no DB, no network, no browser.
 *
 *   A. URL recognition.
 *   B. Planner: approved values only, Yes/No only into dropdowns, agreements
 *      never ticked, required blanks reported, EEO only when the user gave it.
 *   C. Driver: fills through the page seam, never submits, reports blanks,
 *      leaves the window open after hand-off, ignores invisible reCAPTCHA only.
 * Run: npx tsx scripts/test-apply-greenhouse.ts
 */
import {
  parseGreenhouseJobUrl,
  planGreenhouseFill,
  splitName,
  type GreenhouseForm,
} from "@/lib/apply/greenhouse";
import {
  greenhouseDriver,
  ignoreInvisibleRecaptcha,
  type GreenhousePage,
} from "@/lib/apply/driver-greenhouse";
import { buildSignals, type RawPage } from "@/lib/apply/driver-playwright";
import { scanPage } from "@/lib/apply/detection";
import type { PreparedField } from "@/lib/apply/types";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

const yesNo = [
  { label: "Yes", value: 1 },
  { label: "No", value: 0 },
];

// Shape copied from a live boards-api response (questions=true), trimmed.
const FORM: GreenhouseForm = {
  questions: [
    { label: "First Name", required: true, fields: [{ name: "first_name", type: "input_text", values: [] }] },
    { label: "Last Name", required: true, fields: [{ name: "last_name", type: "input_text", values: [] }] },
    { label: "Email", required: true, fields: [{ name: "email", type: "input_text", values: [] }] },
    { label: "Phone", required: false, fields: [{ name: "phone", type: "input_text", values: [] }] },
    {
      label: "Resume/CV",
      required: true,
      fields: [
        { name: "resume", type: "input_file", values: [] },
        { name: "resume_text", type: "textarea", values: [] },
      ],
    },
    { label: "Website", required: false, fields: [{ name: "question_1", type: "input_text", values: [] }] },
    { label: "Why Anthropic?", required: true, fields: [{ name: "question_2", type: "textarea", values: [] }] },
    {
      label: "Do you require visa sponsorship? ",
      required: true,
      fields: [{ name: "question_3", type: "multi_value_single_select", values: yesNo }],
    },
    { label: "LinkedIn Profile", required: false, fields: [{ name: "question_4", type: "input_text", values: [] }] },
    {
      label: "Are you open to relocation for this role? ",
      required: true,
      fields: [{ name: "question_5", type: "multi_value_single_select", values: yesNo }],
    },
    {
      label: 'What is the address from which you plan on working? If you would need to relocate, please type "relocating".',
      required: false,
      fields: [{ name: "question_6", type: "input_text", values: [] }],
    },
    {
      label: "Agreement to Arbitrate",
      required: true,
      fields: [
        {
          name: "question_7",
          type: "multi_value_single_select",
          values: [{ label: "I understand and agree to the terms.", value: 9 }],
        },
      ],
    },
  ],
  compliance: [
    {
      label: "VeteranStatus",
      required: false,
      fields: [
        {
          name: "veteran_status",
          type: "multi_value_single_select",
          values: [
            { label: "I don't wish to answer", value: "3" },
            { label: "I am not a protected veteran", value: "1" },
          ],
        },
      ],
    },
  ],
};

const f = (key: string, value: string, source: PreparedField["source"] = "answers"): PreparedField => ({
  key,
  label: key,
  value,
  source,
  confidence: 1,
  critical: false,
  freeText: false,
});

const APPROVED: PreparedField[] = [
  f("fullName", "Ada Lovelace King", "profile"),
  f("email", "ada@example.com", "profile"),
  f("phone", "", "unknown"),
  f("linkedinUrl", "https://linkedin.com/in/ada"),
  f("requiresSponsorship", "No"),
  f("willingToRelocate", "Yes"),
];

async function main(): Promise<void> {
  console.log("\nA. URL recognition:");
  check(
    "job-boards URL parses",
    JSON.stringify(parseGreenhouseJobUrl("https://job-boards.greenhouse.io/anthropic/jobs/5421031008")) ===
      JSON.stringify({ board: "anthropic", jobId: "5421031008" }),
  );
  check("legacy boards URL parses", parseGreenhouseJobUrl("https://boards.greenhouse.io/stripe/jobs/123") !== null);
  check("http is refused", parseGreenhouseJobUrl("http://job-boards.greenhouse.io/a/jobs/1") === null);
  check("other hosts are refused", parseGreenhouseJobUrl("https://evil.example/anthropic/jobs/1") === null);
  check("company embed (gh_jid) is not claimed", parseGreenhouseJobUrl("https://stripe.com/jobs?gh_jid=1") === null);

  console.log("\nB. Planner:");
  const plan = planGreenhouseFill(FORM, APPROVED);
  const byId = new Map(plan.actions.map((a) => [a.id, a]));
  check("name split into first and last", splitName("Ada Lovelace King").last === "Lovelace King");
  check(
    "first/last/email typed",
    JSON.stringify(byId.get("first_name")) === JSON.stringify({ kind: "text", id: "first_name", value: "Ada" }) &&
      (byId.get("last_name") as { value?: string })?.value === "Lovelace King" &&
      (byId.get("email") as { value?: string })?.value === "ada@example.com",
  );
  check("unknown phone is not filled", !byId.has("phone"));
  check("resume upload planned", byId.get("resume")?.kind === "file");
  check("resume text box left alone", !byId.has("resume_text"));
  check("LinkedIn filled from approved answer", (byId.get("question_4") as { value?: string })?.value === "https://linkedin.com/in/ada");
  check("sponsorship dropdown gets 'No'", (byId.get("question_3") as { option?: string })?.option === "No");
  check("relocation dropdown gets 'Yes'", (byId.get("question_5") as { option?: string })?.option === "Yes");
  check("address box is NOT given the relocation Yes/No", !byId.has("question_6"));
  check("arbitration agreement is never ticked", !byId.has("question_7"));
  check("EEO left alone when the user gave none", !byId.has("veteran_status"));
  check(
    "required blanks reported in form order",
    JSON.stringify(plan.unanswered) === JSON.stringify(["Why Anthropic?", "Agreement to Arbitrate"]),
  );

  const withEeo = planGreenhouseFill(FORM, [...APPROVED, f("eeoVeteran", "I am not a protected veteran")]);
  check("EEO filled only with the user's own exact choice", withEeo.actions.some((a) => a.id === "veteran_status"));
  const badOption = planGreenhouseFill(FORM, [f("requiresSponsorship", "Maybe")]);
  check("answer with no matching option is skipped", !badOption.actions.some((a) => a.id === "question_3"));

  console.log("\nC. Driver:");
  const calls: string[] = [];
  let closed = 0;
  const raw: RawPage = {
    url: "https://job-boards.greenhouse.io/anthropic/jobs/1",
    scriptSrcs: [],
    htmlLower:
      '<iframe src="https://www.recaptcha.net/recaptcha/enterprise/anchor?size=invisible"></iframe><textarea name="g-recaptcha-response">',
    hasPasswordField: false,
  };
  const page: GreenhousePage = {
    readRaw: async () => raw,
    fillText: async (id, v) => (calls.push(`text:${id}=${v}`), true),
    chooseOption: async (id, o) => (calls.push(`select:${id}=${o}`), id !== "question_5"),
    attachFile: async (id) => (calls.push(`file:${id}`), true),
  };
  const driver = greenhouseDriver({
    launcher: async () => ({ page, close: async () => void closed++ }),
    loadForm: async () => FORM,
    closeWhenDone: false,
  });
  await driver.open("https://job-boards.greenhouse.io/anthropic/jobs/1");
  const signals = await driver.scan();
  check("invisible reCAPTCHA alone scans clean", scanPage(signals).clean);
  await driver.fill(APPROVED);
  check("resume not uploaded during fill", !calls.some((c) => c.startsWith("file:")));
  const attached = await driver.attachResume!("/tmp/resume.pdf");
  check("resume attached to #resume", attached && calls.includes("file:resume"));
  const result = await driver.submit();
  check("never submits: outcome is stopped_at_review", result.outcome === "stopped_at_review");
  check("required blanks handed to the user", (result.unanswered ?? []).includes("Why Anthropic?"));
  check("a field the page rejected is reported", (result.unanswered ?? []).some((u) => u.includes("question_5")));
  let threw = false;
  try {
    await driver.submit();
  } catch {
    threw = true;
  }
  check("second submit() throws", threw);
  await driver.close!();
  check("window left open for the user after hand-off", closed === 0);

  const early = greenhouseDriver({
    launcher: async () => ({ page, close: async () => void closed++ }),
    loadForm: async () => FORM,
    closeWhenDone: false,
  });
  await early.open("https://job-boards.greenhouse.io/anthropic/jobs/1");
  await early.close!();
  check("browser closed when the run stops before hand-off", closed === 1);

  console.log("\nD. Detection still blocks real challenges:");
  const visible: RawPage = {
    ...raw,
    htmlLower: '<iframe src="https://www.google.com/recaptcha/api2/bframe?k=x"></iframe><div class="g-recaptcha">',
  };
  check(
    "visible reCAPTCHA challenge is NOT ignored",
    !scanPage(ignoreInvisibleRecaptcha(buildSignals(visible), visible)).clean,
  );
  const cf: RawPage = { ...raw, htmlLower: raw.htmlLower + '<div class="cf-turnstile">' };
  check("Cloudflare Turnstile still blocks", !scanPage(ignoreInvisibleRecaptcha(buildSignals(cf), cf)).clean);
  const login: RawPage = { ...raw, hasPasswordField: true };
  check("login wall still blocks", !scanPage(ignoreInvisibleRecaptcha(buildSignals(login), login)).clean);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
