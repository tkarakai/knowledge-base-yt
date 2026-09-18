"use client";

import * as React from "react";
import { ArrowRight, Loader2, Mail, Plus, Trash2 } from "lucide-react";
import { Button } from "@repo/design-system";
import { DemoSection } from "@/components/demo-section";

export default function ButtonShowcase() {
  const [loading, setLoading] = React.useState(false);

  function handleLoadingClick() {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  }

  return (
    <>
      <DemoSection title="Variants">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="default">Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
        </div>
      </DemoSection>

      <DemoSection title="Sizes">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <Button size="icon">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </DemoSection>

      <DemoSection title="With Icons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>
            <Mail className="h-4 w-4" />
            Send Email
          </Button>
          <Button variant="outline">
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
          <Button variant="secondary">
            Continue
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button variant="destructive">
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </DemoSection>

      <DemoSection title="Loading State">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleLoadingClick} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Saving..." : "Click to save"}
          </Button>
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Loading for 2 seconds..."
              : "Click the button to see the loading state."}
          </p>
        </div>
      </DemoSection>

      <DemoSection title="Disabled">
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled>Default</Button>
          <Button variant="secondary" disabled>Secondary</Button>
          <Button variant="outline" disabled>Outline</Button>
          <Button variant="ghost" disabled>Ghost</Button>
          <Button variant="destructive" disabled>Destructive</Button>
        </div>
      </DemoSection>
    </>
  );
}
