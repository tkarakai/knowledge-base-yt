"use client";

import { SiteHeader } from "@repo/design-patterns";
import { Button } from "@repo/design-system";
import { Globe } from "lucide-react";
import { DemoSection } from "@/components/demo-section";

export default function SiteHeaderShowcase() {
  return (
    <>
      <DemoSection
        title="Default"
        description="A fixed site header with app icon, name, and home link. Rendered with relative positioning for this demo."
      >
        <div className="relative w-full overflow-hidden rounded-lg border">
          <SiteHeader appName="My App" homeHref="#" className="relative" />
        </div>
      </DemoSection>

      <DemoSection
        title="With Actions"
        description="Pass any content to the actions slot. Commonly used for a language selector or user menu."
      >
        <div className="relative w-full overflow-hidden rounded-lg border">
          <SiteHeader
            appName="My App"
            homeHref="#"
            className="relative"
            actions={
              <Button variant="outline" size="sm">
                <Globe className="h-4 w-4 me-2" />
                English
              </Button>
            }
          />
        </div>
      </DemoSection>

      <DemoSection
        title="External Home Link"
        description="When used in a sub-app (e.g., auth pages), homeHref can point to an external landing page URL."
      >
        <div className="relative w-full overflow-hidden rounded-lg border">
          <SiteHeader
            appName="Admin Dashboard"
            homeHref="https://example.com"
            className="relative"
          />
        </div>
      </DemoSection>
    </>
  );
}
