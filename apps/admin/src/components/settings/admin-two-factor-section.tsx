"use client";

import * as React from "react";
import { ChevronDown, Copy, ShieldCheck, ShieldOff } from "lucide-react";

import { authClient } from "@repo/auth/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Input,
  Label,
  PasswordInput,
  Separator,
  toast,
} from "@repo/design-system";

const CONVEX_SITE_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
if (!CONVEX_SITE_URL) {
  throw new Error("Missing required environment variable: NEXT_PUBLIC_CONVEX_SITE_URL");
}

type Step =
  | "idle"
  | "password-enable"
  | "totp-uri"
  | "verify-code"
  | "backup-codes"
  | "password-disable"
  | "password-regenerate";

export function AdminTwoFactorSection() {
  const [step, setStep] = React.useState<Step>("idle");
  const [enabled, setEnabled] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [totpUri, setTotpUri] = React.useState("");
  const [code, setCode] = React.useState("");
  const [backupCodes, setBackupCodes] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [statusLoading, setStatusLoading] = React.useState(true);
  const [disableDialogOpen, setDisableDialogOpen] = React.useState(false);
  const [regenerateDialogOpen, setRegenerateDialogOpen] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const session = await authClient.getSession();
        const user = session.data?.user as Record<string, unknown> | undefined;
        setEnabled(user?.twoFactorEnabled === true);
      } catch {
        // ignore
      } finally {
        setStatusLoading(false);
      }
    })();
  }, []);

  const secretKey = React.useMemo(() => {
    try {
      const url = new URL(totpUri);
      return url.searchParams.get("secret") ?? "";
    } catch {
      return "";
    }
  }, [totpUri]);

  const handleEnable = async () => {
    if (!password) return;
    setLoading(true);
    try {
      const result = await authClient.twoFactor.enable({ password });
      if (result.error) {
        toast.error("Current password is incorrect.");
        return;
      }
      const uri = (result.data as { totpURI?: string })?.totpURI ?? "";
      setTotpUri(uri);
      setPassword("");
      setStep("totp-uri");
    } catch {
      toast.error("Failed to enable two-factor authentication.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    try {
      const result = await authClient.twoFactor.verifyTotp({ code });
      if (result.error) {
        toast.error("Invalid verification code.");
        return;
      }
      const data = result.data as { backupCodes?: string[] } | undefined;
      setBackupCodes(data?.backupCodes ?? []);
      setEnabled(true);
      setCode("");
      setStep("backup-codes");
    } catch {
      toast.error("Failed to verify code.");
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!password) return;
    setLoading(true);
    try {
      const result = await authClient.twoFactor.disable({ password });
      if (result.error) {
        toast.error("Current password is incorrect.");
        return;
      }
      setEnabled(false);
      setPassword("");
      setStep("idle");
      toast.success("Two-factor authentication disabled.");
    } catch {
      toast.error("Failed to disable two-factor authentication.");
    } finally {
      setLoading(false);
    }
  };

  const handleViewBackupCodes = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${CONVEX_SITE_URL}/api/two-factor/backup-codes`, {
        credentials: "include",
      });
      if (!response.ok) {
        toast.error("Failed to load backup codes.");
        return;
      }
      const data = (await response.json()) as { backupCodes?: string[] };
      setBackupCodes(data.backupCodes ?? []);
      setStep("backup-codes");
    } catch {
      toast.error("Failed to load backup codes.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateBackupCodes = async () => {
    if (!password) return;
    setLoading(true);
    try {
      const result = await authClient.twoFactor.generateBackupCodes({ password });
      if (result.error) {
        toast.error("Current password is incorrect.");
        return;
      }
      const data = result.data as { backupCodes?: string[] } | undefined;
      setBackupCodes(data?.backupCodes ?? []);
      setPassword("");
      setStep("backup-codes");
      toast.success("Backup codes regenerated.");
    } catch {
      toast.error("Failed to regenerate backup codes.");
    } finally {
      setLoading(false);
    }
  };

  if (statusLoading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (step === "idle") {
    return (
      <div className="space-y-4 max-w-md">
        <div className="flex items-center gap-3">
          {enabled ? (
            <ShieldCheck className="h-5 w-5 text-green-500" />
          ) : (
            <ShieldOff className="h-5 w-5 text-muted-foreground" />
          )}
          <div>
            <p className="text-sm font-medium">
              {enabled ? "Two-factor authentication is enabled" : "Two-factor authentication is not enabled"}
            </p>
            <p className="text-xs text-muted-foreground">
              Add an extra verification step to secure your admin account.
            </p>
          </div>
        </div>

        {enabled ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleViewBackupCodes} disabled={loading}>
                {loading ? "Loading..." : "View backup codes"}
              </Button>
              <Button variant="outline" onClick={() => setRegenerateDialogOpen(true)}>
                Regenerate backup codes
              </Button>
            </div>

            <Separator />

            <Button variant="outline" onClick={() => setDisableDialogOpen(true)}>
              Disable two-factor authentication
            </Button>

            <AlertDialog open={regenerateDialogOpen} onOpenChange={setRegenerateDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Regenerate backup codes?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This replaces your existing backup codes. Unused codes will stop working.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => setStep("password-regenerate")}>
                    Continue
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={disableDialogOpen} onOpenChange={setDisableDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Disable two-factor authentication?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You will only need your password to sign in.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => setStep("password-disable")}>
                    Continue
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : (
          <Button onClick={() => setStep("password-enable")}>Enable two-factor authentication</Button>
        )}
      </div>
    );
  }

  if (step === "password-enable") {
    return (
      <form
        className="space-y-4 max-w-md"
        onSubmit={(event) => {
          event.preventDefault();
          handleEnable();
        }}
      >
        <p className="text-sm text-muted-foreground">Enter your password to continue.</p>
        <div className="space-y-2">
          <Label htmlFor="admin-2fa-enable-password">Current password</Label>
          <PasswordInput
            id="admin-2fa-enable-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoFocus
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={loading || !password}>
            {loading ? "Enabling..." : "Enable"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setStep("idle");
              setPassword("");
            }}
          >
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  if (step === "totp-uri") {
    return (
      <div className="space-y-4 max-w-md">
        <p className="text-sm text-muted-foreground">
          Add this secret to your authenticator app, then verify with a 6-digit code.
        </p>
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className="h-4 w-4" />
            Manual setup key
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            <div className="rounded-md border bg-muted p-3 text-xs font-mono break-all">
              {secretKey || totpUri}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const clipboard = globalThis.navigator?.clipboard;
                  if (!clipboard) {
                    throw new Error("Clipboard API unavailable");
                  }
                  await clipboard.writeText(secretKey || totpUri);
                  toast.success("Copied setup key.");
                } catch {
                  toast.error("Failed to copy.");
                }
              }}
            >
              <Copy className="h-4 w-4" />
              Copy
            </Button>
          </CollapsibleContent>
        </Collapsible>
        <Button type="button" onClick={() => setStep("verify-code")}>
          Continue to verification
        </Button>
      </div>
    );
  }

  if (step === "verify-code") {
    return (
      <form
        className="space-y-4 max-w-md"
        onSubmit={(event) => {
          event.preventDefault();
          handleVerify();
        }}
      >
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code from your authenticator app.
        </p>
        <div className="space-y-2">
          <Label htmlFor="admin-2fa-code">Verification code</Label>
          <Input
            id="admin-2fa-code"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            autoFocus
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={loading || code.length !== 6}>
            {loading ? "Verifying..." : "Verify"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setStep("totp-uri")}>
            Back
          </Button>
        </div>
      </form>
    );
  }

  if (step === "password-disable" || step === "password-regenerate") {
    return (
      <form
        className="space-y-4 max-w-md"
        onSubmit={(event) => {
          event.preventDefault();
          if (step === "password-disable") {
            void handleDisable();
          } else {
            void handleRegenerateBackupCodes();
          }
        }}
      >
        <p className="text-sm text-muted-foreground">
          Enter your current password to continue.
        </p>
        <div className="space-y-2">
          <Label htmlFor="admin-2fa-action-password">Current password</Label>
          <PasswordInput
            id="admin-2fa-action-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoFocus
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={loading || !password}>
            {loading
              ? "Working..."
              : step === "password-disable"
              ? "Disable"
              : "Regenerate"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setPassword("");
              setStep("idle");
            }}
          >
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-4 max-w-md">
      <p className="text-sm font-medium">Backup codes</p>
      <p className="text-xs text-muted-foreground">
        Save these backup codes in a secure place. Each code can be used once.
      </p>
      <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted p-4">
        {backupCodes.map((backupCode) => (
          <code key={backupCode} className="text-sm font-mono">
            {backupCode}
          </code>
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="button" onClick={() => setStep("idle")}>
          Done
        </Button>
        <Button type="button" variant="outline" onClick={handleViewBackupCodes}>
          Refresh codes
        </Button>
      </div>
    </div>
  );
}
