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
  Input,
  Label,
  Textarea,
} from "@repo/design-system";
import type { AdminUser } from "@/lib/admin-api";
import { useEscapeConfirm } from "@/hooks/use-escape-confirm";

type BanDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: AdminUser[];
  pending?: boolean;
  onConfirm: (banReason: string, banExpiresIn?: number) => void;
};

export function BanDialog({
  open,
  onOpenChange,
  users,
  pending = false,
  onConfirm,
}: BanDialogProps) {
  const [reason, setReason] = React.useState("");
  const [expiresDate, setExpiresDate] = React.useState("");
  const [expiresTime, setExpiresTime] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setReason("");
      setExpiresDate("");
      setExpiresTime("");
    }
  }, [open]);

  const isSingle = users.length === 1;
  const title = isSingle
    ? `Ban ${users[0].email}`
    : `Ban ${users.length} users`;

  const canConfirm = reason.trim().length > 0 && !pending;

  // Minimum date: tomorrow (ban must be at least 24h from now).
  const minDate = React.useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  }, []);

  // Dirty state for escape confirmation.
  const isDirty = reason.trim().length > 0 || expiresDate !== "" || expiresTime !== "";
  const { showEscHint, onEscapeKeyDown } = useEscapeConfirm(isDirty);

  const handleConfirm = () => {
    let banExpiresIn: number | undefined;

    if (expiresDate) {
      const dateTimeStr = expiresTime
        ? `${expiresDate}T${expiresTime}:00Z`
        : `${expiresDate}T23:59:59Z`;
      const expiresMs = new Date(dateTimeStr).getTime();
      const nowMs = Date.now();
      banExpiresIn = Math.floor((expiresMs - nowMs) / 1000);

      if (banExpiresIn < 86400) {
        toast.error("Ban expiration must be at least 24 hours from now.");
        return;
      }
    }

    onConfirm(reason.trim(), banExpiresIn);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onEscapeKeyDown={onEscapeKeyDown}>
        {showEscHint && (
          <div className="absolute right-4 top-10 z-50 animate-in fade-in rounded bg-destructive px-2 py-1 text-xs text-destructive-foreground shadow-sm">
            Esc again to close
          </div>
        )}
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {isSingle
              ? "This user will be unable to sign in while banned."
              : `These ${users.length} users will be unable to sign in while banned.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="ban-reason">
              Ban reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="ban-reason"
              placeholder="Explain why this user is being banned..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              disabled={pending}
            />
          </div>

          <div className="space-y-2">
            <Label>Ban expiration (UTC, optional)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={expiresDate}
                min={minDate}
                onChange={(e) => {
                  setExpiresDate(e.target.value);
                  if (e.target.value && !expiresTime) {
                    setExpiresTime("23:59");
                  }
                }}
                disabled={pending}
                className="w-auto"
              />
              <Input
                type="time"
                value={expiresTime}
                onChange={(e) => setExpiresTime(e.target.value)}
                disabled={pending || !expiresDate}
                className="w-auto"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Leave empty for a permanent ban. Must be at least 24 hours from now.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {pending ? "Banning..." : isSingle ? "Ban user" : `Ban ${users.length} users`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
