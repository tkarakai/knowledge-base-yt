"use client";

import * as React from "react";

import { authClient } from "@repo/auth/client";
import { onAuthBroadcast } from "@/lib/auth-broadcast";

/**
 * Wraps unauthenticated pages (sign-in).
 * Redirects to /dashboard when the user becomes authenticated,
 * e.g. after logging in on another tab.
 *
 * Uses a full page navigation (not Next.js router) so the Convex auth
 * provider remounts with a fresh server-issued token.
 */
export function GuestGuard({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    // Listen for auth events from other tabs (instant, no network call).
    const cleanupBroadcast = onAuthBroadcast(() => {
      window.location.replace("/dashboard");
    });

    // When the tab becomes visible, check if a session now exists (fallback).
    const handleVisibility = async () => {
      if (document.visibilityState !== "visible") return;
      const { data } = await authClient.getSession();
      if (data?.session) {
        window.location.replace("/dashboard");
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cleanupBroadcast();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return <>{children}</>;
}
