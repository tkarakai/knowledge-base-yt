"use client";

import * as React from "react";

import { AnnouncementBanner } from "@repo/design-system";

const LOCAL_STORAGE_DISMISS_KEY = "announcementDismissedPermanentId";
const ANNOUNCEMENT_ENDPOINT_PATH = "/api/announcements/active";
const ANNOUNCEMENT_POLL_INTERVAL_MS = 15_000;
const ANNOUNCEMENT_REQUEST_TIMEOUT_MS = 8_000;

function getConvexSiteUrlCandidates(): string[] {
  const fromEnv = process.env.NEXT_PUBLIC_CONVEX_SITE_URL?.trim();
  if (!fromEnv) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_CONVEX_SITE_URL");
  }
  return [fromEnv];
}

type ActiveAnnouncement = {
  _id: string;
  name: string;
  bannerText: string;
  callToActionName?: string;
  callToActionUrl?: string;
  learnMoreName?: string;
  learnMoreContent?: string;
};

export function AnnouncementBannerHost() {
  const [announcement, setAnnouncement] = React.useState<ActiveAnnouncement | null>(
    null
  );
  const [dismissedId, setDismissedId] = React.useState<string | null>(null);
  const bannerContainerRef = React.useRef<HTMLDivElement | null>(null);
  const isVisible = Boolean(announcement && dismissedId !== announcement._id);

  React.useEffect(() => {
    let cancelled = false;
    let pollTimeoutId: number | null = null;
    let activeController: { abort: () => void } | null = null;

    const loadAnnouncement = async () => {
      for (const baseUrl of getConvexSiteUrlCandidates()) {
        if (cancelled) {
          return;
        }

        const requestController = new window.AbortController();
        activeController = requestController;
        const requestTimeoutId = window.setTimeout(() => {
          requestController.abort();
        }, ANNOUNCEMENT_REQUEST_TIMEOUT_MS);

        try {
          const res = await fetch(`${baseUrl}${ANNOUNCEMENT_ENDPOINT_PATH}`, {
            cache: "no-store",
            signal: requestController.signal,
          });
          if (!res.ok) {
            continue;
          }
          const json = (await res.json()) as {
            announcement: ActiveAnnouncement | null;
          };
          if (!cancelled) {
            setAnnouncement(json.announcement ?? null);
          }
          return;
        } catch {
          // Try the next candidate URL.
        } finally {
          window.clearTimeout(requestTimeoutId);
          if (activeController === requestController) {
            activeController = null;
          }
        }
      }

      if (!cancelled) {
        setAnnouncement(null);
      }
    };

    const runPollingLoop = async () => {
      await loadAnnouncement();
      if (cancelled) {
        return;
      }
      pollTimeoutId = window.setTimeout(() => {
        void runPollingLoop();
      }, ANNOUNCEMENT_POLL_INTERVAL_MS);
    };

    void runPollingLoop();

    return () => {
      cancelled = true;
      if (pollTimeoutId !== null) {
        window.clearTimeout(pollTimeoutId);
      }
      activeController?.abort();
    };
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setDismissedId(window.localStorage.getItem(LOCAL_STORAGE_DISMISS_KEY));
    } catch {
      setDismissedId(null);
    }
  }, [announcement?._id]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const root = window.document.documentElement;

    if (!isVisible || !bannerContainerRef.current) {
      root.style.removeProperty("--announcement-banner-h");
      return;
    }
    const bannerElement = bannerContainerRef.current;

    const updateHeightVar = () => {
      const height = bannerElement.offsetHeight;
      root.style.setProperty("--announcement-banner-h", `${height}px`);
    };

    updateHeightVar();

    const resizeObserver =
      typeof window.ResizeObserver !== "undefined"
        ? new window.ResizeObserver(updateHeightVar)
        : null;
    resizeObserver?.observe(bannerElement);
    window.addEventListener("resize", updateHeightVar);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateHeightVar);
      root.style.removeProperty("--announcement-banner-h");
    };
  }, [isVisible, announcement?._id]);

  if (!announcement) return null;
  if (dismissedId === announcement._id) return null;

  return (
    <div
      ref={bannerContainerRef}
      className="fixed top-[var(--env-banner-h,0px)] left-0 right-0 z-[60]"
    >
      <AnnouncementBanner
        name={announcement.name}
        bannerText={announcement.bannerText}
        callToActionName={announcement.callToActionName}
        callToActionUrl={announcement.callToActionUrl}
        learnMoreName={announcement.learnMoreName}
        learnMoreContent={announcement.learnMoreContent}
        onDismiss={() => {
          try {
            window.localStorage.setItem(LOCAL_STORAGE_DISMISS_KEY, announcement._id);
          } catch {
            // ignore storage errors
          }
          setDismissedId(announcement._id);
        }}
      />
    </div>
  );
}
