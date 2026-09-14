import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcryptjs";

export const SETUP_TOKEN_TTL_DAYS = 7;

/**
 * Replaces "every new account defaults to password 12345." Call this
 * instead of `bcrypt.hash(DEFAULT_PASSWORD, 10)` when creating any real
 * User row (Staff, Parent, School Admin, Platform Staff). It returns:
 *   - placeholderHash: an unusable random bcrypt hash for the required
 *     passwordHash column — nobody can log in with it, ever.
 *   - setupTokenHash / setupTokenExpiresAt: store these on the User row.
 *   - token: the raw one-time secret. Show it to the creating admin
 *     exactly once (e.g. via a one-shot query param on the redirect
 *     after creation) as `/setup-account?token=${token}` — never persist
 *     the raw token anywhere; only its hash is stored.
 */
export async function createPendingAccount() {
  const token = randomBytes(32).toString("hex");
  const setupTokenHash = hashSetupToken(token);
  const setupTokenExpiresAt = new Date(Date.now() + SETUP_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  const placeholderHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
  return { token, setupTokenHash, setupTokenExpiresAt, placeholderHash };
}

export function hashSetupToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
