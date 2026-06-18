/**
 * Fixture ConnectionSource - the deterministic default. Returns the seeded
 * network with no DB/network. Used for the offline /warm-path preview, the test
 * gate, and any environment where the live local-LinkedIn adapter is disabled.
 */

import type {
  Connection,
  ConnectionListOptions,
  ConnectionSource,
} from "@/lib/warm/types";
import { fixtureConnections } from "@/lib/warm/fixtures";

export function fixtureConnectionSource(): ConnectionSource {
  return {
    id: "fixture",
    isLive: false,

    async listConnections(opts?: ConnectionListOptions): Promise<Connection[]> {
      let rows = [...fixtureConnections];

      if (opts?.companies && opts.companies.length > 0) {
        const wanted = new Set(opts.companies.map((c) => c.toLowerCase()));
        rows = rows.filter(
          (c) => c.company && wanted.has(c.company.toLowerCase()),
        );
      }

      if (opts?.max != null) rows = rows.slice(0, opts.max);
      return rows;
    },
  };
}
