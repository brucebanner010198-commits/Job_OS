/**
 * Zod schemas for high-risk server action inputs (SEC hardening).
 * Parse at the action boundary before auth-sensitive work proceeds.
 */
import { z } from "zod";
import { INTEGRATIONS } from "@/lib/integrations/registry";

const integrationIds = INTEGRATIONS.map((i) => i.id) as [string, ...string[]];

/** Prisma cuid-style ids (application, profile, etc.). */
export const resourceIdSchema = z
  .string()
  .trim()
  .min(1, "Id is required")
  .max(128, "Id is too long")
  .regex(/^[a-z0-9]+$/i, "Invalid id");

export const profileNameSchema = z
  .string()
  .trim()
  .min(1, "Profile name is required")
  .max(64, "Profile name must be 64 characters or fewer");

const secretValueSchema = z.string().max(8192, "Secret value is too long");

export const saveIntegrationSecretsSchema = z.object({
  integrationId: z.enum(integrationIds, {
    error: "Unknown integration",
  }),
  values: z
    .record(z.string(), secretValueSchema)
    .refine((obj) => Object.keys(obj).length <= 32, "Too many fields"),
});

export const createProfileSchema = z.object({
  name: profileNameSchema,
});

export const deleteProfileSchema = z.object({
  profileId: resourceIdSchema,
});

export const approveSubmitSchema = z.object({
  applicationId: resourceIdSchema,
});

/** Parse and throw a user-safe Error on schema failure. */
export function parseActionInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const msg =
      result.error.issues.map((i) => i.message).join("; ") || "Invalid input";
    throw new Error(msg);
  }
  return result.data;
}
