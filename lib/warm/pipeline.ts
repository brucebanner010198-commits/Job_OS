/**
 * Warm-path PIPELINE (Phase 7, plan §9 + Module 9). Pure orchestration - no DB,
 * no network, no LLM, no wall clock. It wires the two brains together:
 *
 *   bestWarmPath (rank.ts) → reach-out gate → draftIntroRequest (draft.ts)
 *
 * and maps the result into the serializable {@link WarmPathView} the UI renders.
 * Because it is DB-free it powers the OFFLINE /warm-path preview (previewWarm)
 * and is fully unit-testable; lib/warm/service.ts reuses the exact same wiring
 * over real rows.
 *
 * Safety spine (Hardening §B/§F):
 *   - TRUTHFUL / EXTRACTIVE: a draft is only ever produced from a genuine path's
 *     real facts (draftIntroRequest stays extractive). provenanceOk flows through
 *     untouched so the UI can block "mark sent" on an ungrounded draft.
 *   - LOW-VOLUME / ETIQUETTE: we draft ONLY when the gate says reachOut. For a
 *     NONE / too-weak path we leave draftSubject/draftBody undefined - the view
 *     still shows WHY (gateReason: "apply cold instead") without an unbacked ask.
 *   - DRAFT-FIRST / HUMAN-IN-THE-LOOP: every view is state "PROPOSED"; nothing is
 *     ever sent here.
 */

import type {
  Connection,
  IntroDraft,
  RequesterProfile,
  WarmPath,
  WarmPathView,
  WarmTarget,
} from "@/lib/warm/types";
import { bestWarmPath } from "@/lib/warm/rank";
import { draftIntroRequest } from "@/lib/warm/draft";
import {
  fixtureConnections,
  fixtureRequester,
  fixtureTargets,
} from "@/lib/warm/fixtures";

/**
 * Map a ranked path (+ its optional draft) into the serializable view model.
 * `draft` is undefined for NONE / non-reachOut paths, so draftSubject/draftBody/
 * provenanceOk stay undefined - the view advertises the gate decision, not an ask.
 */
function toView(
  id: string,
  path: WarmPath,
  draft: IntroDraft | undefined,
): WarmPathView {
  return {
    id,
    company: path.target.company,
    jobTitle: path.target.jobTitle,
    applicationId: path.target.applicationId,
    pathKind: path.pathKind,
    strength: path.strength,
    reasons: path.reasons,
    reachOut: path.reachOut,
    gateReason: path.gateReason,
    connectionName: path.connection?.fullName,
    connectionHeadline: path.connection?.headline,
    connectionProfileUrl: path.connection?.profileUrl,
    channel: path.channel,
    draftSubject: draft?.subject,
    draftBody: draft?.body,
    provenanceOk: draft?.provenanceOk,
    state: "PROPOSED",
  };
}

/**
 * For each target: take the single strongest genuine path, draft an extractive
 * ask ONLY when the etiquette gate says reachOut, and map to a PROPOSED view with
 * a synthetic ("preview-"+company) id. NONE / too-weak targets come back with no
 * draft (recommend applying cold) rather than a fabricated message.
 */
export function processWarmTargets(
  targets: WarmTarget[],
  connections: Connection[],
  requester: RequesterProfile,
): WarmPathView[] {
  return targets.map((target) => {
    const path = bestWarmPath(target, connections);
    const draft = path.reachOut
      ? draftIntroRequest(path, requester)
      : undefined;
    return toView(`preview-${target.company}`, path, draft);
  });
}

/**
 * The deterministic offline preview - runs the full pipeline over the fixture
 * corpus (Notion/Linear light up; Datadog correctly recommends applying cold).
 */
export function previewWarm(): { paths: WarmPathView[] } {
  return {
    paths: processWarmTargets(
      fixtureTargets,
      fixtureConnections,
      fixtureRequester,
    ),
  };
}
