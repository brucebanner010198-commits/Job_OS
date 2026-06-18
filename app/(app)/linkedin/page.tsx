import { safeDb } from "@/lib/safe";
import { getAppContext } from "@/lib/app-context";
import { listFacts, toFacts } from "@/lib/profile/service";
import { nonSensitive } from "@/lib/ai/redaction";
import { flattenFact } from "@/lib/profile/types";
import { DbBanner } from "@/components/db-banner";
import { LinkedInOptimizer } from "@/components/linkedin/linkedin-optimizer";

export const dynamic = "force-dynamic";

export default async function LinkedInPage() {
  const { data: seedText, dbError } = await safeDb<string>(async () => {
    const { scope } = await getAppContext();
    const entries = await listFacts(scope);
    return toFacts(nonSensitive(entries)).map(flattenFact).join("\n");
  }, "");

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          LinkedIn optimizer
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          An All-Star LinkedIn profile gets{" "}
          <strong className="text-foreground">about 40 times more views</strong>{" "}
          than a basic one and shows up first in recruiter searches. Paste your
          profile text below, or fill in the fields, to get an instant check
          against LinkedIn&apos;s All-Star criteria with a ranked list of exactly
          what to fix.
        </p>
      </header>
      {dbError && <DbBanner />}
      <LinkedInOptimizer seedText={seedText} />
    </main>
  );
}
