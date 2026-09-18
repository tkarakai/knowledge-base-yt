import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";
import {
  adminClient,
  emailOTPClient,
  magicLinkClient,
  twoFactorClient,
} from "better-auth/client/plugins";

/**
 * Check if an auth API error is a rate limit (HTTP 429).
 * Use this in form error handlers to show a consistent rate-limit message.
 */
export function isAuthRateLimited(error: { status?: number }): boolean {
  return error.status === 429;
}

/** The standard rate-limit message shown across all auth forms. */
export const AUTH_RATE_LIMIT_MESSAGE =
  "Too many attempts. Please wait a moment before trying again.";

/**
 * Format an auth API error for display. Returns the rate-limit message
 * when applicable, otherwise falls back to the provided message.
 *
 * Pass `{ showServerMessage: true }` to surface the server's error message
 * for 4xx responses (e.g. "Password is compromised" from the HIBP plugin).
 */
export function formatAuthError(
  error: { status?: number; message?: string },
  fallbackMessage: string,
  options?: { showServerMessage?: boolean },
): string {
  if (isAuthRateLimited(error)) return AUTH_RATE_LIMIT_MESSAGE;
  if (
    options?.showServerMessage &&
    error.message &&
    error.status &&
    error.status >= 400 &&
    error.status < 500
  ) {
    return error.message;
  }
  return fallbackMessage;
}

/**
 * Check if a caught error is a Convex rate-limit error (ConvexError with
 * `data.kind === "RateLimited"`).
 */
export function isConvexRateLimited(err: unknown): boolean {
  if (!err || typeof err !== "object" || !("data" in err)) return false;
  const data = (err as { data: unknown }).data;
  return (
    !!data &&
    typeof data === "object" &&
    "kind" in data &&
    (data as { kind: string }).kind === "RateLimited"
  );
}

export const authClient = createAuthClient({
  plugins: [
    convexClient(),
    adminClient(),
    emailOTPClient(),
    magicLinkClient(),
    twoFactorClient(),
    passkeyClient(),
  ],
  fetchOptions: {
    onError: async (context) => {
      if (context.response.status === 429) {
        const retryAfter = context.response.headers.get("X-Retry-After");
        console.warn(
          `[auth] Rate limited. Retry after ${retryAfter ?? "unknown"} seconds.`,
        );
      }
    },
  },
});
