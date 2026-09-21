import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import type { User } from "@prisma/client";

export const SESSION_COOKIE_NAME = "job_os_user_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds

let inMemorySecret: string | null = null;

function getSecretKey(): string {
  const fromEnv = process.env.JOB_OS_SESSION_SECRET?.trim() || process.env.JOB_OS_ACCESS_TOKEN?.trim();
  if (fromEnv) return fromEnv;

  const keyDir = path.join(process.cwd(), ".secrets");
  const keyFile = path.join(keyDir, "session.key");

  try {
    if (existsSync(keyFile)) {
      const existing = readFileSync(keyFile, "utf8").trim();
      if (existing.length >= 32) return existing;
    }
    const generated = randomBytes(32).toString("hex");
    mkdirSync(keyDir, { recursive: true, mode: 0o700 });
    writeFileSync(keyFile, generated, { mode: 0o600 });
    return generated;
  } catch {
    if (!inMemorySecret) {
      inMemorySecret = randomBytes(32).toString("hex");
    }
    return inMemorySecret;
  }
}

/** Sign a session payload (userId:timestamp) */
export function signSessionToken(userId: string): string {
  const timestamp = Date.now().toString();
  const payload = `${userId}.${timestamp}`;
  const hmac = createHmac("sha256", getSecretKey()).update(payload).digest("hex");
  return `${payload}.${hmac}`;
}

/** Verify and parse session token */
export function verifySessionToken(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [userId, timestampStr, signature] = parts;
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) return null;

    // Check expiration (30 days)
    if (Date.now() - timestamp > SESSION_MAX_AGE * 1000) return null;

    const payload = `${userId}.${timestampStr}`;
    const expectedHmac = createHmac("sha256", getSecretKey()).update(payload).digest("hex");
    if (signature.length !== expectedHmac.length) return null;

    const expectedBuffer = Buffer.from(expectedHmac, "hex");
    const givenBuffer = Buffer.from(signature, "hex");
    if (expectedBuffer.length !== givenBuffer.length) return null;
    if (!timingSafeEqual(expectedBuffer, givenBuffer)) return null;

    return userId;
  } catch {
    return null;
  }
}

/** Set session cookie on login / signup */
export async function setSessionCookie(userId: string): Promise<void> {
  const jar = await cookies();
  const token = signSessionToken(userId);
  jar.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

/** Clear session cookie on logout */
export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE_NAME);
}

/** Resolve currently authenticated user from session cookie */
export async function getSessionUser(): Promise<User | null> {
  try {
    const jar = await cookies();
    const cookie = jar.get(SESSION_COOKIE_NAME)?.value;
    if (!cookie) return null;

    const userId = verifySessionToken(cookie);
    if (!userId) return null;

    const user = await db.user.findUnique({
      where: { id: userId },
    });
    return user;
  } catch {
    // Outside request scope (CLI/worker/test context) or invalid token
    return null;
  }
}
