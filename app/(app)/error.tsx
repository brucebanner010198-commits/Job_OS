"use client";

import { useEffect } from "react";
import { DiagnosticError } from "@/components/ui/diagnostic-error";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AppError boundary caught error]:", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-xl flex-col justify-center px-6 py-16">
      <DiagnosticError
        error={error}
        title="Page error"
        onRetry={() => reset()}
      />
    </div>
  );
}
