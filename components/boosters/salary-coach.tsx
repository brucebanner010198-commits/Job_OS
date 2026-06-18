/**
 * Salary coach (Phase 7 booster, plan §10). A pure-client negotiation coach: it
 * takes the offer the user enters plus whatever market anchor they supply and
 * calls buildNegotiationPlan - a pure, provenance-strict calculator - entirely
 * in the browser. No server round-trip, mirroring the LinkedIn optimizer.
 *
 * Provenance spine: every number shown traces to an INPUT. The coach never
 * invents a market figure; when no anchor is given it reasons only from a stated
 * target-uplift assumption. The recommendation is a RANGE with a walk-away note,
 * and the drafted counter is a starting point the human edits - never auto-sent.
 */
"use client";

import { useState } from "react";
import { Check, Copy, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildNegotiationPlan } from "@/lib/salary/negotiate";
import type {
  MarketAnchor,
  NegotiationPlan,
  OfferInput,
} from "@/lib/salary/types";

// --- Local form state (strings keep "empty" distinct from "0") --------------

interface CoachForm {
  company: string;
  role: string;
  level: string;
  location: string;
  currency: string;
  baseSalary: string;
  bonus: string;
  equityPerYear: string;
  signOnBonus: string;
  marketBase: string;
  targetUpliftPct: string; // entered as a percent, e.g. "12"
  hasCompetingOffer: boolean;
  competingBase: string;
}

const EMPTY_FORM: CoachForm = {
  company: "",
  role: "",
  level: "",
  location: "",
  currency: "USD",
  baseSalary: "",
  bonus: "",
  equityPerYear: "",
  signOnBonus: "",
  marketBase: "",
  targetUpliftPct: "",
  hasCompetingOffer: false,
  competingBase: "",
};

// --- Pure helpers -----------------------------------------------------------

/** Parse a money/number field; empty or non-numeric → undefined. */
function toNum(s: string): number | undefined {
  const t = s.trim();
  if (t === "") return undefined;
  const n = Number(t.replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

/** Deterministic money formatter ("$" for USD, else "CUR n"). */
function money(n: number, currency: string): string {
  const sign = n < 0 ? "-" : "";
  const grouped = Math.abs(Math.round(n)).toLocaleString("en-US");
  return currency === "USD" ? `${sign}$${grouped}` : `${sign}${currency} ${grouped}`;
}

// --- Copy-to-clipboard button -----------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable - silently no-op.
    }
  }
  return (
    <Button size="sm" variant="ghost" onClick={copy} className="h-7 px-2">
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" /> Copied
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" /> Copy
        </>
      )}
    </Button>
  );
}

// --- Plan display ------------------------------------------------------------

