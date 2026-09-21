"use server";

import { db } from "@/lib/db";
import { ensureDefaultProfile } from "@/lib/profiles/service";
import {
  evaluatePasswordStrength,
  hashPassword,
  verifyPassword,
} from "@/lib/auth/password";
import { setSessionCookie, clearSessionCookie } from "@/lib/auth/session";

export interface SignUpResult {
  success: boolean;
  errors?: string[];
  redirect?: string;
}

export interface LoginResult {
  success: boolean;
  error?: string;
  redirect?: string;
}

export async function signUpAction(input: {
  username: string;
  email?: string;
  password: string;
}): Promise<SignUpResult> {
  const username = input.username?.trim().toLowerCase();
  if (!username || username.length < 3) {
    return { success: false, errors: ["Username must be at least 3 characters."] };
  }
  if (!/^[a-z0-9_-]+$/.test(username)) {
    return {
      success: false,
      errors: ["Username can only contain letters, numbers, underscores, and dashes."],
    };
  }

  // Check username uniqueness
  const existing = await db.user.findUnique({
    where: { username },
  });
  if (existing) {
    return { success: false, errors: ["This username is already registered."] };
  }

  // Strict password strength verification
  const evalResult = evaluatePasswordStrength(input.password, username);
  if (!evalResult.isValid) {
    return { success: false, errors: evalResult.errors };
  }

  const passwordHash = hashPassword(input.password);
  const email = input.email?.trim() || `${username}@local.jobos`;

  // Create user and initial default profile
  try {
    const user = await db.user.create({
      data: {
        username,
        email,
        name: username,
        passwordHash,
      },
    });

    await ensureDefaultProfile(user.id);
    await setSessionCookie(user.id);

    return { success: true, redirect: "/setup" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create account.";
    return { success: false, errors: [message] };
  }
}

export async function loginAction(input: {
  username: string;
  password: string;
}): Promise<LoginResult> {
  const identifier = input.username?.trim().toLowerCase();
  if (!identifier || !input.password) {
    return { success: false, error: "Please provide both username and password." };
  }

  const user = await db.user.findFirst({
    where: {
      OR: [{ username: identifier }, { email: identifier }],
    },
  });

  if (!user || !user.passwordHash) {
    return { success: false, error: "Invalid username or password." };
  }

  const matches = verifyPassword(input.password, user.passwordHash);
  if (!matches) {
    return { success: false, error: "Invalid username or password." };
  }

  await setSessionCookie(user.id);
  return { success: true, redirect: "/setup" };
}

export async function logoutAction(): Promise<{ success: boolean; redirect: string }> {
  await clearSessionCookie();
  return { success: true, redirect: "/login" };
}
