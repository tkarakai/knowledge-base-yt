"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { api } from "@repo/backend";
import { authClient, formatAuthError, isConvexRateLimited, AUTH_RATE_LIMIT_MESSAGE } from "@repo/auth/client";
import { broadcastAuth } from "@/lib/auth-broadcast";

const PREFERRED_METHOD_KEY = "adminSignInPreferredMethod";

type PreferredMethod = "password" | "passkey";

function getStoredPreferredMethod(email: string): PreferredMethod | null {
  try {
    const stored = window.localStorage.getItem(PREFERRED_METHOD_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Record<string, string>;
    const method = parsed[email.trim().toLowerCase()];
    if (method === "password" || method === "passkey") return method;
    return null;
  } catch {
    return null;
  }
}

function setStoredPreferredMethod(email: string, method: PreferredMethod) {
  try {
    const stored = window.localStorage.getItem(PREFERRED_METHOD_KEY);
    const parsed = stored ? (JSON.parse(stored) as Record<string, string>) : {};
    parsed[email.trim().toLowerCase()] = method;
    window.localStorage.setItem(PREFERRED_METHOD_KEY, JSON.stringify(parsed));
  } catch {
    // best-effort
  }
}
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  OtpInput,
  type OtpInputHandle,
  PasskeyUnsupportedAlert,
  PasswordInput,
  Separator,
  SlideTransition,
  usePasskeySupport,
} from "@repo/design-system";

type PasskeyPolicy = "disabled" | "optional" | "required";
type SignInStep = 0 | 1 | 2; // 0=email, 1=auth method, 2=TOTP

function toPasskeyPolicy(value: unknown): PasskeyPolicy {
  return value === "disabled" || value === "required" ? value : "optional";
}

function toBoolean(value: unknown, defaultValue: boolean): boolean {
  return typeof value === "boolean" ? value : defaultValue;
}

