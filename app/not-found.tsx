import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page-container flex min-h-screen flex-col items-center justify-center py-16 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        404
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        Page not found
      </h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        That page does not exist in Job OS.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-9 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground hover:opacity-90"
      >
        Back to dashboard
      </Link>
    </main>
  );
}
