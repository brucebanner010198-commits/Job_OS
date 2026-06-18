import { db } from "@/lib/db";
import type { User } from "@prisma/client";

/**
 * Local-first install identity. The one user is created on first access,
 * keyed by PRIMARY_USER_EMAIL. Named profiles (see lib/profiles) scope career
 * data within the install; API keys stay per-install in lib/secrets.
 */
export async function getPrimaryUser(): Promise<User> {
  const email = process.env.PRIMARY_USER_EMAIL ?? "you@example.com";
  return db.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });
}
