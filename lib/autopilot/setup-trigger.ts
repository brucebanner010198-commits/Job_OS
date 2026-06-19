/** Shared autopilot enable flag for setup handoff UX. */
export function isAutopilotEnabled(): boolean {
  return process.env.AUTOPILOT_ENABLED !== "0";
}
