"use server";

import { revalidatePath } from "next/cache";
import { requireAccessForMutation } from "@/lib/auth/require-access";
import { getAppContext } from "@/lib/app-context";
import { generateBrief } from "@/lib/brief/service";
import { type Claim, type CompanyBriefData } from "@/lib/brief/types";

// ---------------------------------------------------------------------------
// Serialized types (Date → ISO string for the server→client boundary)
//
// CompanyBriefData has two Date fields:
//   generatedAt: Date
//   claims[].retrievedAt: Date
//
// Server actions must return plain-serializable values. We convert both to
// ISO strings here and export the resulting types so the client component can
// import a single authoritative shape from this file.
// ---------------------------------------------------------------------------

/** Claim with retrievedAt as an ISO string (safe for server→client props). */
export type SerializedClaim = Omit<Claim, "retrievedAt"> & { retrievedAt: string };

/**
 * CompanyBriefData with all Date fields serialized to ISO strings.
 * This is what generateBriefAction returns - the client component accepts this
 * type instead of CompanyBriefData directly.
 */
export type SerializedBriefData = Omit<CompanyBriefData, "generatedAt" | "claims"> & {
  generatedAt: string;
  claims: SerializedClaim[];
};

// ---------------------------------------------------------------------------
// Serialization helper
// ---------------------------------------------------------------------------

function serializeBrief(data: CompanyBriefData): SerializedBriefData {
  return {
    ...data,
    generatedAt: data.generatedAt.toISOString(),
    claims: data.claims.map((c) => ({
      ...c,
      retrievedAt: c.retrievedAt.toISOString(),
    })),
  };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Generate (and persist) a company brief for the named company.
 * Returns a serialized form with Date fields as ISO strings - safe to pass
 * directly to client components or store in React state.
 *
 * Trims the company name; throws if it is empty after trimming.
 */
export async function generateBriefAction(
  name: string,
  domain?: string,
): Promise<SerializedBriefData> {
  await requireAccessForMutation();
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Company name is required.");

  const trimmedDomain = domain?.trim() || undefined;

  const { scope } = await getAppContext();
  const brief = await generateBrief(scope, {
    name: trimmedName,
    domain: trimmedDomain,
  });

  revalidatePath("/companies");
  return serializeBrief(brief);
}