function PlanPanel({ plan }: { plan: NegotiationPlan }) {
  const { currency } = plan;

  return (
    <div className="mt-6 space-y-6">
      {/* Counter range - the headline number, shown prominently. */}
      <div className="rounded-xl border border-accent/40 bg-accent/5 p-5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <TrendingUp className="h-4 w-4 text-accent" />
          Open with this counter on base
        </div>
        <div className="mt-2 flex flex-wrap items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums text-foreground">
            {money(plan.counterRange.low, currency)}
          </span>
          <span className="text-xl text-muted-foreground">–</span>
          <span className="text-3xl font-bold tabular-nums text-foreground">
            {money(plan.counterRange.high, currency)}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Anchor around {money(plan.counterBase, currency)}. A range, not a single
          number - start at the top and let them meet you.
        </p>
      </div>

      {/* Component-by-component breakdown. */}
      {plan.components.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 font-medium">Where the gains are</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Component</th>
                  <th className="py-2 pr-3 font-medium">Current</th>
                  <th className="py-2 pr-3 font-medium">Suggested</th>
                </tr>
              </thead>
              <tbody>
                {plan.components.map((c) => (
                  <tr key={c.name} className="border-b border-border/60 align-top">
                    <td className="py-2.5 pr-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-foreground">{c.name}</span>
                        {c.belowMarket && (
                          <Badge variant="warning" className="text-[10px]">
                            below market
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{c.note}</p>
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-muted-foreground">
                      {money(c.current, currency)}
                    </td>
                    <td className="py-2.5 pr-3 font-medium tabular-nums text-foreground">
                      {money(c.suggested, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Talking points - ready-to-say, strongest first. */}
      {plan.talkingPoints.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 font-medium">Talking points</h3>
          <ol className="space-y-2">
            {plan.talkingPoints.map((t, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <span className="text-foreground">{t}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Leverage the user holds. */}
      {plan.leverageNotes.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 font-medium">Your leverage</h3>
          <ul className="space-y-2">
            {plan.leverageNotes.map((l, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <span className="text-muted-foreground">{l}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Walk-away / BATNA - always present, as a callout. */}
      <div className="rounded-xl border border-[var(--warning)]/30 bg-[var(--warning)]/10 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--warning)]">
          Walk-away
        </p>
        <p className="mt-1 text-sm text-foreground">{plan.walkAwayNote}</p>
      </div>

      {/* Editable draft counter - a starting point, never auto-sent. */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-medium">Draft counter-offer</h3>
          <CopyButton text={plan.draftMessage} />
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          A starting point - edit it in your own voice before you send. Nothing is
          sent for you.
        </p>
        <textarea
          readOnly
          value={plan.draftMessage}
          rows={10}
          className="w-full resize-y rounded-lg border border-border bg-background p-3 text-sm leading-relaxed text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Provenance: every number's source, as small print. */}
      {plan.assumptions.length > 0 && (
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Assumptions &amp; provenance
          </p>
          <ul className="mt-2 space-y-1">
            {plan.assumptions.map((a, i) => (
              <li key={i} className="text-xs leading-relaxed text-muted-foreground">
                • {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!plan.provenanceOk && (
        <p className="text-sm text-[var(--danger)]">
          Some figures could not be traced to an input - double-check your entries.
        </p>
      )}
    </div>
  );
}

// --- Main component ----------------------------------------------------------

export function SalaryCoach({ offers }: { offers: Partial<OfferInput>[] }) {
  const [form, setForm] = useState<CoachForm>({ ...EMPTY_FORM });

  function setField<K extends keyof CoachForm>(key: K, value: CoachForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  /** Pre-fill the whole form from a passed offer-stage application. */
  function prefill(value: string) {
    if (value === "") return;
    const idx = Number(value);
    const o = offers[idx];
    if (!o) return;
    setForm((prev) => ({
      ...prev,
      company: o.company ?? "",
      role: o.role ?? "",
      level: o.level ?? "",
      location: o.location ?? "",
      currency: o.currency || "USD",
      baseSalary: o.baseSalary ? String(o.baseSalary) : "",
      bonus: o.bonus ? String(o.bonus) : "",
      equityPerYear: o.equityPerYear ? String(o.equityPerYear) : "",
      signOnBonus: o.signOnBonus ? String(o.signOnBonus) : "",
    }));
  }

  // Build the contract objects, then compute on the client (pure - cheap to run
  // on every render, so the plan updates live as the form changes).
  const baseNum = toNum(form.baseSalary) ?? 0;
  const upliftRaw = toNum(form.targetUpliftPct);

  const offer: OfferInput = {
    company: form.company.trim() || undefined,
    role: form.role.trim() || undefined,
    level: form.level.trim() || undefined,
    location: form.location.trim() || undefined,
    currency: form.currency.trim() || "USD",
    baseSalary: baseNum,
    bonus: toNum(form.bonus),
    equityPerYear: toNum(form.equityPerYear),
    signOnBonus: toNum(form.signOnBonus),
  };

  const anchor: MarketAnchor = {
    marketBase: toNum(form.marketBase),
    targetUpliftPct: upliftRaw !== undefined ? upliftRaw / 100 : undefined,
    hasCompetingOffer: form.hasCompetingOffer,
    competingBase: form.hasCompetingOffer ? toNum(form.competingBase) : undefined,
  };

  const plan: NegotiationPlan | null =
    baseNum > 0 ? buildNegotiationPlan(offer, anchor) : null;

  return (
    <div>
      <div className="rounded-xl border border-border bg-card p-5">
        {/* Pre-fill from offer-stage applications. */}
        {offers.length > 0 && (
          <div className="mb-5">
            <Label htmlFor="sc-prefill">Pre-fill from an offer</Label>
            <select
              id="sc-prefill"
              defaultValue=""
              onChange={(e) => prefill(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Choose an offer…</option>
              {offers.map((o, i) => (
                <option key={i} value={i}>
                  {o.company ?? "Offer"}
                  {o.role ? ` - ${o.role}` : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Pulls company and role (and any figures we have) into the form below.
            </p>
          </div>
        )}

        {/* The offer. */}
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          The offer
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="sc-company">Company</Label>
            <Input
              id="sc-company"
              value={form.company}
              onChange={(e) => setField("company", e.target.value)}
              placeholder="e.g. Datadog"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="sc-role">Role</Label>
            <Input
              id="sc-role"
              value={form.role}
              onChange={(e) => setField("role", e.target.value)}
              placeholder="e.g. Senior Software Engineer"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="sc-level">Level / band</Label>
            <Input
              id="sc-level"
              value={form.level}
              onChange={(e) => setField("level", e.target.value)}
              placeholder="e.g. L5 or Senior"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="sc-location">Location</Label>
            <Input
              id="sc-location"
              value={form.location}
              onChange={(e) => setField("location", e.target.value)}
              placeholder="e.g. New York, NY"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="sc-base">Base salary (annual) *</Label>
            <Input
              id="sc-base"
              inputMode="numeric"
              value={form.baseSalary}
              onChange={(e) => setField("baseSalary", e.target.value)}
              placeholder="e.g. 150000"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="sc-currency">Currency</Label>
            <Input
              id="sc-currency"
              value={form.currency}
              onChange={(e) => setField("currency", e.target.value)}
              placeholder="USD"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="sc-bonus">Target bonus (annual)</Label>
            <Input
              id="sc-bonus"
              inputMode="numeric"
              value={form.bonus}
              onChange={(e) => setField("bonus", e.target.value)}
              placeholder="e.g. 15000"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="sc-equity">Equity / year</Label>
            <Input
              id="sc-equity"
              inputMode="numeric"
              value={form.equityPerYear}
              onChange={(e) => setField("equityPerYear", e.target.value)}
              placeholder="e.g. 40000"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="sc-signon">Sign-on bonus (one-time)</Label>
            <Input
              id="sc-signon"
              inputMode="numeric"
              value={form.signOnBonus}
              onChange={(e) => setField("signOnBonus", e.target.value)}
              placeholder="e.g. 10000"
              className="mt-1"
            />
          </div>
        </div>

        {/* Market anchor. */}
        <h3 className="mb-3 mt-6 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          What you know about the market
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          All optional and entirely yours - the coach never sources market numbers
          itself. With no anchor it reasons only from the target-uplift assumption.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="sc-marketbase">Market base benchmark</Label>
            <Input
              id="sc-marketbase"
              inputMode="numeric"
              value={form.marketBase}
              onChange={(e) => setField("marketBase", e.target.value)}
              placeholder="e.g. 180000 (levels.fyi)"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="sc-uplift">Target uplift (%)</Label>
            <Input
              id="sc-uplift"
              inputMode="numeric"
              value={form.targetUpliftPct}
              onChange={(e) => setField("targetUpliftPct", e.target.value)}
              placeholder="default 12"
              className="mt-1"
            />
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.hasCompetingOffer}
              onChange={(e) => setField("hasCompetingOffer", e.target.checked)}
              className="h-4 w-4 rounded border-border accent-accent"
            />
            I have a competing offer
          </label>
          {form.hasCompetingOffer && (
            <div className="max-w-xs">
              <Label htmlFor="sc-competing">Competing offer base</Label>
              <Input
                id="sc-competing"
                inputMode="numeric"
                value={form.competingBase}
                onChange={(e) => setField("competingBase", e.target.value)}
                placeholder="e.g. 185000"
                className="mt-1"
              />
            </div>
          )}
        </div>

        {baseNum <= 0 && (
          <p className="mt-5 text-sm text-muted-foreground">
            Enter a base salary to build your counter.
          </p>
        )}
      </div>

      {plan && <PlanPanel plan={plan} />}
    </div>
  );
}
