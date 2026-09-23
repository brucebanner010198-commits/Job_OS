/**
 * Greenhouse form planner. Greenhouse publishes every application question
 * (label, field name, type, options) on its public job-board API, and the live
 * form uses the same field names as input ids. So we can plan the whole fill
 * before opening a browser, and the browser step only types into known ids.
 *
 * Values come only from the PreparedField rows the user approved at the
 * review gate. Nothing is guessed: a question we can't answer from those rows
 * stays blank and is reported back. Agreements (arbitration, terms, consent)
 * are never ticked for the user.
 *
 * Pure except fetchGreenhouseForm (one GET to the public API).
 */
import type { PreparedField } from "@/lib/apply/types";

export interface GreenhouseJobRef {
  board: string;
  jobId: string;
}

export type GreenhouseFieldType =
  | "input_text"
  | "input_file"
  | "input_hidden"
  | "textarea"
  | "multi_value_single_select"
  | "multi_value_multi_select";

export interface GreenhouseField {
  name: string;
  type: GreenhouseFieldType | string;
  values: { label: string; value: string | number }[];
}

export interface GreenhouseQuestion {
  label: string;
  required: boolean;
  fields: GreenhouseField[];
}

export interface GreenhouseForm {
  questions: GreenhouseQuestion[];
  /** EEO / voluntary self-identification questions. */
  compliance: GreenhouseQuestion[];
}

export type FillAction =
  | { kind: "text"; id: string; value: string }
  | { kind: "select"; id: string; option: string }
  | { kind: "file"; id: string };

export interface GreenhousePlan {
  actions: FillAction[];
  /** Required questions left blank, in form order, for the user to finish. */
  unanswered: string[];
}

const HOSTS = new Set(["job-boards.greenhouse.io", "boards.greenhouse.io"]);
const SAFE_SEGMENT = /^[A-Za-z0-9_-]{1,80}$/;

/** Recognize a hosted Greenhouse job URL. Company-site embeds (?gh_jid=) return null. */
export function parseGreenhouseJobUrl(url: string): GreenhouseJobRef | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || !HOSTS.has(u.hostname)) return null;
  const m = u.pathname.match(/^\/([^/]+)\/jobs\/(\d+)\/?$/);
  if (!m || !SAFE_SEGMENT.test(m[1]!)) return null;
  return { board: m[1]!, jobId: m[2]! };
}

