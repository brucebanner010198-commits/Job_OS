import { ImportForm } from "@/components/import/import-form";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Import resume</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload or paste an existing resume so you can start on day one. The app
          pulls the details into your profile, using only what you wrote and
          inventing nothing. You can refine it later by voice.
        </p>
      </header>
      <ImportForm />
    </main>
  );
}
