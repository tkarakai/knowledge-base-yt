"use client";

import { DemoSection } from "@/components/demo-section";

export default function SidebarShowcase() {
  return (
    <>
      <DemoSection
        title="Live Demo"
        description="The sidebar on the left is a live example of the Sidebar component."
      >
        <p className="text-sm text-muted-foreground">
          Try collapsing the sidebar using the rail or the trigger button in the
          header. The sidebar supports collapsible icon mode, nested menus, and
          responsive behavior on mobile.
        </p>
      </DemoSection>

      <DemoSection title="Features">
        <ul className="list-disc space-y-1 pl-6 text-sm text-muted-foreground">
          <li>Collapsible with icon-only mode</li>
          <li>Nested menu groups with collapsible sections</li>
          <li>Sheet-based overlay on mobile viewports</li>
          <li>Keyboard accessible with proper ARIA attributes</li>
          <li>Tooltip hints when collapsed</li>
        </ul>
      </DemoSection>
    </>
  );
}
