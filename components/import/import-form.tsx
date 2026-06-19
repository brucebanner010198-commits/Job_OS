"use client";

import Link from "next/link";
import { ResumeIntake } from "@/components/pipeline/resume-intake";

export function ImportForm({
  embedded = false,
  onImported,
}: {
  embedded?: boolean;
  onImported?: () => void;
}) {
  return (
    <div className="space-y-4">
      <ResumeIntake embedded={embedded} onImported={onImported} />
      {!embedded && (
        <p className="text-sm">
          <Link href="/master-resume" className="text-accent hover:underline">
            View master resume →
          </Link>
        </p>
      )}
    </div>
  );
}
