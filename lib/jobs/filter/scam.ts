/**
 * Scam-job detection - rules-first, deterministic, no LLM.
 *
 * Based on FTC data (60k+ annual reports) and IC3 complaint patterns. The five
 * highest-signal scam markers are: upfront fees, requests for financial/personal
 * data, contact only via unofficial channels, unrealistic pay for unskilled work,
 * and wire-transfer / money-mule language.
 *
 * Conservative by design: a legitimately high salary alone is NOT a signal.
 * Each rule fires independently; the weighted sum is capped at 1.0. A score ≥
 * SCAM_THRESHOLD triggers `flagged = true`.
 *
 * The LLM borderline pass (plan §8a) is a documented seam; this module does not
 * implement it.
 */

import type { RawJob, RiskAssessment } from "@/lib/jobs/types";

/**
 * Score threshold above which a job is classified as a scam.
 * Set at 0.50: scams typically fire 2+ strong signals, legitimate postings fire 0.
 */
export const SCAM_THRESHOLD = 0.50;

// -- Rule weights -----------------------------------------------------------

const W_UPFRONT_FEE = 0.55;       // Strongest FTC signal - almost always a scam
const W_FINANCIAL_DATA = 0.55;    // Requesting SSN/bank before any offer = scam
const W_UNOFFICIAL_CONTACT = 0.35; // Telegram/WhatsApp/personal email only
const W_UNREALISTIC_PAY = 0.45;   // "$5k/week" + "no experience" = scam
const W_WIRE_TRANSFER = 0.55;     // Money-mule / wire language
const W_HIGH_PRESSURE = 0.25;     // Urgency + no company info

// -- Pattern sets -----------------------------------------------------------

/** Upfront fee language - covers "processing fee", "training fee", "onboarding fee". */
const UPFRONT_FEE_PATTERNS = [
  /\bprocessing\s+fee\b/i,
  /\bonboarding\s+fee\b/i,
  /\btraining\s+fee\b/i,
  /\bregistration\s+fee\b/i,
  /\bbackground\s+check\s+fee\b/i,
  /\bpay\s+for\s+your\s+(training|equipment|kit|materials)\b/i,
  /\bpurchase\s+(your\s+)?(equipment|starter\s+kit|materials)\b/i,
  /\brequired\s+to\s+pay\b/i,
  /\bupfront\s+(cost|fee|payment|deposit)\b/i,
  /\binitial\s+(fee|investment|deposit)\b/i,
];

/** Financial / identity data requests - SSN, bank account, routing number. */
const FINANCIAL_DATA_PATTERNS = [
  /\bssn\b/i,
  /\bsocial\s+security\s+number\b/i,
  /\bbank\s+account\s+(number|details|info)\b/i,
  /\brouting\s+number\b/i,
  /\bwire\s+transfer\s+(your|the)\s+information\b/i,
  /\bfinancial\s+(details|information|data)\s+before\b/i,
  /\bprovide\s+(your\s+)?banking\s+details\b/i,
  /\bcredit\s+card\s+(number|details|info)\b/i,
];

/** Contact-only-via-unofficial-channels patterns. */
const UNOFFICIAL_CONTACT_PATTERNS = [
  /\bcontact\s+(us\s+)?via\s+telegram\b/i,
  /\bapply\s+(via|through|on)\s+telegram\b/i,
  /\btelegram\s+(only|username|handle)\b/i,
  /\bwhatsapp\s+(only|number|me|us)\b/i,
  /\bcontact\s+(us\s+)?via\s+whatsapp\b/i,
  /\bapply\s+(via|through)\s+whatsapp\b/i,
  /\bgmail\.com\s+(only|address|contact)\b/i,
  /\bhotmail\.com\s+(only|address|contact)\b/i,
  /\byahoo\.com\s+(only|address|contact)\b/i,
  /\bsend\s+(your\s+)?resume\s+to\s+\w+@(gmail|yahoo|hotmail|outlook)\.com\b/i,
];

/** Wire transfer / money-mule language. */
const WIRE_TRANSFER_PATTERNS = [
  /\bwire\s+transfer\b/i,
  /\bsend\s+(us\s+)?money\b/i,
  /\btransfer\s+funds\b/i,
  /\bmoney\s+(order|mule|transfer)\b/i,
  /\bcash\s+(the\s+)?check\s+and\s+(send|forward|wire)\b/i,
  /\bforward\s+(the\s+)?(payment|funds|money)\b/i,
  /\bgift\s+card\s+(payment|purchase|required)\b/i,
  /\bbitcoin\s+(payment|transfer|required)\b/i,
  /\bcryptocurrency\s+(payment|required)\b/i,
];

/** High-pressure urgency with no company specifics. */
const HIGH_PRESSURE_PATTERNS = [
  /\bimmediate\s+(start|hire|position)\b/i,
  /\burgently\s+(hiring|needed|required)\b/i,
  /\blimited\s+positions?\s+(available|left|remaining)\b/i,
  /\bact\s+now\b/i,
  /\bdon['']t\s+miss\s+this\s+opportunity\b/i,
  /\bresponses?\s+within\s+24\s+hours?\b/i,
];

