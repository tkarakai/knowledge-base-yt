"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@repo/design-system";

import { WaitlistSection } from "./waitlist-section";

const CONVEX_SITE_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
if (!CONVEX_SITE_URL) {
  throw new Error("Missing required environment variable: NEXT_PUBLIC_CONVEX_SITE_URL");
}
const WEB_APP_URL = process.env.NEXT_PUBLIC_WEB_APP_URL;
if (!WEB_APP_URL) {
  throw new Error("Missing required environment variable: NEXT_PUBLIC_WEB_APP_URL");
}

/** Initial retry delay (ms). */
const RETRY_BASE = 5_000;
/** Maximum retry delay (ms). */
const RETRY_MAX = 60_000;
/** Stop retrying after this many consecutive failures. */
const MAX_RETRIES = 10;

type Status = "loading" | "unreachable" | "waitlist" | "signup" | "closed";

/**
 * Client component that checks onboarding mode on mount and renders one of:
 * waitlist form, sign-up + sign-in, or sign-in only.
 *
 * When Convex is unreachable, hides all interactive elements and retries
 * with exponential backoff (capped at 60 s, max 10 attempts). Retries
 * pause while the tab is hidden and resume when it becomes visible.
 */
export function HeroCta() {
  const t = useTranslations("landing");
  const [status, setStatus] = React.useState<Status>("loading");

  React.useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    async function checkWaitlist() {
      try {
        const res = await fetch(`${CONVEX_SITE_URL}/api/waitlist/status`);
        const data = (await res.json()) as {
          onboardingType?:
            | "inviteOnly"
            | "publicWaitlist"
            | "publicSignup"
            | "none"
            | "waitlist"
            | "signup";
          waitlistEnabled?: boolean;
          signupEnabled?: boolean;
          enabled?: boolean;
        };

        const nextStatus: Status =
          data.onboardingType === "publicWaitlist" ||
          data.onboardingType === "waitlist" ||
          data.waitlistEnabled === true ||
          data.enabled === true
            ? "waitlist"
            : data.onboardingType === "publicSignup" ||
              data.onboardingType === "signup" ||
              data.signupEnabled === true
            ? "signup"
            : "closed";

        if (!cancelled) {
          attempt = 0;
          setStatus(nextStatus);
        }
      } catch {
        if (!cancelled) {
          setStatus("unreachable");
          if (attempt < MAX_RETRIES) {
            const delay = Math.min(RETRY_BASE * 2 ** attempt, RETRY_MAX);
            attempt++;
            retryTimer = setTimeout(checkWaitlist, delay);
          }
        }
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible" && status === "unreachable") {
        clearTimeout(retryTimer);
        attempt = 0;
        checkWaitlist();
      } else if (document.visibilityState === "hidden") {
        clearTimeout(retryTimer);
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);

    checkWaitlist();
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [status]);

  if (status === "loading") {
    return (
      <div className="flex h-10 gap-3">
        <div className="h-10 w-32 animate-pulse rounded-md bg-muted" />
        <div className="h-10 w-24 animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  // Convex unreachable — hide everything; polling will restore UI automatically
  if (status === "unreachable") {
    return null;
  }

  if (status === "waitlist") {
    return <WaitlistSection />;
  }

  if (status === "signup") {
    return (
      <div className="flex gap-3">
        <Button asChild>
          <a href={`${WEB_APP_URL}/sign-up`}>{t("getStarted")}</a>
        </Button>
        <Button variant="outline" asChild>
          <a href={`${WEB_APP_URL}/sign-in`}>{t("signIn")}</a>
        </Button>
      </div>
    );
  }

  return (
    <Button variant="outline" asChild>
      <a href={`${WEB_APP_URL}/sign-in`}>{t("signIn")}</a>
    </Button>
  );
}
