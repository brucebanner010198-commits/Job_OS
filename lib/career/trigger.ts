/**
 * Fire-and-forget trigger for the career content agent. Call from server
 * actions via next/server after() - do not await.
 */
import type { AppScope } from "@/lib/profiles/types";
import { runCareerContentAgent } from "@/lib/career/agent";

export function scheduleCareerRefresh(scope: AppScope): void {
  void runCareerContentAgent(scope).catch((err) => {
    console.error("[career-agent]", err);
  });
}
