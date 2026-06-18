"use server";

import { revalidatePath } from "next/cache";
import {
  requireAccessForMutation,
  requireAccessForRead,
} from "@/lib/auth/require-access";
import {
  deleteSecret,
  getSecret,
  setSecret,
} from "@/lib/secrets";
import {
  INTEGRATIONS,
  integrationById,
  type IntegrationDef,
} from "@/lib/integrations/registry";

export interface IntegrationFieldStatus {
  key: string;
  label: string;
  secret: boolean;
  configured: boolean;
}

export interface IntegrationView {
  id: string;
  name: string;
  description: string;
  category: string;
  docsUrl?: string;
  fields: IntegrationFieldStatus[];
  toggleKey?: string;
  enabled: boolean;
  configured: boolean;
}

async function fieldStatuses(
  def: IntegrationDef,
): Promise<IntegrationFieldStatus[]> {
  return Promise.all(
    def.fields.map(async (f) => ({
      key: f.key,
      label: f.label,
      secret: f.secret,
      configured: Boolean((await getSecret(f.key))?.trim()),
    })),
  );
}

async function isEnabled(def: IntegrationDef): Promise<boolean> {
  if (!def.toggleKey) return true;
  const v = await getSecret(def.toggleKey);
  if (def.toggleKey === "ELEVENLABS_VOICE_DISABLED") return v !== "1";
  if (def.toggleKey === "CARTESIA_VOICE_DISABLED") return v !== "1";
  return v !== "0";
}

/** Load integration cards for the portal (no secret values). */
export async function listIntegrationsAction(): Promise<IntegrationView[]> {
  await requireAccessForRead();
  return Promise.all(
    INTEGRATIONS.map(async (def) => {
      const fields = await fieldStatuses(def);
      const configured =
        def.fields.length === 0
          ? def.toggleKey
            ? await isEnabled(def)
            : true
          : fields.every((f) => f.configured);
      return {
        id: def.id,
        name: def.name,
        description: def.description,
        category: def.category,
        docsUrl: def.docsUrl,
        fields,
        toggleKey: def.toggleKey,
        enabled: await isEnabled(def),
        configured,
      };
    }),
  );
}

/** Save one or more secret fields for an integration. */
export async function saveIntegrationSecretsAction(
  integrationId: string,
  values: Record<string, string>,
): Promise<{ ok: true }> {
  await requireAccessForMutation();
  const def = integrationById(integrationId);
  if (!def) throw new Error("Unknown integration");

  const allowed = new Set(def.fields.map((f) => f.key));
  for (const [key, value] of Object.entries(values)) {
    if (!allowed.has(key)) continue;
    const trimmed = value.trim();
    if (trimmed) {
      await setSecret(key, trimmed);
    } else {
      await deleteSecret(key);
    }
  }

  revalidatePath("/integrations");
  return { ok: true };
}

/** Toggle an integration on/off (kill-switch style keys). */
export async function setIntegrationEnabledAction(
  integrationId: string,
  enabled: boolean,
): Promise<{ ok: true }> {
  await requireAccessForMutation();
  const def = integrationById(integrationId);
  if (!def?.toggleKey) throw new Error("This integration has no toggle");

  if (def.toggleKey === "ELEVENLABS_VOICE_DISABLED") {
    await setSecret(def.toggleKey, enabled ? "0" : "1");
  } else if (def.toggleKey === "CARTESIA_VOICE_DISABLED") {
    await setSecret(def.toggleKey, enabled ? "0" : "1");
  } else {
    await setSecret(def.toggleKey, enabled ? "1" : "0");
  }

  revalidatePath("/integrations");
  return { ok: true };
}
