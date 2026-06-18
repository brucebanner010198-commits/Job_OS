/**
 * Salary Negotiation Coach - pure, provenance-strict calculator.
 *
 * PURE: no LLM, no network, no DB, no Math.random, no Date.now.
 * Same shape as the LinkedIn optimizer (lib/linkedin/audit.ts): a stateless
 * brain that turns one offer + one user-supplied market anchor into a coached
 * counter plan.
 *
 * PROVENANCE SPINE (Hardening §B):
 *   - EVERY number traces to an INPUT - a figure the user typed on the offer or
 *     a market/competing anchor the user supplied. The coach NEVER invents a
 *     market number, a "typical" salary, or a relationship.
 *   - When no market anchor is given the coach reasons ONLY from a transparent,
 *     stated target-uplift assumption (DEFAULT_TARGET_UPLIFT).
 *   - The recommendation is a RANGE, never a single magic number, and always
 *     carries a walk-away / BATNA note.
 *   - draftMessage is a STARTING POINT the human edits - never auto-sent.
 */

import {
  COUNTER_RANGE_SPREAD,
  DEFAULT_TARGET_UPLIFT,
  MAX_UPLIFT_OVER_ANCHOR,
  type MarketAnchor,
  type NegotiationComponent,
  type NegotiationPlan,
  type OfferInput,
} from "./types";

// ---------------------------------------------------------------------------
// Local tuning (component-level asks; the base lever uses the shared constants)
// ---------------------------------------------------------------------------

/** A one-time signing ask, sized as a transparent fraction of the counter base. */
const SIGNING_ASK_PCT = 0.1;
/** Equity refresh ask: a modest uplift on the annualised equity figure. */
const EQUITY_UPLIFT = 0.15;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

const round = (n: number): number => Math.round(n);

const clamp = (value: number, lower: number, upper: number): number =>
  Math.min(Math.max(value, lower), upper);

/** Whole-percent label, e.g. 0.12 → "12%". */
const pct = (x: number): string => `${Math.round(x * 100)}%`;

/** Deterministic money formatter (en-US grouping; "$" for USD, else "CUR n"). */
function money(n: number, currency: string): string {
  const sign = n < 0 ? "-" : "";
  const grouped = Math.abs(Math.round(n)).toLocaleString("en-US");
  return currency === "USD" ? `${sign}$${grouped}` : `${sign}${currency} ${grouped}`;
}

