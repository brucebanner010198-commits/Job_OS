/**
 * Itemized field plan - the review gate (plan §8c).
 *
 * Builds the ordered list of PreparedField rows that the review gate presents
 * to the user before any submit. Each row carries its source, confidence, and
 * criticality so the router and UI can gate the AUTONOMOUS lane correctly.
 *
 * Key rules:
 *   - Values come only from the user's confirmed ApplicationAnswersData or
 *     their profile contact - never inferred by an LLM at submit time (plan §C).
 *   - Unknown (absent) answers stay unknown: source="unknown", value="",
 *     confidence=0.2. Never fabricated.
 *   - `critical` is set true exactly for keys in CRITICAL_FIELD_KEYS.
 *   - Free-text / essay fields are detected from JD keywords and appended as
 *     freeText:true rows (also gates autonomy).
 *
 * Pure, deterministic - no LLM, no network, no DB.
 */

import type {
  ApplicationAnswersData,
  PreparedField,
  FieldSource,
} from "@/lib/apply/types";
import { CRITICAL_FIELD_KEYS } from "@/lib/apply/types";

// -- Free-text keyword detection -----------------------------------------------

const FREE_TEXT_RE =
  /cover\s+letter|why\s+do\s+you\s+want\s+to\s+work|tell\s+us\s+about|in\s+your\s+own\s+words|personal\s+statement/i;

// -- Internal field builder helpers -------------------------------------------

function makeField(
  key: string,
  label: string,
  value: string | undefined,
  source: FieldSource,
): PreparedField {
  const present = value !== undefined && value !== "";
  return {
    key,
    label,
    value: present ? value : "",
    source: present ? source : "unknown",
    confidence: present ? 0.95 : 0.2,
    critical: CRITICAL_FIELD_KEYS.has(key),
    freeText: false,
  };
}

function fromProfile(
  key: string,
  label: string,
  value: string | undefined,
): PreparedField {
  return makeField(key, label, value, "profile");
}

function fromAnswers(
  key: string,
  label: string,
  value: string | undefined,
): PreparedField {
  return makeField(key, label, value, "answers");
}

/** Stringify an optional boolean for form display. */
function boolStr(v: boolean | undefined): string | undefined {
  if (v === undefined) return undefined;
  return v ? "Yes" : "No";
}

// -- Public API ----------------------------------------------------------------

export function planFields(input: {
  jobText: string;
  answers: ApplicationAnswersData;
  contact: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    links?: string[];
  };
}): PreparedField[] {
  const { jobText, answers, contact } = input;
  const fields: PreparedField[] = [];

  // -- Contact / profile fields -----------------------------------------------
  fields.push(fromProfile("fullName", "Full name", contact.name));
  fields.push(fromProfile("email", "Email address", contact.email));
  fields.push(fromProfile("phone", "Phone number", contact.phone));
  fields.push(fromProfile("location", "Location", contact.location));

  // -- URL fields (from answers) ----------------------------------------------
  fields.push(fromAnswers("linkedinUrl", "LinkedIn URL", answers.linkedinUrl));
  fields.push(fromAnswers("githubUrl", "GitHub URL", answers.githubUrl));
  fields.push(fromAnswers("websiteUrl", "Website / portfolio URL", answers.websiteUrl));

  // -- Critical answers fields ------------------------------------------------
  fields.push(
    fromAnswers(
      "workAuthorization",
      "Authorized to work in the US?",
      boolStr(answers.workAuthorized),
    ),
  );
  fields.push(
    fromAnswers(
      "requiresSponsorship",
      "Requires visa sponsorship?",
      boolStr(answers.requiresSponsorship),
    ),
  );
  fields.push(
    fromAnswers(
      "salaryExpectation",
      "Salary expectation",
      answers.salaryExpectation !== undefined
        ? answers.salaryCurrency
          ? `${answers.salaryExpectation} ${answers.salaryCurrency}`
          : String(answers.salaryExpectation)
        : undefined,
    ),
  );
  fields.push(
    fromAnswers("clearance", "Security clearance", boolStr(answers.hasClearance)),
  );

  // -- Non-critical answers fields --------------------------------------------
  fields.push(
    fromAnswers(
      "yearsExperience",
      "Years of experience",
      answers.yearsExperience !== undefined
        ? String(answers.yearsExperience)
        : undefined,
    ),
  );
  fields.push(
    fromAnswers(
      "willingToRelocate",
      "Willing to relocate?",
      boolStr(answers.willingToRelocate),
    ),
  );
  fields.push(fromAnswers("noticePeriod", "Notice period", answers.noticePeriod));

  // -- EEO - only added when eeo is present; never fabricated -----------------
  if (answers.eeo !== undefined) {
    fields.push(fromAnswers("eeoRace", "Race / ethnicity", answers.eeo["race"]));
    fields.push(fromAnswers("eeoGender", "Gender", answers.eeo["gender"]));
    fields.push(fromAnswers("eeoVeteran", "Veteran status", answers.eeo["veteran"]));
    fields.push(
      fromAnswers("eeoDisability", "Disability status", answers.eeo["disability"]),
    );
  }

  // -- Free-text / essay detection -------------------------------------------
  if (FREE_TEXT_RE.test(jobText)) {
    fields.push({
      key: "coverLetter",
      label: "Cover letter / free response",
      value: "",
      source: "unknown",
      confidence: 0,
      critical: false,
      freeText: true,
    });
  }

  return fields;
}
