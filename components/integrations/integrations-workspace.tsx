"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  Save,
  CheckCircle2,
  ExternalLink,
  Plug,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  saveIntegrationSecretsAction,
  setIntegrationEnabledAction,
  type IntegrationView,
} from "@/app/actions/integrations";
import { SystemReadiness } from "@/components/system-readiness";

function IntegrationCard({ integration }: { integration: IntegrationView }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, startSave] = useTransition();
  const [toggling, startToggle] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function save() {
    setError(null);
    startSave(async () => {
      try {
        await saveIntegrationSecretsAction(integration.id, values);
        setSaved(true);
        setValues({});
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  function toggle(enabled: boolean) {
    startToggle(async () => {
      try {
        await setIntegrationEnabledAction(integration.id, enabled);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Toggle failed");
      }
    });
  }

  const showGmailConnect =
    integration.id === "gmail" &&
    integration.fields.some((f) => f.configured);

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-medium">{integration.name}</h2>
              <Badge variant={integration.configured ? "success" : "muted"}>
                {integration.configured ? "configured" : "not set"}
              </Badge>
              {integration.toggleKey && (
                <Badge variant={integration.enabled ? "default" : "warning"}>
                  {integration.enabled ? "enabled" : "disabled"}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {integration.description}
            </p>
          </div>
          {integration.docsUrl && (
            <a
              href={integration.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-accent hover:underline"
            >
              Docs <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        {integration.fields.length > 0 && (
          <div className="space-y-3">
            {integration.fields.map((field) => (
              <div key={field.key}>
                <Label htmlFor={field.key}>
                  {field.label}
                  {field.configured && (
                    <span className="ml-2 text-xs text-[var(--success)]">
                      (saved)
                    </span>
                  )}
                </Label>
                <Input
                  id={field.key}
                  type={field.secret ? "password" : "text"}
                  placeholder={
                    field.secret
                      ? field.configured
                        ? "••••••••  (leave blank to keep)"
                        : "Paste key…"
                      : undefined
                  }
                  value={values[field.key] ?? ""}
                  onChange={(e) => {
                    setSaved(false);
                    setValues((v) => ({ ...v, [field.key]: e.target.value }));
                  }}
                  className="mt-1"
                  autoComplete="off"
                />
              </div>
            ))}
            <Button onClick={save} disabled={saving} size="sm">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : saved ? (
                <CheckCircle2 className="h-4 w-4 text-[var(--success)]" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? "Saving…" : saved ? "Saved" : "Save"}
            </Button>
          </div>
        )}

        {integration.toggleKey && integration.fields.length === 0 && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={integration.enabled ? "outline" : "default"}
              disabled={toggling}
              onClick={() => toggle(!integration.enabled)}
            >
              {integration.enabled ? "Disable" : "Enable"}
            </Button>
          </div>
        )}

        {integration.toggleKey && integration.fields.length > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={toggling}
              onClick={() => toggle(!integration.enabled)}
            >
              {integration.enabled ? "Turn off" : "Turn on"}
            </Button>
          </div>
        )}

        {showGmailConnect && (
          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
            <p className="mb-2 text-sm text-muted-foreground">
              OAuth client saved. Connect your inbox from the tracker or here:
            </p>
            <Link href="/api/gmail/auth">
              <Button size="sm" variant="accent">
                Connect Gmail
              </Button>
            </Link>
          </div>
        )}

        {error && (
          <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function IntegrationsWorkspace({
  integrations,
}: {
  integrations: IntegrationView[];
}) {
  return (
    <div className="space-y-4">
      <SystemReadiness />
      {integrations.map((i) => (
        <IntegrationCard key={i.id} integration={i} />
      ))}
    </div>
  );
}
