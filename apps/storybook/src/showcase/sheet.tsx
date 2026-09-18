"use client";

import {
  Button,
  Input,
  Label,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/design-system";
import { DemoSection } from "@/components/demo-section";

export default function SheetShowcase() {
  return (
    <>
      <DemoSection title="Default (Right)">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">Open Sheet</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Edit Profile</SheetTitle>
              <SheetDescription>
                Make changes to your profile here. Click save when done.
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="sheet-name">Name</Label>
                <Input id="sheet-name" defaultValue="John Doe" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sheet-username">Username</Label>
                <Input id="sheet-username" defaultValue="@johndoe" />
              </div>
            </div>
            <SheetFooter>
              <SheetClose asChild>
                <Button>Save Changes</Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </DemoSection>

      <DemoSection title="Sides">
        <div className="flex flex-wrap gap-3">
          {(["top", "right", "bottom", "left"] as const).map((side) => (
            <Sheet key={side}>
              <SheetTrigger asChild>
                <Button variant="outline" className="capitalize">
                  {side}
                </Button>
              </SheetTrigger>
              <SheetContent side={side}>
                <SheetHeader>
                  <SheetTitle>Sheet from {side}</SheetTitle>
                  <SheetDescription>
                    This sheet slides in from the {side}.
                  </SheetDescription>
                </SheetHeader>
              </SheetContent>
            </Sheet>
          ))}
        </div>
      </DemoSection>
    </>
  );
}
