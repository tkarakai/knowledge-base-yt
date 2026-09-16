"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";

import { api } from "@repo/backend";
import { AnnouncementBanner } from "@repo/design-system";

const LOCAL_STORAGE_DISMISS_KEY = "announcementDismissedPermanentId";

type AnnouncementBannerHostProps = {
  className?: string;
  hideOnDashboard?: boolean;
  fixed?: boolean;
};

export function AnnouncementBannerHost({
  className,
  hideOnDashboard = false,
  fixed = false,
}: AnnouncementBannerHostProps) {
  const pathname = usePathname();
  const announcement = useQuery(api.announcements.getActivePublic);
  const [dismissedId, setDismissedId] = React.useState<string | null>(null);
  const [hasHydratedDismissal, setHasHydratedDismissal] = React.useState(false);
  const bannerContainerRef = React.useRef<HTMLDivElement | null>(null);
  const isDashboardRoute = pathname?.split("/").includes("dashboard") ?? false;
  const shouldHide = hideOnDashboard && isDashboardRoute;
  const isVisible =
    !shouldHide &&
    hasHydratedDismissal &&
    Boolean(announcement && dismissedId !== announcement._id);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setDismissedId(window.localStorage.getItem(LOCAL_STORAGE_DISMISS_KEY));
    } catch {
      setDismissedId(null);
    } finally {
      setHasHydratedDismissal(true);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const root = window.document.documentElement;

    if (!fixed || !isVisible || !bannerContainerRef.current) {
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
  }, [fixed, isVisible, announcement?._id]);

  if (shouldHide) return null;
  if (!hasHydratedDismissal) return null;
  if (!announcement) return null;
  if (dismissedId === announcement._id) return null;

  const banner = (
    <AnnouncementBanner
      className={className}
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
          // ignore storage errors (private mode / disabled storage)
        }
        setDismissedId(announcement._id);
      }}
    />
  );

  if (!fixed) {
    return banner;
  }

  return (
    <div
      ref={bannerContainerRef}
      className="fixed top-[var(--env-banner-h,0px)] left-0 right-0 z-[60]"
    >
      {banner}
    </div>
  );
}
