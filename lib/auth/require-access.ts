/**
 * Server-action access gate (SEC-01). Loopback is always trusted; when
 * JOB_OS_ACCESS_TOKEN is set and the Host is non-local, mutating actions must
 * present the same token (Bearer, x-job-os-token, or job_os_access cookie).
 */
import { headers } from "next/headers";
import {
  accessRequiredForHost,
  readProvidedTokenFromHeaders,
  verifyAccessToken,
} from "@/lib/auth/access";

async function requireAccessWhenLan(): Promise<void> {
  const h = await headers();
  if (!accessRequiredForHost(h.get("host"))) return;

  const provided = readProvidedTokenFromHeaders(h);
  if (!verifyAccessToken(provided)) {
    throw new Error(
      "Unauthorized - visit with ?token=YOUR_TOKEN once or send Authorization: Bearer.",
    );
  }
}

/** Throws when a mutation is attempted without a valid access token on LAN. */
export async function requireAccessForMutation(): Promise<void> {
  await requireAccessWhenLan();
}

/** Throws when a read is attempted without a valid access token on LAN. */
export async function requireAccessForRead(): Promise<void> {
  await requireAccessWhenLan();
}