/** Fetch the form's questions from the public job-board API. */
export async function fetchGreenhouseForm(
  ref: GreenhouseJobRef,
  fetchImpl: typeof fetch = fetch,
): Promise<GreenhouseForm> {
  const res = await fetchImpl(
    `https://boards-api.greenhouse.io/v1/boards/${ref.board}/jobs/${ref.jobId}?questions=true`,
    { signal: AbortSignal.timeout(10_000), headers: { Accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`Greenhouse job API returned HTTP ${res.status}`);
  const body = (await res.json()) as {
    questions?: GreenhouseQuestion[];
    compliance?: { questions?: GreenhouseQuestion[] }[] | null;
  };
  return {
    questions: Array.isArray(body.questions) ? body.questions : [],
    compliance: (body.compliance ?? []).flatMap((c) => c.questions ?? []),
  };
}

// --- planning (pure) ---------------------------------------------------------

/** Labels that ask the user to accept terms. Never answered for them. */
const AGREEMENT_RE = /agree|acknowledg|arbitrat|certif|attest|consent|terms|privacy|policy/i;

/**
 * Question label → the PreparedField key whose approved value answers it.
 * Yes/No answers go only into dropdowns: "If you would need to relocate,
 * type 'relocating'" is an address box, not a relocation question.
 */
const LABEL_RULES: { re: RegExp; key: string; selectOnly?: boolean }[] = [
  { re: /linkedin/i, key: "linkedinUrl" },
  { re: /github/i, key: "githubUrl" },
  { re: /website|portfolio|personal (site|url)/i, key: "websiteUrl" },
  { re: /sponsor/i, key: "requiresSponsorship", selectOnly: true },
  {
    re: /(legally )?(authori[sz]ed|eligible) to work|work authori[sz]ation/i,
    key: "workAuthorization",
    selectOnly: true,
  },
  { re: /relocat/i, key: "willingToRelocate", selectOnly: true },
  { re: /salary|compensation expectation|expected (pay|compensation)/i, key: "salaryExpectation" },
  { re: /notice period/i, key: "noticePeriod" },
  { re: /years of (professional |relevant )?experience/i, key: "yearsExperience" },
  { re: /security clearance/i, key: "clearance", selectOnly: true },
];

/** Greenhouse's standard field names → PreparedField keys. */
const NAME_RULES: Record<string, string> = {
  email: "email",
  phone: "phone",
};

/** EEO field names → PreparedField keys (only filled when the user gave them). */
const EEO_RULES: Record<string, string> = {
  gender: "eeoGender",
  race: "eeoRace",
  veteran_status: "eeoVeteran",
  disability_status: "eeoDisability",
};

function approvedValue(fields: Map<string, PreparedField>, key: string): string {
  const f = fields.get(key);
  if (!f || f.source === "unknown") return "";
  return f.value.trim();
}

/** "Jane Q Doe" → ["Jane", "Q Doe"]. A single word gives no last name. */
export function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { first: parts[0] ?? "", last: "" };
  return { first: parts[0]!, last: parts.slice(1).join(" ") };
}

/** Pick the option whose label equals the answer (case-insensitive), if any. */
function matchOption(field: GreenhouseField, answer: string): string | null {
  const a = answer.trim().toLowerCase();
  const hit = field.values.find((v) => v.label.trim().toLowerCase() === a);
  return hit ? hit.label : null;
}

function valueFor(
  question: GreenhouseQuestion,
  field: GreenhouseField,
  fields: Map<string, PreparedField>,
): string {
  if (field.name === "first_name" || field.name === "last_name") {
    const { first, last } = splitName(approvedValue(fields, "fullName"));
    return field.name === "first_name" ? first : last;
  }
  const byName = NAME_RULES[field.name];
  if (byName) return approvedValue(fields, byName);
  const isSelect = field.type === "multi_value_single_select";
  const rule = LABEL_RULES.find((r) => r.re.test(question.label));
  if (!rule || (rule.selectOnly && !isSelect)) return "";
  return approvedValue(fields, rule.key);
}

/**
 * Turn Greenhouse's question list plus the approved field values into browser
 * actions. PURE and deterministic.
 */
export function planGreenhouseFill(
  form: GreenhouseForm,
  approved: PreparedField[],
): GreenhousePlan {
  const fields = new Map(approved.map((f) => [f.key, f]));
  const actions: FillAction[] = [];
  const unanswered: string[] = [];

  for (const q of form.questions) {
    let answered = false;
    for (const field of q.fields) {
      if (field.type === "input_hidden") continue;
      if (field.type === "input_file") {
        // Only the resume slot gets the tailored PDF; cover letters stay with the user.
        if (field.name === "resume") {
          actions.push({ kind: "file", id: field.name });
          answered = true;
        }
        continue;
      }
      // The pasted-text alternatives to an upload are left alone.
      if (field.name === "resume_text" || field.name === "cover_letter_text") continue;
      if (field.type === "multi_value_multi_select") continue;
      if (AGREEMENT_RE.test(q.label)) continue;

      const value = valueFor(q, field, fields);
      if (!value) continue;
      if (field.type === "multi_value_single_select") {
        const option = matchOption(field, value);
        if (!option) continue;
        actions.push({ kind: "select", id: field.name, option });
      } else {
        actions.push({ kind: "text", id: field.name, value });
      }
      answered = true;
    }
    if (q.required && !answered) unanswered.push(q.label.trim());
  }

  // Voluntary EEO questions: filled only with the user's own saved choice.
  for (const q of form.compliance) {
    for (const field of q.fields) {
      const key = EEO_RULES[field.name];
      if (!key || field.type !== "multi_value_single_select") continue;
      const option = matchOption(field, approvedValue(fields, key));
      if (option) actions.push({ kind: "select", id: field.name, option });
    }
  }

  return { actions, unanswered };
}
