/**
 * Boosters page (Phase 7, plan §10) - two funnel boosters on one page:
 *
 *   A. Follow-ups - deterministic post-application / post-interview nudges, each
 *      carrying a drafted (never auto-sent) message. The cadence never nags and
 *      stops on a terminal status; the human marks done or dismisses.
 *   B. Salary coach - the best-return 10 minutes of the search (~66% who
 *      negotiate gain ~+18-20%). The counter plan is computed PURELY ON THE
 *      CLIENT from the offer + a user-supplied market anchor (no invented market
 *      numbers); the page only pre-fills offer-stage applications.
 *
 * Server component: loads through safeDb and ALWAYS has a pure offline preview
 * for the follow-ups (previewFollowUps) so the page renders with no database.
 */
import { getAppContext } from "@/lib/app-context";
import { safeDb } from "@/lib/safe";
import { DbBanner } from "@/components/db-banner";
import { getFollowUpViews, previewFollowUps } from "@/lib/followup/service";
import { listOfferApplications } from "@/lib/salary/service";
import { FollowUpList } from "@/components/boosters/follow-up-list";
import { SalaryCoach } from "@/components/boosters/salary-coach";
import { Badge } from "@/components/ui/badge";
import type { FollowUpView } from "@/lib/followup/types";
import type { OfferInput } from "@/lib/salary/types";

export const dynamic = "force-dynamic";

export default async function BoostersPage() {
  // Section A - follow-ups (DB read, protected; falls back to the pure preview).
  const followups = await safeDb<FollowUpView[]>(async () => {
    const { scope, user } = await getAppContext();
    return getFollowUpViews(scope);
  }, []);

  // Section B - offer-stage applications, only used to PRE-FILL the coach form.
  // The coach needs only company + role for pre-fill (the user enters the
  // figures), so map the application rows to a partial OfferInput.
  const offersRes = await safeDb<Partial<OfferInput>[]>(async () => {
    const { scope, user } = await getAppContext();
    const apps = await listOfferApplications(scope);
    return apps.map((a) => ({ company: a.company, role: a.jobTitle }));
  }, []);

  // Use the offline preview whenever the DB is down OR there is nothing to show
  // yet, so the follow-ups section is never blank.
  const usePreview = followups.dbError || followups.data.length === 0;
  const items = usePreview ? previewFollowUps().followUps : followups.data;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Boosters</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Two reminders for the later stages of your search: timely follow-ups
          after you apply and after interviews, plus a salary coach for the offer
          stage. About 66% of people who negotiate gain roughly 18 to 20%. Every
          message is a draft you edit and send yourself. Nothing is ever sent
          automatically.
        </p>
      </header>

      {followups.dbError && <DbBanner />}

      {/* --- Section A - Follow-ups --------------------------------------- */}
      <section className="mb-12">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Follow-ups</h2>
          {usePreview ? (
            <Badge variant="muted" className="text-[10px]">
              sample preview
            </Badge>
          ) : (
            <Badge variant="success" className="text-[10px]">
              live data
            </Badge>
          )}
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Polite, specific reminders drafted from your pipeline. They never nag
          too early and stop once an application is rejected or skipped. The most
          valuable one is the thank-you note within 24 hours of an interview.
        </p>
        <FollowUpList items={items} readOnly={usePreview} />
      </section>

      {/* --- Section B - Salary coach ------------------------------------- */}
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Salary coach</h2>
          <Badge variant="accent" className="text-[10px]">
            offer stage
          </Badge>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Enter the offer and whatever you know about the market. The coach
          builds a counter <em>range</em> using only your numbers and never
          invents a market figure. You also get talking points, a walk-away note,
          and a draft you can edit. The math runs entirely in your browser.
        </p>
        <SalaryCoach offers={offersRes.data} />
      </section>
    </main>
  );
}
