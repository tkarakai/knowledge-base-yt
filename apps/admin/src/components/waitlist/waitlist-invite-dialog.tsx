"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
} from "@repo/design-system";

type WaitlistInviteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: (emails: string[]) => Promise<void>;
};

function parseEmails(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[,\n]/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

export function WaitlistInviteDialog({
  open,
  onOpenChange,
  onInvite,
}: WaitlistInviteDialogProps) {
  const [value, setValue] = React.useState("");
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setValue("");
      setPending(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    const emails = parseEmails(value);
    if (emails.length === 0) {
      toast.error("Enter at least one email address.");
      return;
    }

    setPending(true);
    try {
      await onInvite(emails);
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to send invitations."
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (pending) return;
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite to Waitlist</DialogTitle>
          <DialogDescription>
            Send invitation emails and add entries immediately in invited state.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 pt-2">
          <Label htmlFor="invite-emails">Email addresses</Label>
          <Textarea
            id="invite-emails"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="alex@example.com, sam@example.com"
            rows={5}
            disabled={pending}
          />
          <p className="text-xs text-muted-foreground">
            Use a comma-separated list of email addresses.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending ? "Inviting..." : "Invite"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
