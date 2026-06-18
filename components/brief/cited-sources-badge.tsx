import { Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SerializedClaim } from "@/app/actions/brief";

interface CitedSourcesBadgeProps {
  claims: SerializedClaim[];
  className?: string;
}

/** Count unique cited source URLs - counter to paywalled Crunchbase blurbs. */
export function CitedSourcesBadge({ claims, className }: CitedSourcesBadgeProps) {
  const urls = new Set<string>();
  for (const claim of claims) {
    for (const src of claim.sources) {
      if (src.url) urls.add(src.url);
    }
  }

  if (urls.size === 0) return null;

  return (
    <Badge
      variant="success"
      className={className}
      title={`${urls.size} primary source URL(s) cited in this brief`}
    >
      <span className="inline-flex items-center gap-1">
        <Link2 className="h-3 w-3" />
        {urls.size} cited source{urls.size === 1 ? "" : "s"}
      </span>
    </Badge>
  );
}
