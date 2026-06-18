export type CoachNoteKind = "rejection" | "gap" | "general";

export function formatCoachNoteBody(
  kind: CoachNoteKind,
  title: string,
  body: string,
): string {
  return [`# Coach: ${title}`, `kind: ${kind}`, "", body].join("\n");
}
