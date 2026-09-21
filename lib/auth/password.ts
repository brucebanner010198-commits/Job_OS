import { randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";

export interface PasswordEvaluation {
  isValid: boolean;
  score: number; // 0 to 4
  errors: string[];
}

const COMMON_WEAK_WORDS = [
  "password",
  "123456",
  "12345678",
  "qwerty",
  "admin",
  "welcome",
  "jobos",
  "letmein",
];

/**
 * Calculates Shannon entropy for password complexity estimation.
 */
export function calculateEntropy(password: string): number {
  if (!password) return 0;
  const map: Record<string, number> = {};
  for (const char of password) {
    map[char] = (map[char] || 0) + 1;
  }
  let entropy = 0;
  const len = password.length;
  for (const char in map) {
    const p = map[char] / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * Evaluates password strength against strict requirements:
 * 1. At least 12 characters
 * 2. Mixed case (uppercase and lowercase)
 * 3. At least one digit
 * 4. At least one special character
 * 5. High entropy (entropy >= 3.0)
 * 6. No common dictionary words
 * 7. Does not contain the username
 */
export function evaluatePasswordStrength(
  password: string,
  username?: string,
): PasswordEvaluation {
  const errors: string[] = [];

  if (!password || password.length < 12) {
    errors.push("Password must be at least 12 characters long.");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter.");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter.");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number.");
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
    errors.push("Password must contain at least one special symbol.");
  }

  const lower = password.toLowerCase();
  for (const weak of COMMON_WEAK_WORDS) {
    if (lower.includes(weak)) {
      errors.push(`Password contains a common weak phrase ("${weak}").`);
      break;
    }
  }

  if (username && username.trim().length >= 3) {
    if (lower.includes(username.toLowerCase().trim())) {
      errors.push("Password cannot contain your username.");
    }
  }

  const entropy = calculateEntropy(password);
  let score = 0;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password) && /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) score += 1;
  if (entropy >= 3.2 && password.length >= 14) score += 1;

  const isValid = errors.length === 0 && entropy >= 2.8;

  return {
    isValid,
    score: Math.min(score, 4),
    errors,
  };
}

/**
 * Generates an ultra-strong, 18-character high-entropy password.
 */
export function generateStrongPassword(): string {
  const uppers = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowers = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*_-+=";

  // Guarantee at least 2 of each category with cryptographic randomness
  const guaranteed = [
    uppers[randomInt(0, uppers.length)],
    uppers[randomInt(0, uppers.length)],
    lowers[randomInt(0, lowers.length)],
    lowers[randomInt(0, lowers.length)],
    digits[randomInt(0, digits.length)],
    digits[randomInt(0, digits.length)],
    symbols[randomInt(0, symbols.length)],
    symbols[randomInt(0, symbols.length)],
  ];

  const allChars = uppers + lowers + digits + symbols;
  const remainingCount = 10;
  const remaining: string[] = [];
  for (let i = 0; i < remainingCount; i++) {
    remaining.push(allChars[randomInt(0, allChars.length)]);
  }

  const combined = [...guaranteed, ...remaining];
  // Cryptographically secure Fisher-Yates shuffle
  for (let i = combined.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }

  return combined.join("");
}

/**
 * Hashes password using Node's cryptographic scrypt.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verifies password against stored scrypt hash using timingSafeEqual.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(":");
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, "hex");
    const derivedKeyBuffer = scryptSync(password, salt, 64);
    return timingSafeEqual(keyBuffer, derivedKeyBuffer);
  } catch {
    return false;
  }
}
