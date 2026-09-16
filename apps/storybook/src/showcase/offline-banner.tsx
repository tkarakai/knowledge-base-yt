"use client";

import * as React from "react";
import { WifiOff } from "lucide-react";
import { cn, Button } from "@repo/design-system";
import { DemoSection } from "@/components/demo-section";

/**
 * Static preview of the OfflineBanner visual appearance.
 * The real component uses useNetworkStatus() and returns null when online,
 * so we render the markup directly with position:static for the showcase.
 */
function BannerPreview({
  opacity = "opacity-95",
  className,
}: {
  opacity?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      aria-live="polite"
      data-slot="offline-banner"
      className={cn(
        "left-0 right-0",
        "flex items-center justify-center gap-2 px-4 py-2",
        "text-offline-foreground text-sm font-medium",
        "bg-offline/95 backdrop-blur supports-[backdrop-filter]:bg-offline/60",
        "[transition:opacity_300ms_cubic-bezier(0.4,0,0.2,1)]",
        opacity,
        className,
      )}
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>You appear to be offline. An active connection is needed to continue.</span>
    </div>
  );
}

export default function OfflineBannerShowcase() {
  const [simulated, setSimulated] = React.useState(false);

  return (
    <>
      <DemoSection
        title="Default"
        description="Red frosted-glass banner with WifiOff icon. Appears at the top of the page when offline."
      >
        <BannerPreview />
      </DemoSection>

      <DemoSection
        title="Fade-in Animation"
        description="Toggle simulated offline state to see the opacity transition."
        toolbar={
          <Button
            variant={simulated ? "destructive" : "outline"}
            size="sm"
            onClick={() => setSimulated((v) => !v)}
          >
            {simulated ? "Go Online" : "Go Offline"}
          </Button>
        }
      >
        <div className="relative min-h-[40px] overflow-hidden rounded">
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            Page content behind the banner
          </div>
          <BannerPreview
            opacity={simulated ? "opacity-95" : "opacity-0"}
          />
        </div>
      </DemoSection>

      <DemoSection
        title="Backdrop Blur"
        description="The banner uses the same frosted-glass technique as the site header: a semi-transparent background with backdrop-blur."
      >
        <div className="relative min-h-[40px] overflow-hidden rounded">
          <div className="absolute inset-0 bg-gradient-to-r from-primary via-destructive to-chart-1 flex items-center justify-center text-sm font-bold text-white">
            Colorful content to demonstrate blur
          </div>
          <BannerPreview />
        </div>
      </DemoSection>
    </>
  );
}
