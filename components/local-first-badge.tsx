import Link from "next/link";
import { HardDrive, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LocalFirstBadgeProps {
  showExportLink?: boolean;
  className?: string;
}

/** Counter to Teal/Huntr cloud lock-in - data stays in local Postgres. */
export function LocalFirstBadge({
  showExportLink = false,
  className,
}: LocalFirstBadgeProps) {
  return (
    <div className={className}>
      <Badge variant="success" title="Your data is stored in local Postgres, not a third-party resume database">
        <span className="inline-flex items-center gap-1">
          <HardDrive className="h-3 w-3" />
          Local storage
        </span>
      </Badge>
      {showExportLink && (
        <Link
          href="/backups"
          className="ml-2 inline-flex items-center gap-1 text-xs text-accent hover:underline"
        >
          <Download className="h-3 w-3" />
          Export / backup
        </Link>
      )}
    </div>
  );
}
