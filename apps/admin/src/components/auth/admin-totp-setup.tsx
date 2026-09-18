"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { authClient, formatAuthError } from "@repo/auth/client";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  PasswordInput,
} from "@repo/design-system";

type Step = "password" | "uri" | "verify" | "backup";

export function AdminTotpSetup() {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("password");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Step 1
  const [password, setPassword] = React.useState("");

  // Step 2
  const [totpUri, setTotpUri] = React.useState("");

  // Step 3
  const [code, setCode] = React.useState("");

  // Step 4
  const [backupCodes, setBackupCodes] = React.useState<string[]>([]);

  const handleEnableTotp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const result = await authClient.twoFactor.enable({ password });

      if (result.error) {
        setError(formatAuthError(result.error, "Failed to enable 2FA."));
      } else {
        setTotpUri(result.data?.totpURI ?? "");
        setBackupCodes(result.data?.backupCodes ?? []);
        setStep("uri");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  };

  const handleVerifyCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const result = await authClient.twoFactor.verifyTotp({ code });

      if (result.error) {
        setError(formatAuthError(result.error, "Invalid code. Please try again."));
      } else {
        setStep("backup");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  };

  if (step === "password") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">
            Enable two-factor authentication
          </CardTitle>
          <CardDescription>
            Enter your password to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleEnableTotp}>
            <div className="space-y-2">
              <Label htmlFor="2fa-password">Password</Label>
              <PasswordInput
                id="2fa-password"
                name="password"
                placeholder="Your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoFocus
              />
            </div>
            {error ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}
            <Button className="w-full" type="submit" disabled={pending}>
              {pending ? "Enabling..." : "Enable 2FA"}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  if (step === "uri") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">
            Add to authenticator app
          </CardTitle>
          <CardDescription>
            Copy the URI below and add it to your authenticator app (Google
            Authenticator, Authy, etc.), then enter the 6-digit code to verify.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>TOTP URI</Label>
            <div className="rounded-md border bg-muted p-3 text-xs font-mono break-all select-all">
              {totpUri}
            </div>
          </div>
          {process.env.NODE_ENV === "development" ? (
            <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              Dev mode: Copy this URI into your authenticator app or use a TOTP
              tool to generate a code.
            </div>
          ) : null}
          <Button className="w-full" onClick={() => setStep("verify")}>
            I&#39;ve added it — enter code
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === "verify") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">
            Verify authenticator
          </CardTitle>
          <CardDescription>
            Enter the 6-digit code from your authenticator app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleVerifyCode}>
            <div className="space-y-2">
              <Label htmlFor="totp-code">Verification code</Label>
              <Input
                id="totp-code"
                name="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                required
                autoFocus
                autoComplete="one-time-code"
                className="text-center text-lg tracking-widest font-mono"
              />
            </div>
            {error ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}
            <Button className="w-full" type="submit" disabled={pending}>
              {pending ? "Verifying..." : "Verify"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setError(null);
                setCode("");
                setStep("uri");
              }}
            >
              Back
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  // step === "backup"
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">
          Save your backup codes
        </CardTitle>
        <CardDescription>
          Store these codes in a safe place. You can use them to sign in if you
          lose access to your authenticator app. Each code can only be used once.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted p-4">
          {backupCodes.map((backupCode) => (
            <code key={backupCode} className="text-sm font-mono">
              {backupCode}
            </code>
          ))}
        </div>
        <Button
          className="w-full"
          onClick={() => router.push("/dashboard")}
        >
          Continue to dashboard
        </Button>
      </CardContent>
    </Card>
  );
}
