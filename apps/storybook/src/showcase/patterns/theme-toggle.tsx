"use client";

import { ThemeToggle } from "@repo/design-patterns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Button,
} from "@repo/design-system";
import { DemoSection } from "@/components/demo-section";

export default function ThemeToggleShowcase() {
  return (
    <>
      <DemoSection
        title="Default"
        description="A segmented control for switching between light, system, and dark themes."
      >
        <div className="flex items-center gap-4">
          <ThemeToggle />
        </div>
      </DemoSection>

      <DemoSection
        title="Custom Width"
        description="The toggle can be constrained to a specific width."
      >
        <div className="flex flex-col gap-4">
          <ThemeToggle className="w-40" />
          <ThemeToggle className="w-60" />
          <ThemeToggle className="w-full max-w-sm" />
        </div>
      </DemoSection>

      <DemoSection
        title="Collapsed"
        description="A single icon button that cycles through themes on click. Useful when space is tight, such as in a collapsed sidebar."
      >
        <div className="flex items-center gap-4">
          <ThemeToggle collapsed />
        </div>
      </DemoSection>

      <DemoSection
        title="Inside Dropdown Menu"
        description="Commonly used inside a user profile dropdown in the sidebar footer."
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">Open menu</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48">
            <div className="mx-1 my-1">
              <ThemeToggle />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </DemoSection>
    </>
  );
}
