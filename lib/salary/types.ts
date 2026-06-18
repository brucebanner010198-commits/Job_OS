/**
 * Salary negotiation coach contract (Phase 7 booster, plan §10) - the
 * best-return 10 minutes of the search (~66% who negotiate gain ~+18-20%).
 * Stateless: the brain (lib/salary/negotiate.ts) is a pure calculator, no DB -
 * same shape as the LinkedIn optimizer. Triggered at the OFFER stage.
 *
 * Provenance spine (Hardening §B):
 *   - EVERY number shown traces to an INPUT - the offer figures the user entered
 *     or a market anchor the user supplied. The coach NEVER invents market data
 *     or fabricates a "typical" salary; when no anchor is given it reasons from a
 *     transparent, stated target-uplift assumption only.
 *   - The recommendation is a RANGE, never a single magic number, and always
 *     includes a walk-away / BATNA note.
 *   - The drafted counter is a STARTING POINT the human edits - never auto-sent.
 */

/**
 * The offer as the user entered it. All money is annual and in `currency`,
 * except `signOnBonus` (one-time). Absent components are treated as 0 / unknown.
 */
export interface OfferInput {
  company?: string;
  role?: string;
  /** Annual base salary (the primary lever). */
  baseSalary: number;
  /** Annual target bonus (absolute amount, not a percentage). */
  bonus?: number;
  /** Annualized equity value (total grant ÷ vesting years). */
  equityPerYear?: number;
  /** One-time signing bonus. */
  signOnBonus?: number;
  currency: string;
  location?: string;
  /** Free-text level/band, e.g. "L5" or "Senior". */
  level?: string;
}

/**
 * What the user knows about the market + their leverage. Everything here is
 * USER-SUPPLIED - the coach never sources market numbers itself. When
 * `marketBase` is absent the coach reasons purely from `targetUpliftPct`.
 */
export interface MarketAnchor {
  /** A market base benchmark the user looked up (e.g. levels.fyi). */
  marketBase?: number;
  /** Desired uplift on base, e.g. 0.12. Defaults to DEFAULT_TARGET_UPLIFT. */
  targetUpliftPct?: number;
  /** The user holds a competing offer (the single strongest leverage). */
  hasCompetingOffer: boolean;
  /** The competing offer's annual base, when disclosed. */
  competingBase?: number;
}

/** One line of the counter, component-by-component. */
export interface NegotiationComponent {
  /** "Base salary" | "Signing bonus" | "Equity" | "Annual bonus". */
  name: string;
  /** The current offered value (an INPUT - provenance: the offer). */
  current: number;
  /** The suggested ask (derived from inputs; never an invented market figure). */
  suggested: number;
  /** True when an anchor was provided and `current` is below it. */
  belowMarket: boolean;
  /** Plain-language note on why / how to ask. */
  note: string;
}

/**
 * The coaching output. `counterRange` is what the user opens with; `components`
 * break down where the gains are; `talkingPoints` are ready-to-say lines;
 * `assumptions` make every number's provenance explicit; `draftMessage` is an
 * editable starting point. `provenanceOk` is false if any figure couldn't be
 * traced to an input (defensive - should never happen for a pure calculator).
 */
export interface NegotiationPlan {
  /** The single anchored counter on base (midpoint of the range). */
  counterBase: number;
  counterRange: { low: number; high: number };
  currency: string;
  components: NegotiationComponent[];
  /** Ready-to-say negotiation lines, ordered strongest-first. */
  talkingPoints: string[];
  /** Leverage the user holds (competing offer, scarce skills, …). */
  leverageNotes: string[];
  /** The BATNA / walk-away reminder - always present. */
  walkAwayNote: string;
  /** Editable counter-offer message (draft-first; never auto-sent). */
  draftMessage: string;
  /** Every assumption + the input each number traces to (provenance trail). */
  assumptions: string[];
  provenanceOk: boolean;
}

// --- Tuning constants -----------------------------------------------------

/** Default target uplift on base when the user gives no market anchor (conservative). */
export const DEFAULT_TARGET_UPLIFT = 0.12;
/** Never recommend a counter above the market anchor by more than this (stay credible). */
export const MAX_UPLIFT_OVER_ANCHOR = 0.1;
/** The counter range spans ±this fraction around the anchored counter. */
export const COUNTER_RANGE_SPREAD = 0.05;
