"use client";

import * as React from "react";
import { Check, KeyRound } from "lucide-react";

import { authClient } from "@repo/auth/client";
import { Button, Input, Label, PasskeyUnsupportedAlert, toast, usePasskeySupport } from "@repo/design-system";

interface PasskeyStepProps {
  onComplete: (added: boolean) => Promise<void>;
}

export function PasskeyStep({ onComplete }: PasskeyStepProps) {
  const [name, setName] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [added, setAdded] = React.useState(false);
  const [completing, setCompleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { supported } = usePasskeySupport();

  const handleAddPasskey = async () => {
    setAdding(true);
    setError(null);

    try {
      const result = await (authClient as unknown as {
        passkey?: {
          addPasskey?: (args: { name?: string }) => Promise<{
            error?: { message?: string };
          }>;
        };
      }).passkey?.addPasskey?.({ name: name.trim() || undefined });

      if (!result || result.error) {
        setError(result?.error?.message ?? "Failed to add passkey.");
        return;
      }

      setAdded(true);
      toast.success("Passkey added successfully.");
    } catch {
      setError("Failed to add passkey. You can skip this step and add one later.");
    } finally {
      setAdding(false);
    }
  };

  const handleComplete = async (passkeyAdded: boolean) => {
    setCompleting(true);
    try {
      await onComplete(passkeyAdded);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setCompleting(false);
    }
  };

  if (supported === null) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm text-muted-foreground">Checking passkey support...</p>
      </div>
    );
  }

  if (supported === false) {
    return (
      <div className="space-y-4">
        <PasskeyUnsupportedAlert />
        <Button className="w-full" type="button" onClick={() => handleComplete(false)} disabled={completing}>
          {completing ? "Completing setup..." : "Continue without passkey"}
        </Button>
      </div>
    );
  }

  if (added) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-md border border-green-500/50 bg-green-500/10 p-3">
          <Check className="h-5 w-5 text-green-600" />
          <p className="text-sm font-medium text-green-700 dark:text-green-400">
            Passkey added successfully
          </p>
        </div>
        <Button className="w-full" type="button" onClick={() => handleComplete(true)} disabled={completing}>
          {completing ? "Completing setup..." : "Complete setup"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <KeyRound className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Passkeys are two-factor by design — no separate 2FA needed. More secure and more convenient for daily use.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="passkey-name">Passkey label (optional)</Label>
        <Input
          id="passkey-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Work Laptop"
        />
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <Button className="w-full" type="button" onClick={handleAddPasskey} disabled={adding}>
        {adding ? "Adding passkey..." : "Add passkey"}
      </Button>

      <button
        type="button"
        className="w-full text-center text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
        onClick={() => handleComplete(false)}
        disabled={completing}
      >
        {completing ? "Completing..." : "Skip for now"}
      </button>
    </div>
  );
}
