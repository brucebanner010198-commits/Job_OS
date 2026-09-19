import { PageHeader } from "@/components/page-header";
import { OffersWorkspace } from "@/components/offers/offers-workspace";

export const dynamic = "force-dynamic";

export default function OffersPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <PageHeader
        title="Offer comparison matrix"
        description="Compare competing offers side-by-side across total compensation, equity vesting schedules, performance bonuses, and work flexibility before making your final career decision."
      />
      <OffersWorkspace />
    </main>
  );
}
