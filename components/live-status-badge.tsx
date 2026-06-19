import { Badge } from "@/components/ui/badge";
import {
  LIVE_STATUS_LABEL,
  MODULES,
  type LiveAdapterStatus,
  type ModuleMeta,
} from "@/lib/modules";
import { cn } from "@/lib/utils";

const VARIANT: Record<
  LiveAdapterStatus,
  "success" | "warning" | "muted"
> = {
  live: "success",
  partial: "warning",
  fixture: "muted",
};

export function LiveStatusBadge({
  status,
  className,
}: {
  status: LiveAdapterStatus;
  className?: string;
}) {
  return (
    <Badge
      variant={VARIANT[status]}
      className={cn("text-[10px] font-normal", className)}
      title={`Adapter: ${LIVE_STATUS_LABEL[status]}`}
    >
      {LIVE_STATUS_LABEL[status]}
    </Badge>
  );
}

export function moduleForHref(href: string): ModuleMeta | undefined {
  return MODULES.find(
    (m) => m.href && (href === m.href || href.startsWith(`${m.href}/`)),
  );
}
