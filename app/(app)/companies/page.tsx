import { getAppContext } from "@/lib/app-context";
import { safeDb } from "@/lib/safe";
import { listBriefedCompanies } from "@/lib/brief/service";
import { DbBanner } from "@/components/db-banner";
import { CompanyBriefWorkspace } from "@/components/brief/company-brief-workspace";
import { briefFixtures } from "@/lib/brief/sources";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const { data: briefedCompanies, dbError } = await safeDb(
    async () => {
      const { scope } = await getAppContext();
      return listBriefedCompanies(scope);
    },
    [],
  );

  // Fixture company names are read directly from the offline briefFixtures map
  // so quick-pick chips are usable without Postgres - the page works fully
  // offline for known companies.
  const fixtureSuggestions = Object.keys(briefFixtures);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Company brief</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every claim is cited and checked against its source, so the source has
          to actually support the fact, not just sit next to a link. Wikipedia
          and Wikidata count as backup only, never as a primary source. Facts
          that change often, like funding, headcount, and leadership, need a
          second independent source before they are marked verified. Nothing
          without a source is shown as fact.
        </p>
      </header>

      {dbError && <DbBanner />}

      <CompanyBriefWorkspace
        briefedCompanies={briefedCompanies}
        fixtureSuggestions={fixtureSuggestions}
      />
    </main>
  );
}
