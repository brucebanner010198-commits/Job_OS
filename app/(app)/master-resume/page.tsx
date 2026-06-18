import type { ProfileEntry, ProfileEntryKind } from "@prisma/client";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { getAppContext } from "@/lib/app-context";
import { listFacts } from "@/lib/profile/service";
import { needsPolish, BULLET_POLISH_VERSION } from "@/lib/profile/polish";
import { safeDb } from "@/lib/safe";
import { DbBanner } from "@/components/db-banner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { DictationPanel } from "@/components/master-resume/dictation-panel";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<ProfileEntryKind, string> = {
  CONTACT: "Contact",
  SUMMARY: "Summary",
  EXPERIENCE: "Experience",
  EDUCATION: "Education",
  PROJECT: "Projects",
  SKILL: "Skills",
  ACHIEVEMENT: "Achievements",
  CERTIFICATION: "Certifications",
  LIFE_FACT: "Personal (private)",
};

const ORDER: ProfileEntryKind[] = [
  "SUMMARY",
  "EXPERIENCE",
  "PROJECT",
  "SKILL",
  "EDUCATION",
  "CERTIFICATION",
  "ACHIEVEMENT",
  "CONTACT",
  "LIFE_FACT",
];

function labelFor(entry: ProfileEntry): string {
  if (entry.sourceNote && entry.sourceNote.trim()) return entry.sourceNote;
  const data = entry.data as Record<string, unknown> | null;
  if (data && typeof data === "object") {
    const guess = data.title ?? data.name ?? data.degree ?? data.summary;
    if (typeof guess === "string") return guess;
  }
  return entry.kind;
}

function firstBullet(entry: ProfileEntry): string | null {
  const data = entry.data as Record<string, unknown> | null;
  if (!data || !Array.isArray(data.bullets)) return null;
  const bullet = data.bullets.find((b) => typeof b === "string" && b.trim());
  return typeof bullet === "string" ? bullet : null;
}

function isPolished(entry: ProfileEntry): boolean {
  const data = entry.data as Record<string, unknown> | null;
  if (!data || typeof data !== "object") return false;
  const polish = data.bulletPolish as { version?: number } | undefined;
  return polish?.version === BULLET_POLISH_VERSION;
}

function truncate(text: string, max = 80): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export default async function MasterResumePage() {
  const { data: facts, dbError } = await safeDb<ProfileEntry[]>(async () => {
    const { scope } = await getAppContext();
    return listFacts(scope);
  }, []);

  const byKind = new Map<ProfileEntryKind, ProfileEntry[]>();
  for (const f of facts) {
    const arr = byKind.get(f.kind) ?? [];
    arr.push(f);
    byKind.set(f.kind, arr);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <PageHeader
        title="Master Resume"
        description="Your single source of truth. Everything else is tailored from here."
      />

      {dbError && <DbBanner />}

      <DictationPanel />

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Your profile {facts.length > 0 && `· ${facts.length} entries`}
        </h2>

        {facts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nothing here yet. Add an update above, or{" "}
              <Link href="/import" className="text-accent hover:underline">
                import an existing resume
              </Link>{" "}
              to build your profile.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {ORDER.filter((k) => byKind.has(k)).map((kind) => (
              <div key={kind}>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
                  {KIND_LABEL[kind]}
                  {kind === "LIFE_FACT" && (
                    <Badge variant="warning">
                      <ShieldAlert className="mr-1 h-3 w-3" /> withheld from AI
                    </Badge>
                  )}
                </h3>
                <ul className="space-y-1.5">
                  {(byKind.get(kind) ?? []).map((entry) => {
                    const bullet = firstBullet(entry);
                    const showPolish =
                      (kind === "EXPERIENCE" || kind === "PROJECT") &&
                      bullet &&
                      !entry.sensitive;
                    const polished = showPolish && isPolished(entry);
                    const pending = showPolish && needsPolish(entry);

                    return (
                      <li
                        key={entry.id}
                        className="rounded-lg border border-border/60 bg-card px-3 py-2 text-sm shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{labelFor(entry)}</span>
                          <div className="flex shrink-0 items-center gap-2">
                            {polished && (
                              <Badge variant="success">Polished</Badge>
                            )}
                            {pending && (
                              <Badge variant="warning">Pending polish</Badge>
                            )}
                            {entry.sensitive && (
                              <ShieldAlert className="h-3.5 w-3.5 text-[var(--warning)]" />
                            )}
                          </div>
                        </div>
                        {bullet && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {truncate(bullet)}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
