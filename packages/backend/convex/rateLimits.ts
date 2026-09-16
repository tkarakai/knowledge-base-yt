import { defineRateLimits } from "convex-helpers/server/rateLimit";
import { v } from "convex/values";

import { internalMutation } from "./_generated/server";

const MINUTE = 60_000;
const SECOND = 1_000;

/** Parse an env var as a positive integer, falling back to a safe default. */
function positiveInt(envVar: string | undefined, defaultValue: number): number {
  const parsed = parseInt(envVar ?? "", 10);
  if (Number.isNaN(parsed) || parsed <= 0) return defaultValue;
  return parsed;
}

/**
 * Centralized rate limit definitions for Convex functions.
 *
 * Token bucket: smooth rate over time, allows burst up to capacity.
 * All values are configurable via Convex environment variables.
 */
const rateLimitDefs = {
  /** Global per-user mutation rate limit applied to all authedMutation calls. */
  mutationGlobal: {
    kind: "token bucket",
    rate: positiveInt(process.env.MUTATION_RATE_LIMIT_RATE, 30),
    period: positiveInt(process.env.MUTATION_RATE_LIMIT_PERIOD, MINUTE),
    capacity: positiveInt(process.env.MUTATION_RATE_LIMIT_CAPACITY, 10),
  },

  /** Public waitlist join endpoint — keyed by IP address. */
  waitlistJoin: {
    kind: "token bucket",
    rate: positiveInt(process.env.WAITLIST_RATE_LIMIT_RATE, 5),
    period: positiveInt(process.env.WAITLIST_RATE_LIMIT_PERIOD, MINUTE),
    capacity: positiveInt(process.env.WAITLIST_RATE_LIMIT_CAPACITY, 3),
  },

  /** Invitation token claim — keyed by token string to prevent brute-force. */
  tokenClaim: {
    kind: "token bucket",
    rate: 3,
    period: MINUTE,
    capacity: 3,
  },

  // ---------------------------------------------------------------------------
  // Auth endpoint rate limits (replaces Better Auth's built-in rate limiting
  // which causes OCC conflicts on Convex's database storage).
  // Keyed by IP or email depending on the endpoint.
  // ---------------------------------------------------------------------------

  /** Sign-in — keyed by email to prevent brute-force password guessing. */
  authSignIn: {
    kind: "token bucket",
    rate: 3,
    period: 10 * SECOND,
    capacity: 3,
  },

  /** Sign-up — keyed by IP to prevent mass account creation. */
  authSignUp: {
    kind: "token bucket",
    rate: 5,
    period: MINUTE,
    capacity: 5,
  },

  /** Password reset request — keyed by IP to prevent enumeration/spam. */
  authPasswordResetRequest: {
    kind: "token bucket",
    rate: 3,
    period: MINUTE,
    capacity: 3,
  },

  /** Password reset — keyed by IP. */
  authPasswordReset: {
    kind: "token bucket",
    rate: 5,
    period: MINUTE,
    capacity: 5,
  },

  /** Verification email — keyed by IP to prevent email spam. */
  authVerificationEmail: {
    kind: "token bucket",
    rate: 3,
    period: MINUTE,
    capacity: 3,
  },

  /** Email OTP send — keyed by IP. */
  authEmailOtp: {
    kind: "token bucket",
    rate: 3,
    period: MINUTE,
    capacity: 3,
  },

  /** Magic link send — keyed by IP. */
  authMagicLink: {
    kind: "token bucket",
    rate: 3,
    period: MINUTE,
    capacity: 3,
  },
} as const;

export const { checkRateLimit, rateLimit, resetRateLimit } =
  defineRateLimits(rateLimitDefs);

/** Union of all rate limit names defined above. */
type DefinedRateLimitName = keyof typeof rateLimitDefs;

/**
 * Internal mutation callable from HTTP actions (e.g. Better Auth plugins).
 * Consumes a token and returns { ok, retryAt } without throwing so the
 * caller can build the appropriate HTTP 429 response.
 */
export const consumeAuthRateLimit = internalMutation({
  args: {
    name: v.string(),
    key: v.string(),
  },
  handler: async (ctx, { name, key }) => {
    return await rateLimit(ctx, {
      name: name as DefinedRateLimitName,
      key,
      throws: false,
    });
  },
});
