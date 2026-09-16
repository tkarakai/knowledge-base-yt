"use client";

import { Skeleton } from "@repo/design-system";
import { DemoSection } from "@/components/demo-section";

export default function SkeletonShowcase() {
  return (
    <>
      <DemoSection title="Basic Shapes">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        </div>
      </DemoSection>

      <DemoSection title="Card Skeleton">
        <div className="max-w-sm space-y-4">
          <Skeleton className="h-[125px] w-full rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      </DemoSection>
    </>
  );
}
