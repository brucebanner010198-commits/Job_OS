/**
 * Deterministic offer corpus for Phase 7's salary coach. Used by the test gate
 * and the offline /boosters preview. The cases cover the three branches that
 * matter: a below-market base with a user-supplied anchor, a fair offer with NO
 * anchor (reason purely from the stated target-uplift assumption), and an offer
 * backed by a competing offer (the strongest leverage).
 */

import type { MarketAnchor, OfferInput } from "@/lib/salary/types";

export interface FixtureOffer {
  offer: OfferInput;
  anchor: MarketAnchor;
  note: string;
}

export const fixtureOffers: FixtureOffer[] = [
  {
    note: "Below-market base with a levels.fyi anchor → counter anchored to market.",
    offer: {
      company: "Datadog",
      role: "Senior Software Engineer",
      baseSalary: 150_000,
      bonus: 15_000,
      equityPerYear: 40_000,
      signOnBonus: 10_000,
      currency: "USD",
      location: "New York, NY",
      level: "L4",
    },
    anchor: {
      marketBase: 180_000,
      targetUpliftPct: 0.12,
      hasCompetingOffer: false,
    },
  },
  {
    note: "Fair offer, NO market anchor → reason only from the target-uplift assumption.",
    offer: {
      company: "Vercel",
      role: "Senior Frontend Engineer",
      baseSalary: 200_000,
      bonus: 0,
      equityPerYear: 60_000,
      currency: "USD",
      location: "Remote",
      level: "Senior",
    },
    anchor: {
      hasCompetingOffer: false,
    },
  },
  {
    note: "Competing offer in hand → strongest leverage; counter near the competing base.",
    offer: {
      company: "Stripe",
      role: "Backend Engineer",
      baseSalary: 160_000,
      bonus: 20_000,
      equityPerYear: 50_000,
      signOnBonus: 0,
      currency: "USD",
      location: "Remote",
      level: "L3",
    },
    anchor: {
      marketBase: 185_000,
      hasCompetingOffer: true,
      competingBase: 185_000,
    },
  },
];
