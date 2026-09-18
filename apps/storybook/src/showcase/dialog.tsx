"use client";

import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
} from "@repo/design-system";
import { DemoSection } from "@/components/demo-section";

export default function DialogShowcase() {
  return (
    <>
      <DemoSection title="Basic Dialog">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Open Dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Profile</DialogTitle>
              <DialogDescription>
                Make changes to your profile here. Click save when you are done.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="dialog-name">Name</Label>
                <Input id="dialog-name" defaultValue="John Doe" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dialog-email">Email</Label>
                <Input id="dialog-email" defaultValue="john@example.com" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button>Save Changes</Button>
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      </DemoSection>

      <DemoSection title="Informational">
        <Dialog>
          <DialogTrigger asChild>
            <Button>View Details</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>About This Component</DialogTitle>
              <DialogDescription>
                The Dialog component is built on top of Radix UI Dialog primitive,
                providing accessible modal dialogs with proper focus management.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-muted-foreground">
                Dialogs are used for focused interactions that require user
                attention, such as confirmations, form inputs, or detailed
                information displays.
              </p>
            </div>
            <div className="flex justify-end">
              <DialogClose asChild>
                <Button>Got it</Button>
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      </DemoSection>
    </>
  );
}
