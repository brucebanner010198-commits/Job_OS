import { listIntegrationsAction } from "@/app/actions/integrations";
import { IntegrationsWorkspace } from "@/components/integrations/integrations-workspace";
import { Plug } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const integrations = await listIntegrationsAction();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <Plug className="h-6 w-6 text-accent" />
          <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste your API keys here. They are stored locally in{" "}
          <code className="text-xs">.secrets/keys.json</code>, or the macOS
          Keychain in the desktop app. Values never leave this machine, and they
          are never shown again after you save.
        </p>
      </header>
      <IntegrationsWorkspace integrations={integrations} />
    </main>
  );
}
