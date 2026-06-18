import { Zap, Eye, HandMetal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ApplyRoute } from "@/lib/apply/types";

const ROUTE_VARIANT: Record<ApplyRoute, "accent" | "default" | "warning"> = {
  AUTONOMOUS: "accent",
  ASSISTED: "default",
  MANUAL: "warning",
};

const ROUTE_ICON: Record<ApplyRoute, React.ReactNode> = {
  AUTONOMOUS: <Zap className="h-3 w-3" />,
  ASSISTED: <Eye className="h-3 w-3" />,
  MANUAL: <HandMetal className="h-3 w-3" />,
};

const ROUTE_LABEL: Record<ApplyRoute, string> = {
  AUTONOMOUS: "Autonomous",
  ASSISTED: "Assisted",
  MANUAL: "Manual",
};

export function RouteBadge({
  route,
  size = "default",
  className,
}: {
  route: ApplyRoute;
  size?: "default" | "sm";
  className?: string;
}) {
  return (
    <Badge
      variant={ROUTE_VARIANT[route]}
      className={cn(
        "flex items-center gap-1",
        size === "sm" && "px-1.5 py-0 text-[10px]",
        className,
      )}
    >
      {ROUTE_ICON[route]}
      {ROUTE_LABEL[route]}
    </Badge>
  );
}