/** Entry-level / no-experience signals (combined with unrealistic pay). */
const NO_EXPERIENCE_PATTERNS = [
  /\bno\s+experience\s+(required|needed|necessary)\b/i,
  /\bentry[-\s]?level\b/i,
  /\bbeginner\s+friendly\b/i,
  /\bno\s+skills?\s+(required|needed)\b/i,
  /\btraining\s+(provided|included)\b/i,
];

/**
 * Match unrealistic pay claims. Returns true if the description promises
 * extremely high hourly/weekly rates while also signalling entry-level work.
 */
function hasUnrealisticPayForNoExperience(desc: string): boolean {
  const hasNoExperience = NO_EXPERIENCE_PATTERNS.some((p) => p.test(desc));
  if (!hasNoExperience) return false;

  // Hourly rate > $100 for entry-level
  const highHourly = /\$\s*(\d+)\s*\/\s*(hr|hour)/i.exec(desc);
  if (highHourly && parseInt(highHourly[1], 10) >= 100) return true;

  // Weekly pay > $2,000 for entry-level (equivalent to ~$50/hr+)
  const highWeekly = /\$\s*([\d,]+)\s*\/?\s*(week|wk)/i.exec(desc);
  if (highWeekly) {
    const amount = parseInt(highWeekly[1].replace(/,/g, ""), 10);
    if (amount >= 2_000) return true;
  }

  // Monthly pay > $8,000 for entry-level
  const highMonthly = /\$\s*([\d,]+)\s*\/?\s*(month|mo)\b/i.exec(desc);
  if (highMonthly) {
    const amount = parseInt(highMonthly[1].replace(/,/g, ""), 10);
    if (amount >= 8_000) return true;
  }

  // Annual salary > $120k for "no experience required"
  const highAnnual = /\$\s*([\d,]+)\s*(k\b|,000|\s*\/\s*yr|\s*\/\s*year)/i.exec(desc);
  if (highAnnual) {
    const rawNum = highAnnual[1].replace(/,/g, "");
    const multiplier = /k\b/i.test(highAnnual[2]) ? 1_000 : 1;
    const amount = parseInt(rawNum, 10) * multiplier;
    if (amount >= 120_000) return true;
  }

  return false;
}

/**
 * Assess whether a raw job is likely a scam posting.
 * Returns a RiskAssessment with score in [0,1], human-readable reasons, and
 * flagged=true when score ≥ SCAM_THRESHOLD.
 */
export function assessScam(raw: RawJob): RiskAssessment {
  const reasons: string[] = [];
  let score = 0;

  const desc = raw.description ?? "";
  const title = raw.title ?? "";
  const combined = `${title} ${desc}`;

  // -- Rule 1: Upfront fee language --------------------------------------
  for (const p of UPFRONT_FEE_PATTERNS) {
    if (p.test(combined)) {
      reasons.push("Requires upfront payment (processing/training/onboarding fee) - FTC scam indicator");
      score += W_UPFRONT_FEE;
      break;
    }
  }

  // -- Rule 2: Financial / identity data request -------------------------
  for (const p of FINANCIAL_DATA_PATTERNS) {
    if (p.test(combined)) {
      reasons.push("Requests financial or identity details (SSN, bank account, routing number)");
      score += W_FINANCIAL_DATA;
      break;
    }
  }

  // -- Rule 3: Contact via unofficial channel only -----------------------
  for (const p of UNOFFICIAL_CONTACT_PATTERNS) {
    if (p.test(combined)) {
      reasons.push("Contact limited to unofficial channels (Telegram, WhatsApp, personal email)");
      score += W_UNOFFICIAL_CONTACT;
      break;
    }
  }

  // -- Rule 4: Wire transfer / money-mule language -----------------------
  for (const p of WIRE_TRANSFER_PATTERNS) {
    if (p.test(combined)) {
      reasons.push("Wire transfer or money forwarding language detected - money-mule indicator");
      score += W_WIRE_TRANSFER;
      break;
    }
  }

  // -- Rule 5: Unrealistic pay for no-experience role --------------------
  if (hasUnrealisticPayForNoExperience(combined)) {
    reasons.push(
      "Claims unusually high pay ($100+/hr or $2k+/wk) for a no-experience / entry-level role",
    );
    score += W_UNREALISTIC_PAY;
  }

  // -- Rule 6: High-pressure urgency with no company info ----------------
  const urgencyCount = HIGH_PRESSURE_PATTERNS.filter((p) => p.test(combined)).length;
  const hasCompanyInfo =
    raw.company.length > 3 &&
    !/^(n\/a|unknown|company|employer|client)$/i.test(raw.company.trim());

  if (urgencyCount >= 2 && !hasCompanyInfo) {
    reasons.push(
      "Multiple high-pressure urgency signals combined with missing or generic company identity",
    );
    score += W_HIGH_PRESSURE;
  }

  // Cap at 1.0
  const finalScore = Math.min(score, 1.0);

  return {
    score: finalScore,
    reasons,
    flagged: finalScore >= SCAM_THRESHOLD,
  };
}