/** Human label for the role, woven from whatever the offer supplied. */
function roleLabel(offer: OfferInput): string {
  if (offer.role && offer.level) return `${offer.role} (${offer.level})`;
  if (offer.role) return offer.role;
  if (offer.level) return `a ${offer.level} role`;
  return "this role";
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function buildNegotiationPlan(
  offer: OfferInput,
  anchor: MarketAnchor,
): NegotiationPlan {
  const currency = offer.currency;
  const company = offer.company ?? "your team";
  const role = roleLabel(offer);
  const hasMarketAnchor = anchor.marketBase !== undefined;

  // --- Base lever: counter, anchored & capped, competing offer is a floor ----
  const uplift = anchor.targetUpliftPct ?? DEFAULT_TARGET_UPLIFT;
  const baseFromUplift = round(offer.baseSalary * (1 + uplift));

  let counterBase: number;
  if (anchor.marketBase !== undefined) {
    const upper = round(anchor.marketBase * (1 + MAX_UPLIFT_OVER_ANCHOR));
    counterBase = clamp(baseFromUplift, anchor.marketBase, upper);
  } else {
    counterBase = baseFromUplift;
  }
  // A competing offer's base is a FLOOR - never counter below leverage in hand.
  if (anchor.hasCompetingOffer && anchor.competingBase !== undefined) {
    counterBase = Math.max(counterBase, anchor.competingBase);
  }

  const counterRange = {
    low: round(counterBase * (1 - COUNTER_RANGE_SPREAD)),
    high: round(counterBase * (1 + COUNTER_RANGE_SPREAD)),
  };

  // --- Component-by-component breakdown --------------------------------------
  const currentSigning = offer.signOnBonus ?? 0;
  const currentEquity = offer.equityPerYear ?? 0;
  const currentBonus = offer.bonus ?? 0;

  const signingSuggested = Math.max(
    currentSigning,
    round(counterBase * SIGNING_ASK_PCT),
  );
  const equitySuggested = currentEquity > 0 ? round(currentEquity * EQUITY_UPLIFT) : 0;

  // belowMarket is only meaningful against the BASE benchmark the user gave;
  // we never invent a per-component market figure, so non-base lines are false.
  const baseBelowMarket =
    anchor.marketBase !== undefined && offer.baseSalary < anchor.marketBase;

  const components: NegotiationComponent[] = [
    {
      name: "Base salary",
      current: offer.baseSalary,
      suggested: counterBase,
      belowMarket: baseBelowMarket,
      note: hasMarketAnchor
        ? `Lead here. Open at ${money(counterBase, currency)} and anchor to your stated market base of ${money(anchor.marketBase as number, currency)}; base compounds every future raise, bonus and equity refresh.`
        : `Lead here. Open at ${money(counterBase, currency)} - base is the primary lever and compounds into every future raise and bonus.`,
    },
    {
      name: "Signing bonus",
      current: currentSigning,
      suggested: signingSuggested,
      belowMarket: false,
      note: `A one-time signing bonus is the easiest lever for a company to flex when base is capped by a band. ${money(signingSuggested, currency)} is sized to ${pct(SIGNING_ASK_PCT)} of your counter base - ask for it to bridge any gap in year one.`,
    },
    {
      name: "Equity",
      current: currentEquity,
      suggested: equitySuggested,
      belowMarket: false,
      note:
        currentEquity > 0
          ? `Ask for a ${pct(EQUITY_UPLIFT)} uplift on the annualised grant (${money(currentEquity, currency)} → ${money(equitySuggested, currency)}). Quantify the dollar value and confirm the vesting schedule and refresh policy.`
          : `No equity was offered. If the role's level normally carries a grant, ask whether equity is on the table - but only request what the level supports.`,
    },
    {
      name: "Annual bonus",
      current: currentBonus,
      suggested: currentBonus,
      belowMarket: false,
      note: `Target/annual bonus is usually fixed to your level's band, so treat it as informational rather than a primary ask. Confirm the target percentage and payout history instead of negotiating the number.`,
    },
  ];

  // --- Talking points, strongest-first ---------------------------------------
  const talkingPoints: string[] = [];

  if (anchor.hasCompetingOffer) {
    if (anchor.competingBase !== undefined) {
      talkingPoints.push(
        `I'm holding a competing offer with a base of ${money(anchor.competingBase, currency)}, and ${company} is genuinely my first choice for ${role}${offer.location ? ` in ${offer.location}` : ""} - if we can close the gap on base I'm ready to commit.`,
      );
    } else {
      talkingPoints.push(
        `I'm holding a competing offer, and ${company} is genuinely my first choice for ${role}${offer.location ? ` in ${offer.location}` : ""} - aligning the base would let me commit here.`,
      );
    }
  } else {
    talkingPoints.push(
      `For ${role}${offer.location ? ` in ${offer.location}` : ""}, the scope of the role and the specialised skills I bring support a base nearer ${money(counterBase, currency)}.`,
    );
  }

  if (baseBelowMarket) {
    talkingPoints.push(
      `Based on the market base I researched (${money(anchor.marketBase as number, currency)}), the current offer of ${money(offer.baseSalary, currency)} sits below where comparable ${role} roles land.`,
    );
  }

  talkingPoints.push(
    `I'm excited about the work and want to make this easy to say yes to - could we look at a base in the ${money(counterRange.low, currency)}–${money(counterRange.high, currency)} range?`,
  );

  talkingPoints.push(
    `Engineers with my depth in this area are in short supply right now, and a counter is expected - a respectful one almost never puts an offer at risk.`,
  );

  // --- Leverage notes --------------------------------------------------------
  const leverageNotes: string[] = [];

  if (anchor.hasCompetingOffer) {
    leverageNotes.push(
      anchor.competingBase !== undefined
        ? `You hold a competing offer at a base of ${money(anchor.competingBase, currency)} - your single strongest point of leverage; it sets a hard floor under your counter.`
        : `You hold a competing offer - your single strongest point of leverage; let it set the floor for your counter.`,
    );
  }

  if (baseBelowMarket) {
    const gap = (anchor.marketBase as number) - offer.baseSalary;
    leverageNotes.push(
      `Your stated market base of ${money(anchor.marketBase as number, currency)} is ${money(gap, currency)} above the current offer - a concrete, defensible gap to point at.`,
    );
  }

  leverageNotes.push(
    `Specialised skills and a strong interview signal give you room to ask; companies budget for a counter and rarely rescind over a polite one.`,
  );

  // --- Walk-away / BATNA (always present) ------------------------------------
  const walkAwayNote =
    `Decide your walk-away point before you reply: the lowest total package you'd accept, and your best alternative - your current role, another offer in hand, or continuing the search. A counter only carries weight if you're genuinely prepared to decline.`;

  // --- Provenance trail: every number → an input -----------------------------
  const assumptions: string[] = [];

  assumptions.push(
    `Counter base = offered base ${money(offer.baseSalary, currency)} × (1 + ${pct(uplift)} target uplift) = ${money(baseFromUplift, currency)}.`,
  );

  if (hasMarketAnchor) {
    const upper = round((anchor.marketBase as number) * (1 + MAX_UPLIFT_OVER_ANCHOR));
    assumptions.push(
      `Anchored to your stated market base of ${money(anchor.marketBase as number, currency)}: counter floored at that figure and capped ${pct(MAX_UPLIFT_OVER_ANCHOR)} above it (${money(upper, currency)}) to stay credible.`,
    );
  } else {
    assumptions.push(
      `No market base was supplied, so the counter reasons only from the ${pct(uplift)} target-uplift assumption above - no external benchmark was used.`,
    );
  }

  if (anchor.hasCompetingOffer && anchor.competingBase !== undefined) {
    assumptions.push(
      `Your competing-offer base of ${money(anchor.competingBase, currency)} was used as a floor, so the counter never sits below leverage you already hold.`,
    );
  }

  assumptions.push(
    `Counter range = counter base ${money(counterBase, currency)} ± ${pct(COUNTER_RANGE_SPREAD)} → ${money(counterRange.low, currency)}–${money(counterRange.high, currency)}.`,
  );

  assumptions.push(
    `Signing ask = ${pct(SIGNING_ASK_PCT)} of the counter base${currentSigning > 0 ? `, or your offered ${money(currentSigning, currency)} if higher` : ""} = ${money(signingSuggested, currency)}.`,
  );

  assumptions.push(
    currentEquity > 0
      ? `Equity ask = your annualised grant ${money(currentEquity, currency)} × (1 + ${pct(EQUITY_UPLIFT)}) = ${money(equitySuggested, currency)}.`
      : `No equity figure was entered, so no equity number is suggested.`,
  );

  assumptions.push(
    `NO market figure was invented - every number above is derived only from the offer you entered${hasMarketAnchor ? " and the market base you supplied" : ""}${anchor.competingBase !== undefined ? " and your stated competing offer" : ""}.`,
  );

  // --- Editable counter draft (draft-first; never auto-sent) -----------------
  const draftMessage =
    `[Draft. Review and edit before you send. Nothing is sent automatically.]\n\n` +
    `Hi [hiring manager],\n\n` +
    `Thank you for the offer for the ${offer.role ?? "role"} position at ${company} - I'm genuinely excited about the team and the work.\n\n` +
    `After reviewing the full package, I'd like to discuss the base salary. ` +
    (anchor.hasCompetingOffer
      ? `I do have a competing offer, but ${company} is my preference, and I'm hoping we can align on compensation. `
      : ``) +
    `Based on the scope of the role${hasMarketAnchor ? " and the market data I've gathered" : ""}, I was hoping we could land a base in the ${money(counterRange.low, currency)}–${money(counterRange.high, currency)} range (I'd be anchoring around ${money(counterBase, currency)}).\n\n` +
    `I'm flexible on how we get there - signing bonus or equity could help bridge any gap if base is constrained. I'm confident we can find a number that works for both of us.\n\n` +
    `Thanks again, and I'm looking forward to your thoughts.\n\n` +
    `Best,\n[Your name]`;

  // --- provenanceOk: defensive finiteness check ------------------------------
  const numbers = [
    counterBase,
    counterRange.low,
    counterRange.high,
    ...components.flatMap((c) => [c.current, c.suggested]),
  ];
  let provenanceOk = numbers.every((n) => Number.isFinite(n));
  if (!provenanceOk) {
    assumptions.push(
      `PROVENANCE WARNING: a derived figure was non-finite (check the offer inputs). The plan is incomplete and must not be relied on.`,
    );
  }

  return {
    counterBase,
    counterRange,
    currency,
    components,
    talkingPoints,
    leverageNotes,
    walkAwayNote,
    draftMessage,
    assumptions,
    provenanceOk,
  };
}
