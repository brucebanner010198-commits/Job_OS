"use client";

import { useEffect } from "react";
import Link from "next/link";
import { DiagnosticError } from "@/components/ui/diagnostic-error";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[RootError caught error]:", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <h1 className="mb-4 text-xl font-semibold text-foreground">Job OS could not load</h1>
      <DiagnosticError
        error={error}
        title="Application failure"
        onRetry={() => reset()}
      />
      <div className="mt-4 flex gap-3">
        <Link
          href="/"
          className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Return to dashboard
        </Link>
      </div>
    </div>
  );
}