export function AdminSignInForm() {
  const router = useRouter();
  const { supported: passkeySupported } = usePasskeySupport();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [step, setStep] = React.useState<SignInStep>(0);

  // Form fields
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  // 2FA challenge state
  const [totpCode, setTotpCode] = React.useState("");
  const [useBackupCode, setUseBackupCode] = React.useState(false);
  const [backupCode, setBackupCode] = React.useState("");
  const otpRef = React.useRef<OtpInputHandle>(null);

  // Preferred method from localStorage
  const [preferredMethod, setPreferredMethod] = React.useState<PreferredMethod | null>(null);
  React.useEffect(() => {
    if (email.trim()) {
      setPreferredMethod(getStoredPreferredMethod(email));
    } else {
      setPreferredMethod(null);
    }
  }, [email]);

  // Policy settings
  const userMfaRequired = useQuery(api.appSettings.getPublic, {
    key: "userMfaRequired",
  });
  const adminMfaRequired = useQuery(api.appSettings.getPublic, {
    key: "adminMfaRequired",
  });
  const userPasskeyPolicy = useQuery(api.appSettings.getPublic, {
    key: "userPasskeyPolicy",
  });
  const adminPasskeyPolicy = useQuery(api.appSettings.getPublic, {
    key: "adminPasskeyPolicy",
  });


  const getRolePolicies = React.useCallback((role: unknown) => {
    const isAdmin = role === "admin";
    return {
      mfaRequired: toBoolean(isAdmin ? adminMfaRequired : userMfaRequired, false),
      passkeyPolicy: toPasskeyPolicy(
        isAdmin ? adminPasskeyPolicy : userPasskeyPolicy,
      ),
    };
  }, [adminMfaRequired, adminPasskeyPolicy, userMfaRequired, userPasskeyPolicy]);

  const enforcePostSignInPolicies = React.useCallback(async ({
    usedPasskey,
  }: {
    usedPasskey: boolean;
  }): Promise<boolean> => {
    const sessionResult = await authClient.getSession();
    const sessionUser = sessionResult.data?.user as Record<string, unknown> | undefined;
    if (!sessionUser) return false;

    const policies = getRolePolicies(sessionUser.role);
    if (usedPasskey && policies.passkeyPolicy === "disabled") {
      await authClient.signOut();
      setError("Passkey sign-in is disabled for your account.");
      return true;
    }

    if (policies.mfaRequired && sessionUser.twoFactorEnabled !== true) {
      router.push("/settings?tab=security&enforce=mfa");
      return true;
    }

    if (policies.passkeyPolicy === "required") {
      const passkeyResult = await (authClient as unknown as {
        passkey?: {
          listUserPasskeys?: () => Promise<{ data?: unknown[]; error?: unknown }>;
        };
      }).passkey?.listUserPasskeys?.();

      if (!passkeyResult || passkeyResult.error) {
        await authClient.signOut();
        setError("Unable to verify passkey policy. Please sign in with passkey.");
        return true;
      }

      const passkeys = passkeyResult.data ?? [];
      if (passkeys.length > 0 && !usedPasskey) {
        await authClient.signOut();
        setError("Passkey sign-in is required for your account.");
        return true;
      }

      if (passkeys.length === 0) {
        router.push("/settings?tab=security&enforce=passkey");
        return true;
      }
    }

    return false;
  }, [getRolePolicies, router]);

  // Step 0 → Step 1: Continue from email
  const handleEmailContinue = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setStep(1);
  };

  // Step 1: Password sign-in
  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const result = await authClient.signIn.email({
        email,
        password,
        callbackURL: "/dashboard",
        rememberMe: true,
      });

      if (result.error) {
        setError(formatAuthError(result.error, "Invalid email or password"));
      } else if (
        (result.data as { twoFactorRedirect?: boolean })?.twoFactorRedirect
      ) {
        setStep(2);
      } else {
        if (await enforcePostSignInPolicies({ usedPasskey: false })) return;
        setStoredPreferredMethod(email, "password");
        broadcastAuth();
        router.push("/dashboard");
      }
    } catch (err) {
      setError(isConvexRateLimited(err) ? AUTH_RATE_LIMIT_MESSAGE : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  };

  // Step 1: Passkey sign-in
  const handlePasskeySignIn = async () => {
    if (!email.trim()) return;
    setError(null);
    setPending(true);
    try {
      const result = await (authClient as unknown as {
        signIn: {
          passkey: (args: {
            email: string;
            callbackURL: string;
          }) => Promise<{ error?: { message?: string } }>;
        };
      }).signIn.passkey({
        email: email.trim(),
        callbackURL: "/dashboard",
      });

      if (result.error) {
        setError(result.error.message ?? "Passkey sign-in failed");
        return;
      }

      if (await enforcePostSignInPolicies({ usedPasskey: true })) return;
      setStoredPreferredMethod(email, "passkey");
      broadcastAuth();
      router.push("/dashboard");
    } catch (err) {
      setError(isConvexRateLimited(err) ? AUTH_RATE_LIMIT_MESSAGE : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  };

  // Step 2: TOTP verification
  const handleTotpSubmit = async (codeOverride?: string) => {
    const effectiveCode = codeOverride ?? totpCode;
    if (useBackupCode && !backupCode.trim()) return;
    if (!useBackupCode && effectiveCode.length !== 6) return;

    setError(null);
    setPending(true);

    try {
      if (useBackupCode) {
        const result = await authClient.twoFactor.verifyBackupCode({
          code: backupCode.trim(),
        });
        if (result.error) {
          setError(formatAuthError(result.error, "Invalid backup code"));
        } else {
          if (await enforcePostSignInPolicies({ usedPasskey: false })) return;
          setStoredPreferredMethod(email, "password");
          broadcastAuth();
          router.push("/dashboard");
        }
      } else {
        const result = await authClient.twoFactor.verifyTotp({ code: effectiveCode });
        if (result.error) {
          setError(formatAuthError(result.error, "Invalid verification code"));
        } else {
          if (await enforcePostSignInPolicies({ usedPasskey: false })) return;
          setStoredPreferredMethod(email, "password");
          broadcastAuth();
          router.push("/dashboard");
        }
      }
    } catch (err) {
      setError(isConvexRateLimited(err) ? AUTH_RATE_LIMIT_MESSAGE : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
      if (!useBackupCode) window.requestAnimationFrame(() => otpRef.current?.focus());
    }
  };

  const goBack = () => {
    setError(null);
    if (step === 2) {
      setTotpCode("");
      setBackupCode("");
      setUseBackupCode(false);
      setStep(1);
    } else if (step === 1) {
      setPassword("");
      setStep(0);
    }
  };

  const effectivePreferred =
    passkeySupported === false && preferredMethod === "passkey"
      ? "password"
      : preferredMethod;

  const stepTitle = [
    "Sign in",
    "Sign in",
    useBackupCode ? "Backup code" : "Two-factor authentication",
  ][step];

  const stepDescription = [
    "Admin access only. Enter your email to continue.",
    `Signing in as ${email}`,
    useBackupCode
      ? "Enter one of your backup codes to sign in."
      : "Enter the 6-digit code from your authenticator app.",
  ][step];

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">{stepTitle}</CardTitle>
        <CardDescription>{stepDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <SlideTransition stepIndex={step}>
          {step === 0 ? (
            /* ── Step 0: Email ── */
            <form className="space-y-4" onSubmit={handleEmailContinue}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoFocus
                />
              </div>
              {error ? (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              ) : null}
              <Button className="w-full" type="submit" disabled={!email.trim()}>
                Continue
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <Separator className="flex-1 min-w-0 w-auto" />
                <span>Secure email + password</span>
                <Separator className="flex-1 min-w-0 w-auto" />
              </div>
            </form>
          ) : step === 1 ? (
            /* ── Step 1: Auth Method ── */
            effectivePreferred === "passkey" ? (
              /* Passkey-primary layout */
              <div className="space-y-4">
                <Button
                  className="w-full"
                  type="button"
                  onClick={handlePasskeySignIn}
                  disabled={pending}
                >
                  {pending ? "Authenticating..." : "Sign in with passkey"}
                </Button>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">or</span>
                  </div>
                </div>
                <form className="space-y-4" onSubmit={handlePasswordSubmit}>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                        onClick={() => {
                          window.sessionStorage.setItem("forgot-password-email", email);
                          router.push("/forgot-password");
                        }}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <PasswordInput
                      id="password"
                      name="password"
                      placeholder="Your password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                  </div>
                  {error ? (
                    <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {error}
                    </div>
                  ) : null}
                  <Button className="w-full" type="submit" variant="outline" disabled={pending}>
                    {pending ? "Signing in..." : "Sign in with password"}
                  </Button>
                </form>
                <Button
                  className="w-full"
                  type="button"
                  variant="ghost"
                  onClick={goBack}
                  disabled={pending}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              </div>
            ) : (
              /* Password-primary layout (default) */
              <form className="space-y-4" onSubmit={handlePasswordSubmit}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                      onClick={() => {
                        window.sessionStorage.setItem("forgot-password-email", email);
                        router.push("/forgot-password");
                      }}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <PasswordInput
                    id="password"
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
                  {pending ? "Signing in..." : "Sign in"}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
                {passkeySupported !== false ? (
                  <>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <Separator className="flex-1 min-w-0 w-auto" />
                      <span>OR</span>
                      <Separator className="flex-1 min-w-0 w-auto" />
                    </div>
                    <Button type="button" variant="ghost" className="w-full" onClick={handlePasskeySignIn} disabled={pending}>
                      Sign in with passkey
                    </Button>
                  </>
                ) : (
                  <PasskeyUnsupportedAlert />
                )}
                <Button
                  className="w-full"
                  type="button"
                  variant="ghost"
                  onClick={goBack}
                  disabled={pending}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              </form>
            )
          ) : (
            /* ── Step 2: TOTP ── */
            <div className="space-y-4">
              {useBackupCode ? (
                <div className="space-y-2">
                  <Label htmlFor="backup-code">Backup code</Label>
                  <Input
                    id="backup-code"
                    name="backup-code"
                    type="text"
                    placeholder="Enter backup code"
                    value={backupCode}
                    onChange={(event) => setBackupCode(event.target.value)}
                    autoFocus
                    autoComplete="off"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="sr-only">Verification code</Label>
                  <OtpInput
                    ref={otpRef}
                    value={totpCode}
                    onChange={setTotpCode}
                    autoSubmit
                    onComplete={(completedCode) => handleTotpSubmit(completedCode)}
                    disabled={pending}
                    autoFocus
                    aria-label="Verification code"
                  />
                </div>
              )}
              {error ? (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              ) : null}
              <Button
                className="w-full"
                type="button"
                onClick={() => handleTotpSubmit()}
                disabled={pending || (useBackupCode ? !backupCode.trim() : totpCode.length !== 6)}
              >
                {pending ? "Verifying..." : "Verify"}
              </Button>
              <button
                type="button"
                className="w-full text-center text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                onClick={() => {
                  setUseBackupCode(!useBackupCode);
                  setError(null);
                  setTotpCode("");
                  setBackupCode("");
                }}
              >
                {useBackupCode ? "Use authenticator app instead" : "Use a backup code instead"}
              </button>
              <Button
                className="w-full"
                type="button"
                variant="ghost"
                onClick={goBack}
                disabled={pending}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </div>
          )}
        </SlideTransition>
      </CardContent>
    </Card>
  );
}
