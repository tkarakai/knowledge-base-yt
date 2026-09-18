"use client";

import * as React from "react";
import { CheckCircle2, XCircle } from "lucide-react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Progress,
} from "@repo/design-system";
import type { AdminUser } from "@/lib/admin-api";

type BatchResult = {
  user: AdminUser;
  success: boolean;
  error?: string;
};

type BatchActionDialogProps = {
  open: boolean;
  onClose: () => void;
  onCancel?: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  users: AdminUser[];
  action: (user: AdminUser) => Promise<void>;
  /** When true, disable the confirm button (e.g. no applicable users). */
  confirmDisabled?: boolean;
};

type Phase = "confirm" | "progress" | "results";

export function BatchActionDialog({
  open,
  onClose,
  onCancel,
  title,
  description,
  confirmLabel,
  destructive = false,
  users,
  action,
  confirmDisabled = false,
}: BatchActionDialogProps) {
  const [phase, setPhase] = React.useState<Phase>("confirm");
  const [processed, setProcessed] = React.useState(0);
  const [results, setResults] = React.useState<BatchResult[]>([]);

  // Reset state when dialog opens.
  React.useEffect(() => {
    if (open) {
      setPhase("confirm");
      setProcessed(0);
      setResults([]);
    }
  }, [open]);

  const handleConfirm = async () => {
    setPhase("progress");
    const batchResults: BatchResult[] = [];

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      try {
        await action(user);
        batchResults.push({ user, success: true });
      } catch (err) {
        batchResults.push({
          user,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
      setProcessed(i + 1);
      setResults([...batchResults]);
    }

    setPhase("results");
  };

  const successes = results.filter((r) => r.success).length;
  const failures = results.filter((r) => !r.success).length;
  const progressPercent = users.length > 0 ? (processed / users.length) * 100 : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          if (phase === "progress") return;
          if (phase === "results") onClose();
          else (onCancel ?? onClose)();
        }
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => {
          if (phase === "progress") e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (phase === "progress") e.preventDefault();
        }}
      >
        {phase === "confirm" && (
          <>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={onCancel ?? onClose}>
                Cancel
              </Button>
              <Button
                variant={destructive ? "destructive" : "default"}
                onClick={handleConfirm}
                disabled={confirmDisabled}
              >
                {confirmLabel}
              </Button>
            </div>
          </>
        )}

        {phase === "progress" && (
          <>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>
                Processing {processed} of {users.length}...
              </DialogDescription>
            </DialogHeader>
            <Progress value={progressPercent} className="mt-4" />
          </>
        )}

        {phase === "results" && (
          <>
            <DialogHeader>
              <DialogTitle>Results</DialogTitle>
              <DialogDescription>
                {successes > 0 && `${successes} succeeded`}
                {successes > 0 && failures > 0 && ", "}
                {failures > 0 && `${failures} failed`}
              </DialogDescription>
            </DialogHeader>
            {failures > 0 && (
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-md border p-3">
                {results
                  .filter((r) => !r.success)
                  .map((r) => (
                    <div
                      key={r.user.id}
                      className="flex items-start gap-2 text-sm"
                    >
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                      <span>
                        <span className="font-medium">{r.user.email}</span>
                        {r.error && (
                          <span className="text-muted-foreground">
                            {" "}— {r.error}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
              </div>
            )}
            {failures === 0 && successes > 0 && (
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                All operations completed successfully.
              </div>
            )}
            <div className="flex justify-end pt-4">
              <Button onClick={onClose}>Close</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
