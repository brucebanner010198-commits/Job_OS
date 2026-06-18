/**
 * Warm-path page (Phase 7, plan §9 + Module 9) - the referral engine surface.
 * Server component: it loads the ranked board through safeDb and ALWAYS has a
 * pure offline preview (previewWarm) so the page renders with no database and is
 * never blank.
 *
 * The safety spine lives here in copy and in the `readOnly` flag passed to the
 * child: the engine only ever PROPOSES + drafts - nothing is auto-sent. Drafts
 * are EXTRACTIVE (grounded only in real connection/profile facts); a draft that
 * couldn't be grounded surfaces a warning and can't be marked sent. Etiquette is
 * low-volume: where there's no genuine path the engine recommends applying cold
 * rather than fabricating a tie.
 */
import { getAppContext } from "@/lib/app-context";
import { safeDb } from "@/lib/safe";
import { DbBanner } from "@/components/db-banner";
import { getWarmBoard, previewWarm } from "@/lib/warm/service";
import { warmStatus } from "@/lib/warm";
import { WarmList, RefreshConnections } from "@/components/warm/warm-list";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { WarmPathView, WarmStatus } from "@/lib/warm/types";

export const dynamic = "force-dynamic";

export default async function WarmPathPage() {
  const { data, dbError } = await safeDb<WarmPathView[]>(
    async () => {
      const { scope, user } = await getAppContext();
      return getWarmBoard(scope);
    },
    [],
  );

  const status: WarmStatus = await warmStatus().catch(() => ({
    enabled: false,
    connected: false,
    live: false,
  }));

  // Fall back to the pure preview whenever the DB is down OR there's simply
  // nothing ranked yet - so the page is never blank.
  const usePreview = dbError || data.length === 0;
  const paths = usePreview ? previewWarm().paths : data;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Warm path</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A referral is roughly 7 to 10 times more likely to land than a cold
          application, so find a way in before you apply cold. Everything here is
          a draft. Nothing is ever sent for you. You review, edit, and send from
          your own account.
        </p>
      </header>

      {dbError && <DbBanner />}

      {/* Connections status card */}
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">Connections</span>
              {status.live ? (
                <Badge variant="success" className="text-[10px]">
                  connected
                </Badge>
              ) : (
                <Badge variant="muted" className="text-[10px]">
                  not connected
                </Badge>
              )}
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
            <p className="mt-1 text-xs text-muted-foreground">
              {usePreview
                ? "Running on sample connections. The paths below are a preview."
                : status.live
                  ? "Running on your live LinkedIn connections."
                  : "Running on your imported connections."}
            </p>
            {!status.enabled && (
              <p className="mt-1 text-xs text-muted-foreground">
                Connect your own LinkedIn session locally to find real paths.
                Your account only, with you in the loop, and never scraped at
                scale.
              </p>
            )}
          </div>

          <RefreshConnections readOnly={usePreview} />
        </CardContent>
      </Card>

      <WarmList paths={paths} readOnly={usePreview} />
    </main>
  );
}
