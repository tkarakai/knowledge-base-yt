"use client";

import * as React from "react";
import { Progress } from "@repo/design-system";
import { DemoSection } from "@/components/demo-section";

export default function ProgressShowcase() {
  const [progress, setProgress] = React.useState(13);

  React.useEffect(() => {
    const timer = setTimeout(() => setProgress(66), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <DemoSection title="Default">
        <Progress value={progress} className="max-w-md" />
      </DemoSection>

      <DemoSection title="Various Values">
        <div className="max-w-md space-y-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">25%</p>
            <Progress value={25} />
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">50%</p>
            <Progress value={50} />
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">75%</p>
            <Progress value={75} />
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">100%</p>
            <Progress value={100} />
          </div>
        </div>
      </DemoSection>
    </>
  );
}
