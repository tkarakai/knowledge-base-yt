"use client";

import { useEffect, useRef, useCallback } from "react";
import { ConvexError } from "convex/values";

export type ConvexErrorInfo = {
  /** Machine-readable error code for i18n lookup. */
  code: string;
  /** Default English message (used as fallback when no translation exists). */
  message: string;
  /** Optional interpolation params (e.g. { seconds: 5 } for rate limits). */
  params?: Record<string, string | number>;
};

/**
 * Extract structured error info from a Convex error.
 *
 * Convex SDK wraps server errors in this format:
 *   [CONVEX M(module:function)] errorMessage
 *     Called by client
 *
 * ConvexError instances carry structured data in `.data`.
 */
function extractErrorInfo(error: unknown): ConvexErrorInfo | null {
  // Handle ConvexError (structured errors like rate limits)
  if (error instanceof ConvexError) {
    const data = error.data;
    if (data && typeof data === "object" && "kind" in data) {
      const obj = data as Record<string, unknown>;
      if (obj.kind === "RateLimited") {
        const retryAt =
          typeof obj.retryAt === "number" ? obj.retryAt : undefined;
        const seconds = retryAt
          ? Math.ceil((retryAt - Date.now()) / 1000)
          : 5;
        return {
          code: "RATE_LIMITED",
          message: `Too many requests. Please wait ${seconds} seconds.`,
          params: { seconds },
        };
      }
    }
    const msg =
      typeof data === "string"
        ? data
        : data && typeof data === "object" && "message" in data
          ? String((data as Record<string, unknown>).message)
          : error.message;
    return { code: "SERVER_ERROR", message: msg };
  }

  if (error instanceof Error) {
    // Convex server function errors: [CONVEX M(path)] errorMessage\n  Called by client
    const match = error.message.match(
      /^\[CONVEX [A-Z]\([^\)]+\)\]\s*(.+?)(?:\n|$)/,
    );
    if (match) {
      const rawMessage = match[1]!;
      return { code: rawMessage, message: rawMessage };
    }

    // Network / infrastructure errors (Convex is down, no connectivity)
    if (
      error instanceof TypeError ||
      error.message.includes("fetch") ||
      error.message.includes("network") ||
      error.message.includes("Failed to") ||
      /^[0-9]{3}\b/.test(error.message) ||
      error.message.startsWith("<!") ||
      error.message.startsWith("<html")
    ) {
      return {
        code: "CONNECTION_LOST",
        message:
          "Unable to connect to the server. Please check your connection.",
      };
    }
  }

  return null;
}

type ConvexErrorHandlerProps = {
  /** Called when an unhandled Convex error is detected. */
  onError: (info: ConvexErrorInfo) => void;
  /** Deduplication window in milliseconds. Default: 2000. */
  dedupeWindowMs?: number;
};

/**
 * Global handler for unhandled Convex server call errors.
 *
 * Listens for `unhandledrejection` events, identifies Convex and
 * network errors, deduplicates within a time window, and calls
 * `onError` with structured error info. Renders nothing. Mount once
 * near the app root.
 */
export function ConvexErrorHandler({
  onError,
  dedupeWindowMs = 2000,
}: ConvexErrorHandlerProps) {
  const recentRef = useRef<Map<string, number>>(new Map());

  const handleRejection = useCallback(
    (event: PromiseRejectionEvent) => {
      const info = extractErrorInfo(event.reason);
      if (!info) return;

      event.preventDefault();

      const now = Date.now();
      const recent = recentRef.current;
      const dedupeKey = info.code;
      const lastShown = recent.get(dedupeKey);
      if (lastShown && now - lastShown < dedupeWindowMs) return;

      recent.set(dedupeKey, now);

      // Clean stale entries
      for (const [key, time] of recent) {
        if (now - time > dedupeWindowMs) recent.delete(key);
      }

      onError(info);
    },
    [onError, dedupeWindowMs],
  );

  useEffect(() => {
    window.addEventListener("unhandledrejection", handleRejection);
    return () =>
      window.removeEventListener("unhandledrejection", handleRejection);
  }, [handleRejection]);

  return null;
}
