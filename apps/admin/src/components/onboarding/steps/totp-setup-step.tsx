"use client";

import * as React from "react";
import { ArrowLeft, ChevronDown } from "lucide-react";

import { authClient } from "@repo/auth/client";
import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  CopyableField,
  Label,
  OtpInput,
  type OtpInputHandle,
  PasswordInput,
  StyledQrCode,
  toast,
} from "@repo/design-system";

type TotpPhase = "password-prompt" | "enabling" | "qr-code" | "verify";

interface TotpSetupStepProps {
  /** Password from Step 0 (empty string on resume flow) */
  password: string;
  onComplete: (backupCodes: string[]) => Promise<void>;
}

export function TotpSetupStep({ password, onComplete }: TotpSetupStepProps) {
  const hasPasswordFromStep0 = !!password;

  const [phase, setPhase] = React.useState<TotpPhase>(
    hasPasswordFromStep0 ? "enabling" : "password-prompt",
  );
  const [enteredPassword, setEnteredPassword] = React.useState("");
  const [totpUri, setTotpUri] = React.useState("");
  const [code, setCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const otpRef = React.useRef<OtpInputHandle>(null);

  const secretKey = React.useMemo(() => {
    try {
      const url = new URL(totpUri);
      return url.searchParams.get("secret") ?? "";
    } catch {
      return "";
    }
  }, [totpUri]);

  // Auto-enable TOTP when password is available from Step 0
  const enabledRef = React.useRef(false);
  React.useEffect(() => {
    if (phase !== "enabling" || enabledRef.current) return;
    enabledRef.current = true;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const pw = hasPasswordFromStep0 ? password : enteredPassword;
        const result = await authClient.twoFactor.enable({ password: pw });
        if (result.error) {
          setError("Failed to enable two-factor. Please re-enter your password.");
          setPhase("password-prompt");
          enabledRef.current = false;
          return;
        }
        const uri = (result.data as { totpURI?: string })?.totpURI ?? "";
        setTotpUri(uri);
        setPhase("qr-code");
      } catch {
        setError("Failed to enable two-factor authentication.");
        setPhase("password-prompt");
        enabledRef.current = false;
      } finally {
        setLoading(false);
      }
    })();
  }, [phase, hasPasswordFromStep0, password, enteredPassword]);

  const handlePasswordSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!enteredPassword) return;
    enabledRef.current = false;
    setPhase("enabling");
  };

  const handleVerify = async (codeToVerify?: string) => {
    const verifyCode = codeToVerify ?? code;
    if (verifyCode.length !== 6) return;
    setLoading(true);
    setError(null);

    try {
      const result = await authClient.twoFactor.verifyTotp({ code: verifyCode });
      if (result.error) {
        setError("Invalid verification code. Please try again.");
        return;
      }
      const data = result.data as { backupCodes?: string[] } | undefined;
      const backupCodes = data?.backupCodes ?? [];
      await onComplete(backupCodes);
    } catch {
      setError("Failed to verify code.");
    } finally {
      setLoading(false);
      window.requestAnimationFrame(() => otpRef.current?.focus());
    }
  };

  // Password prompt (resume flow)
  if (phase === "password-prompt") {
    return (
      <form className="space-y-4" onSubmit={handlePasswordSubmit}>
        <p className="text-sm text-muted-foreground">
          Enter your password to set up two-factor authentication.
        </p>
        <div className="space-y-2">
          <Label htmlFor="totp-password">Password</Label>
          <PasswordInput
            id="totp-password"
            value={enteredPassword}
            onChange={(event) => setEnteredPassword(event.target.value)}
            autoFocus
          />
        </div>
        {error ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        <Button className="w-full" type="submit" disabled={!enteredPassword || loading}>
          {loading ? "Setting up..." : "Continue"}
        </Button>
      </form>
    );
  }

  // Enabling state
  if (phase === "enabling") {
    return (
      <div className="space-y-4">
        <p className="text-center text-sm text-muted-foreground">
          Setting up two-factor authentication...
        </p>
      </div>
    );
  }

  // QR code display
  if (phase === "qr-code") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Scan this QR code with your authenticator app (Google Authenticator, 1Password, Authy, etc.).
        </p>
        {totpUri ? (
          <div className="flex justify-center">
            <StyledQrCode
              value={totpUri}
              size={200}
              moduleStyle="rounded"
              errorCorrection="Q"
              icon={
                <img src="/icon.svg" alt="" className="h-full w-full" />
              }
            />
          </div>
        ) : null}

        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className="h-4 w-4" />
            Manual setup key
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <CopyableField
              value={secretKey || totpUri}
              onCopied={() => toast.success("Copied setup key.")}
              onCopyError={() => toast.error("Failed to copy.")}
            />
          </CollapsibleContent>
        </Collapsible>

        <Button className="w-full" type="button" onClick={() => setPhase("verify")}>
          Continue to verification
        </Button>
      </div>
    );
  }

  // Verify code
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Enter the 6-digit code from your authenticator app.
      </p>
      <div className="space-y-2">
        <Label className="sr-only">Verification code</Label>
        <OtpInput
          ref={otpRef}
          value={code}
          onChange={setCode}
          autoSubmit
          onComplete={(completedCode) => handleVerify(completedCode)}
          disabled={loading}
          autoFocus
          aria-label="Verification code"
        />
      </div>
      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <Button
        className="w-full"
        type="button"
        onClick={() => handleVerify()}
        disabled={loading || code.length !== 6}
      >
        {loading ? "Verifying..." : "Verify"}
      </Button>
      <Button
        className="w-full"
        type="button"
        variant="ghost"
        onClick={() => setPhase("qr-code")}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to QR code
      </Button>
    </div>
  );
}
