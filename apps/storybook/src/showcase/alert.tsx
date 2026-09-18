"use client";

import { AlertCircle, Info, Terminal } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@repo/design-system";
import { DemoSection } from "@/components/demo-section";

export default function AlertShowcase() {
  return (
    <>
      <DemoSection title="Default">
        <Alert>
          <Terminal className="h-4 w-4" />
          <AlertTitle>Heads up!</AlertTitle>
          <AlertDescription>
            You can add components to your app using the CLI.
          </AlertDescription>
        </Alert>
      </DemoSection>

      <DemoSection title="Destructive">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Your session has expired. Please log in again.
          </AlertDescription>
        </Alert>
      </DemoSection>

      <DemoSection title="Info Style">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Note</AlertTitle>
          <AlertDescription>
            This is an informational alert for general messages.
          </AlertDescription>
        </Alert>
      </DemoSection>
    </>
  );
}
