"use client";

import * as React from "react";
import { Info, Megaphone, X } from "lucide-react";

import { cn } from "../../lib/utils";
import { Button } from "../actions/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "../overlay/dialog";

export type AnnouncementBannerProps = Omit<
  React.ComponentProps<"section">,
  "title"
> & {
  name?: string;
  bannerText: string;
  callToActionName?: string;
  callToActionUrl?: string;
  learnMoreName?: string;
  learnMoreContent?: string;
  dismissLabel?: string;
  onDismiss?: () => void;
};

export function AnnouncementBanner({
  name,
  bannerText,
  callToActionName,
  callToActionUrl,
  learnMoreName,
  learnMoreContent,
  dismissLabel = "Dismiss announcement",
  onDismiss,
  className,
  ...props
}: AnnouncementBannerProps) {
  const [learnMoreOpen, setLearnMoreOpen] = React.useState(false);
  const hasActionButtons =
    (callToActionName && callToActionUrl) ||
    (learnMoreName && learnMoreContent);

  return (
    <>
      <section
        role="region"
        aria-label={name ? `${name} announcement` : "Announcement"}
        data-slot="announcement-banner"
        className={cn(
          "w-full border-b border-amber-300/70 bg-amber-50/90 text-amber-950 backdrop-blur supports-[backdrop-filter]:bg-amber-50/70",
          "dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100",
          className
        )}
        {...props}
      >
        <div className="mx-auto flex w-full max-w-screen-2xl items-start gap-3 px-4 py-3">
          <p className="min-w-0 flex-1 text-sm leading-relaxed">
            <Megaphone
              aria-hidden="true"
              className="me-2 inline h-4 w-4 shrink-0 align-[-0.125em]"
            />
            {bannerText}
          </p>
          {hasActionButtons ? (
            <div className="ms-auto flex shrink-0 items-center gap-2">
              {callToActionName && callToActionUrl && (
                <Button size="sm" asChild>
                  <a href={callToActionUrl}>{callToActionName}</a>
                </Button>
              )}
              {learnMoreName && learnMoreContent && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setLearnMoreOpen(true)}
                >
                  <Info className="mr-1.5 h-3.5 w-3.5" />
                  {learnMoreName}
                </Button>
              )}
            </div>
          ) : null}
          {onDismiss && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onDismiss}
              aria-label={dismissLabel}
              className="h-8 w-8 shrink-0 p-0"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </section>

      <Dialog open={learnMoreOpen} onOpenChange={setLearnMoreOpen}>
        <DialogContent className="max-w-3xl">
          <DialogTitle className="flex items-center text-foreground">
            <Info className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">Announcement details</span>
          </DialogTitle>
          <iframe
            title={learnMoreName ?? "Announcement details"}
            srcDoc={learnMoreContent ?? ""}
            sandbox=""
            className="h-[420px] w-full rounded-md border bg-white"
          />
          <div className="mt-1 flex justify-end">
            <Button type="button" onClick={() => setLearnMoreOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
