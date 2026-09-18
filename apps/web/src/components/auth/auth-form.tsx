"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Mail, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "convex/react";

import { api } from "@repo/backend";
import { authClient, isAuthRateLimited, isConvexRateLimited } from "@repo/auth/client";
import { broadcastAuth } from "@/lib/auth-broadcast";
import { EMAIL_VERIFICATION_CALLBACK_URL } from "@/lib/auth-callbacks";
import { redirectWithUserLocale } from "@/lib/auth-locale";

const PREFERRED_METHOD_KEY = "signInPreferredMethod";

type PreferredMethod = "password" | "passkey" | "magicLink";

function getStoredPreferredMethod(email: string): PreferredMethod | null {
  try {
    const stored = window.localStorage.getItem(PREFERRED_METHOD_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Record<string, string>;
    const method = parsed[email.trim().toLowerCase()];
    if (method === "password" || method === "passkey" || method === "magicLink") return method;
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
import { PasswordStrengthMeter, useThrottledPasswordCheck } from "@repo/design-system/password-strength";

const LANDING_URL = process.env.NEXT_PUBLIC_LANDING_URL;
if (!LANDING_URL) {
  throw new Error("Missing required environment variable: NEXT_PUBLIC_LANDING_URL");
}

type AuthMode = "sign-in" | "sign-up";
type PasskeyPolicy = "disabled" | "optional" | "required";
type SignInStep = 0 | 1 | 2 | 3; // 0=email, 1=auth method, 2=TOTP, 3=magic link sent
type RolePolicies = {
  mfaRequired: boolean;
  passkeyPolicy: PasskeyPolicy;
  emailVerificationRequired: boolean;
  isResolved: boolean;
};

function toPasskeyPolicy(value: unknown): PasskeyPolicy {
  return value === "disabled" || value === "required" ? value : "optional";
}

function toBoolean(value: unknown, defaultValue: boolean): boolean {
  return typeof value === "boolean" ? value : defaultValue;
}

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const { supported: passkeySupported } = usePasskeySupport();
  const locale = useLocale();
  const t = useTranslations("auth");
  const tps = useTranslations("passwordStrength");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  // Throttled password for server-side strength evaluation (at most once per 500ms)
  const [throttledPassword, notifyResolved] = useThrottledPasswordCheck(password);
  const strengthResult = useQuery(
    api.passwordStrength.evaluate,
    throttledPassword
      ? { password: throttledPassword, email, role: "user" as const }
      : "skip",
  );
  React.useEffect(() => {
    if (strengthResult !== undefined) notifyResolved();
  }, [strengthResult, notifyResolved]);

  // Multi-step sign-in state
  const [step, setStep] = React.useState<SignInStep>(0);
  const [totpCode, setTotpCode] = React.useState("");
  const [useBackupCode, setUseBackupCode] = React.useState(false);
  const [backupCode, setBackupCode] = React.useState("");
  const otpRef = React.useRef<OtpInputHandle>(null);
  const [magicLinkSent, setMagicLinkSent] = React.useState(false);

  const isSignUp = mode === "sign-up";

  // Policy queries
  const userEmailVerifRequired = useQuery(api.appSettings.getPublic, {
    key: "userEmailVerificationRequired",
  });
  const adminEmailVerifRequired = useQuery(api.appSettings.getPublic, {
    key: "adminEmailVerificationRequired",
  });
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
  const magicLinkEnabled = useQuery(api.appSettings.getPublic, {
    key: "userMagicLinkEnabled",
  });

  // Preferred method from localStorage
  const [preferredMethod, setPreferredMethod] = React.useState<PreferredMethod | null>(null);
  React.useEffect(() => {
    if (!isSignUp && email.trim()) {
      setPreferredMethod(getStoredPreferredMethod(email));
    } else {
      setPreferredMethod(null);
    }
  }, [isSignUp, email]);

  const getRolePolicies = React.useCallback((role: unknown): RolePolicies => {
    const isAdmin = role === "admin";
    const selectedMfaRequired = isAdmin ? adminMfaRequired : userMfaRequired;
    const selectedPasskeyPolicy = isAdmin ? adminPasskeyPolicy : userPasskeyPolicy;
    const selectedEmailVerificationRequired = isAdmin
      ? adminEmailVerifRequired
      : userEmailVerifRequired;

    return {
      mfaRequired: toBoolean(selectedMfaRequired, false),
      passkeyPolicy: toPasskeyPolicy(selectedPasskeyPolicy),
      emailVerificationRequired: toBoolean(selectedEmailVerificationRequired, true),
      isResolved:
        selectedMfaRequired !== undefined &&
        selectedPasskeyPolicy !== undefined &&
        selectedEmailVerificationRequired !== undefined,
    };
  }, [
    adminEmailVerifRequired,
    adminMfaRequired,
    adminPasskeyPolicy,
    userEmailVerifRequired,
    userMfaRequired,
    userPasskeyPolicy,
  ]);

  const enforcePostSignInPolicies = React.useCallback(async ({
    usedPasskey,
  }: {
    usedPasskey: boolean;
  }): Promise<boolean> => {
    const sessionResult = await authClient.getSession();
    const sessionUser = sessionResult.data?.user as Record<string, unknown> | undefined;
    if (!sessionUser) return false;

    const policies = getRolePolicies(sessionUser.role);

    if (!policies.isResolved) {
      await authClient.signOut();
      setError("Unable to verify security policy. Please sign in again.");
      return true;
    }

    if (usedPasskey && policies.passkeyPolicy === "disabled") {
      await authClient.signOut();
      setError("Passkey sign-in is disabled for your account.");
      return true;
    }

    if (policies.mfaRequired && sessionUser.twoFactorEnabled !== true) {
      router.push("/dashboard/settings?tab=security&enforce=mfa");
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
        router.push("/dashboard/settings?tab=security&enforce=passkey");
        return true;
      }
    }

    return false;
  }, [getRolePolicies, router]);

  // ── Sign-in: Step 0 → Step 1 ──
  const handleEmailContinue = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setStep(1);
  };

  // ── Sign-in: Password submit (Step 1) ──
  const handlePasswordSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
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
        const errData = result.error as Record<string, unknown>;
        const code = errData.code as string | undefined;
        const message = (errData.message as string | undefined)?.toLowerCase() ?? "";
        const isUnverified =
          code === "EMAIL_NOT_VERIFIED" ||
          (message.includes("email") && message.includes("verif"));
        if (isUnverified) {
          router.push(`/verify-email?email=${encodeURIComponent(email)}`);
          return;
        }
        setError(isAuthRateLimited(result.error) ? t("errors.rateLimited") : t("errors.invalidCredentials"));
      } else if (
        (result.data as Record<string, unknown> | undefined)?.twoFactorRedirect
      ) {
        setStep(2);
      } else {
        if (await enforcePostSignInPolicies({ usedPasskey: false })) return;
        setStoredPreferredMethod(email, "password");
        broadcastAuth();
        await redirectWithUserLocale(router);
      }
    } catch (err) {
      setError(isConvexRateLimited(err) ? t("errors.rateLimited") : t("errors.generic"));
    } finally {
      setPending(false);
    }
  };

  // ── Sign-in: Passkey (Step 1) ──
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
      await redirectWithUserLocale(router);
    } catch (err) {
      setError(isConvexRateLimited(err) ? t("errors.rateLimited") : t("errors.generic"));
    } finally {
      setPending(false);
    }
  };

  // ── Sign-in: Magic link (Step 1) ──
  const handleMagicLinkSignIn = async () => {
    if (!email.trim()) return;
    setError(null);
    setPending(true);

    try {
      const result = await (authClient as unknown as {
        signIn: {
          magicLink: (args: {
            email: string;
            callbackURL: string;
          }) => Promise<{ error?: { message?: string } }>;
        };
      }).signIn.magicLink({
        email: email.trim(),
        callbackURL: "/dashboard",
      });

      if (result.error) {
        setError(result.error.message ?? "Failed to send magic link");
        return;
      }

      setMagicLinkSent(true);
      setStep(3);
      // Update preferred method for next time
      // (will be best-effort after they click the link and get a session)
    } catch (err) {
      setError(isConvexRateLimited(err) ? t("errors.rateLimited") : t("errors.generic"));
    } finally {
      setPending(false);
    }
  };

  // ── Sign-in: TOTP verification (Step 2) ──
  const handleTwoFactorVerify = async (codeOverride?: string) => {
    const effectiveCode = codeOverride ?? totpCode;
    if (useBackupCode && !backupCode.trim()) return;
    if (!useBackupCode && (!effectiveCode || effectiveCode.length !== 6)) return;

    setError(null);
    setPending(true);

    try {
      if (useBackupCode) {
        const result = await authClient.twoFactor.verifyBackupCode({
          code: backupCode.trim(),
        });
        if (result.error) {
          setError(t("twoFactorVerify.invalidCode"));
        } else {
          if (await enforcePostSignInPolicies({ usedPasskey: false })) return;
          setStoredPreferredMethod(email, "password");
          broadcastAuth();
          await redirectWithUserLocale(router);
        }
      } else {
        const result = await authClient.twoFactor.verifyTotp({
          code: effectiveCode,
        });
        if (result.error) {
          setError(t("twoFactorVerify.invalidCode"));
        } else {
          if (await enforcePostSignInPolicies({ usedPasskey: false })) return;
          setStoredPreferredMethod(email, "password");
          broadcastAuth();
          await redirectWithUserLocale(router);
        }
      }
    } catch (err) {
      setError(isConvexRateLimited(err) ? t("errors.rateLimited") : t("errors.generic"));
    } finally {
      setPending(false);
      if (!useBackupCode) window.requestAnimationFrame(() => otpRef.current?.focus());
    }
  };

  // ── Sign-up (unchanged single-form flow) ──
  const handleSignUpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t("errors.passwordMismatch"));
      return;
    }

    if (!strengthResult?.valid) {
      setError(tps("strengthRequirement"));
      return;
    }

    setPending(true);

    try {
      const result = await authClient.signUp.email({
        name,
        email,
        password,
        callbackURL: EMAIL_VERIFICATION_CALLBACK_URL,
      });

      if (result.error) {
        if (isAuthRateLimited(result.error)) {
          setError(t("errors.rateLimited"));
        } else if (result.error.message?.toLowerCase().includes("compromised")) {
          setError(t("errors.passwordCompromised"));
        } else {
          setError(t("errors.generic"));
        }
      } else {
        const data = result.data as Record<string, unknown> | undefined;
        const user = data?.user as Record<string, unknown> | undefined;
        const role = user?.role;
        const policies = getRolePolicies(role);
        if (user && !user.emailVerified && policies.emailVerificationRequired) {
          router.push("/verify-email");
          return;
        }
        broadcastAuth();
        await redirectWithUserLocale(router);
      }
    } catch (err) {
      setError(isConvexRateLimited(err) ? t("errors.rateLimited") : t("errors.generic"));
    } finally {
      setPending(false);
    }
  };

  const goBack = () => {
    setError(null);
    if (step === 3) {
      setMagicLinkSent(false);
      setStep(1);
    } else if (step === 2) {
      setTotpCode("");
      setBackupCode("");
      setUseBackupCode(false);
      setStep(1);
    } else if (step === 1) {
      setPassword("");
      setMagicLinkSent(false);
      setStep(0);
    }
  };

  const isMagicLinkAvailable = magicLinkEnabled === true;
  const effectivePreferred =
    passkeySupported === false && preferredMethod === "passkey"
      ? isMagicLinkAvailable
        ? "magicLink"
        : "password"
      : preferredMethod;

  // ── Sign-up form (unchanged) ──
  if (isSignUp) {
    return (
      <Card className="w-full max-w-md border-border/60 bg-card/80 shadow-xl shadow-primary/5">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            {t("badge")}
          </div>
          <CardTitle className="text-2xl font-semibold">
            {t("signUp.title")}
          </CardTitle>
          <CardDescription>{t("signUp.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSignUpSubmit}>
            <div className="space-y-2">
              <Label htmlFor="name">{t("fields.name")}</Label>
              <Input
                id="name"
                name="name"
                placeholder={t("fields.namePlaceholder")}
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("fields.email")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder={t("fields.emailPlaceholder")}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("fields.password")}</Label>
              <PasswordInput
                id="password"
                name="password"
                placeholder={t("fields.passwordSignUpPlaceholder")}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={12}
              />
              <PasswordStrengthMeter result={strengthResult} password={password} t={tps} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">{t("fields.confirmPassword")}</Label>
              <PasswordInput
                id="confirm-password"
                name="confirm-password"
                placeholder={t("fields.confirmPasswordPlaceholder")}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                minLength={12}
              />
            </div>
            {error ? (
              <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
                {error}
              </div>
            ) : null}
            <Button className="w-full" type="submit" disabled={pending}>
              {pending ? t("working") : t("signUp.cta")}
              <ArrowRight className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Separator className="flex-1 min-w-0 w-auto" />
              <span>{t("footer")}</span>
              <Separator className="flex-1 min-w-0 w-auto" />
            </div>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => router.push("/sign-in")}
            >
              {t("signUp.switchPrompt")}{" "}
              <span className="underline">{t("signUp.switchLink")}</span>
            </Button>
            <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
              {t("legal.prefix")}{" "}
              <a
                href={`${LANDING_URL}/${locale}/terms`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                {t("legal.termsOfService")}
              </a>{" "}
              {t("legal.and")}{" "}
              <a
                href={`${LANDING_URL}/${locale}/privacy`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                {t("legal.privacyPolicy")}
              </a>
              .
            </p>
          </form>
        </CardContent>
      </Card>
    );
  }

  // ── Multi-step sign-in ──

  const stepTitle = step === 2
    ? (useBackupCode ? t("twoFactorVerify.backupCodeTitle") : t("twoFactorVerify.title"))
    : step === 3
      ? t("multiStep.magicLinkStep.sent")
      : t("multiStep.emailStep.title");

  const stepDescription = step === 0
    ? t("multiStep.emailStep.description")
    : step === 1
      ? t("multiStep.authStep.signingInAs", { email })
      : step === 3
        ? t("multiStep.magicLinkStep.sentDescription", { email })
        : (useBackupCode ? t("twoFactorVerify.backupCodeDescription") : t("twoFactorVerify.description"));

  return (
    <Card className="w-full max-w-md border-border/60 bg-card/80 shadow-xl shadow-primary/5">
      <CardHeader className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          <Sparkles className="h-4 w-4" />
          {t("badge")}
        </div>
        <CardTitle className="text-2xl font-semibold">{stepTitle}</CardTitle>
        <CardDescription>{stepDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <SlideTransition stepIndex={step}>
          {step === 0 ? (
            /* ── Step 0: Email ── */
            <form className="space-y-4" onSubmit={handleEmailContinue}>
              <div className="space-y-2">
                <Label htmlFor="email">{t("fields.email")}</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder={t("fields.emailPlaceholder")}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoFocus
                />
              </div>
              {error ? (
                <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
                  {error}
                </div>
              ) : null}
              <Button className="w-full" type="submit" disabled={!email.trim()}>
                {t("multiStep.emailStep.continue")}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <Separator className="flex-1 min-w-0 w-auto" />
                <span>{t("footer")}</span>
                <Separator className="flex-1 min-w-0 w-auto" />
              </div>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => router.push("/sign-up")}
              >
                {t("signIn.switchPrompt")}{" "}
                <span className="underline">{t("signIn.switchLink")}</span>
              </Button>
              <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
                {t("legal.prefix")}{" "}
                <a
                  href={`${LANDING_URL}/${locale}/terms`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  {t("legal.termsOfService")}
                </a>{" "}
                {t("legal.and")}{" "}
                <a
                  href={`${LANDING_URL}/${locale}/privacy`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  {t("legal.privacyPolicy")}
                </a>
                .
              </p>
            </form>
          ) : step === 1 ? (
            /* ── Step 1: Auth Method (adaptive) ── */
            effectivePreferred === "passkey" ? (
              /* Passkey-primary layout */
              <div className="space-y-4">
                <Button
                  className="w-full"
                  type="button"
                  onClick={handlePasskeySignIn}
                  disabled={pending}
                >
                  {pending ? t("working") : t("multiStep.authStep.signInWithPasskey")}
                </Button>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">{t("multiStep.authStep.or")}</span>
                  </div>
                </div>
                <form className="space-y-4" onSubmit={handlePasswordSignIn}>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">{t("fields.password")}</Label>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                        onClick={() => {
                          window.sessionStorage.setItem("forgot-password-email", email);
                          router.push("/forgot-password");
                        }}
                      >
                        {t("multiStep.authStep.forgotPassword")}
                      </button>
                    </div>
                    <PasswordInput
                      id="password"
                      name="password"
                      placeholder={t("fields.passwordPlaceholder")}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                  </div>
                  {error ? (
                    <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
                      {error}
                    </div>
                  ) : null}
                  <Button className="w-full" type="submit" variant="outline" disabled={pending}>
                    {pending ? t("working") : t("multiStep.authStep.signInWithPassword")}
                  </Button>
                </form>
                {isMagicLinkAvailable ? (
                  <button
                    type="button"
                    className="w-full text-center text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                    onClick={handleMagicLinkSignIn}
                    disabled={pending}
                  >
                    {t("multiStep.authStep.signInWithMagicLink")}
                  </button>
                ) : null}
                <Button
                  className="w-full"
                  type="button"
                  variant="ghost"
                  onClick={goBack}
                  disabled={pending}
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t("multiStep.back")}
                </Button>
              </div>
            ) : effectivePreferred === "magicLink" && isMagicLinkAvailable ? (
              /* Magic link-primary layout */
              <MagicLinkPrimaryStep
                email={email}
                magicLinkSent={magicLinkSent}
                pending={pending}
                error={error}
                password={password}
                passkeySupported={passkeySupported}
                onSendMagicLink={handleMagicLinkSignIn}
                onPasswordChange={setPassword}
                onPasswordSubmit={handlePasswordSignIn}
                onPasskeySignIn={handlePasskeySignIn}
                onBack={goBack}
                onForgotPassword={() => {
                  window.sessionStorage.setItem("forgot-password-email", email);
                  router.push("/forgot-password");
                }}
                t={t}
              />
            ) : (
              /* Password-primary layout (default) */
              <form className="space-y-4" onSubmit={handlePasswordSignIn}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">{t("fields.password")}</Label>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                      onClick={() => {
                          window.sessionStorage.setItem("forgot-password-email", email);
                          router.push("/forgot-password");
                        }}
                    >
                      {t("multiStep.authStep.forgotPassword")}
                    </button>
                  </div>
                  <PasswordInput
                    id="password"
                    name="password"
                    placeholder={t("fields.passwordPlaceholder")}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    autoFocus
                  />
                </div>
                {error ? (
                  <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
                    {error}
                  </div>
                ) : null}
                <Button className="w-full" type="submit" disabled={pending}>
                  {pending ? t("working") : t("signIn.cta")}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <Separator className="flex-1 min-w-0 w-auto" />
                  <span>{t("multiStep.authStep.or")}</span>
                  <Separator className="flex-1 min-w-0 w-auto" />
                </div>
                {passkeySupported !== false ? (
                  <Button type="button" variant="ghost" className="w-full" onClick={handlePasskeySignIn} disabled={pending}>
                    {t("multiStep.authStep.signInWithPasskey")}
                  </Button>
                ) : (
                  <PasskeyUnsupportedAlert />
                )}
                {isMagicLinkAvailable ? (
                  <>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <Separator className="flex-1 min-w-0 w-auto" />
                      <span>{t("multiStep.authStep.or")}</span>
                      <Separator className="flex-1 min-w-0 w-auto" />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={handleMagicLinkSignIn}
                      disabled={pending}
                    >
                      {t("multiStep.authStep.signInWithMagicLink")}
                    </Button>
                  </>
                ) : null}
                <Button
                  className="w-full"
                  type="button"
                  variant="ghost"
                  onClick={goBack}
                  disabled={pending}
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t("multiStep.back")}
                </Button>
              </form>
            )
          ) : step === 3 ? (
            /* ── Step 3: Magic link sent ── */
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
              </div>
              {error ? (
                <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
                  {error}
                </div>
              ) : null}
              <Button
                className="w-full"
                variant="outline"
                onClick={handleMagicLinkSignIn}
                disabled={pending}
              >
                {t("multiStep.magicLinkStep.resend")}
              </Button>
              <Button
                className="w-full"
                type="button"
                variant="ghost"
                onClick={goBack}
                disabled={pending}
              >
                <ArrowLeft className="h-4 w-4" />
                {t("multiStep.back")}
              </Button>
            </div>
          ) : (
            /* ── Step 2: TOTP ── */
            <div className="space-y-4">
              {useBackupCode ? (
                <div className="space-y-2">
                  <Label htmlFor="backup-code">{t("twoFactorVerify.backupCodeTitle")}</Label>
                  <Input
                    id="backup-code"
                    placeholder={t("twoFactorVerify.backupCodePlaceholder")}
                    value={backupCode}
                    onChange={(e) => setBackupCode(e.target.value)}
                    autoFocus
                    autoComplete="off"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="sr-only">{t("twoFactorVerify.title")}</Label>
                  <OtpInput
                    ref={otpRef}
                    value={totpCode}
                    onChange={setTotpCode}
                    autoSubmit
                    onComplete={(completedCode) => handleTwoFactorVerify(completedCode)}
                    disabled={pending}
                    autoFocus
                    aria-label={t("twoFactorVerify.title")}
                  />
                </div>
              )}
              {error ? (
                <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
                  {error}
                </div>
              ) : null}
              <Button
                className="w-full"
                type="button"
                onClick={() => handleTwoFactorVerify()}
                disabled={pending || (useBackupCode ? !backupCode.trim() : totpCode.length !== 6)}
              >
                {pending ? t("working") : t("twoFactorVerify.cta")}
                <ArrowRight className="h-4 w-4" />
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
                {useBackupCode ? t("twoFactorVerify.useAuthenticator") : t("twoFactorVerify.useBackupCode")}
              </button>
              <Button
                className="w-full"
                type="button"
                variant="ghost"
                onClick={goBack}
                disabled={pending}
              >
                <ArrowLeft className="h-4 w-4" />
                {t("multiStep.back")}
              </Button>
            </div>
          )}
        </SlideTransition>
      </CardContent>
    </Card>
  );
}

// ── Magic Link Primary Sub-Component ──

function MagicLinkPrimaryStep({
  email,
  magicLinkSent,
  pending,
  error,
  password,
  passkeySupported,
  onSendMagicLink,
  onPasswordChange,
  onPasswordSubmit,
  onPasskeySignIn,
  onBack,
  onForgotPassword,
  t,
}: {
  email: string;
  magicLinkSent: boolean;
  pending: boolean;
  error: string | null;
  password: string;
  passkeySupported: boolean | null;
  onSendMagicLink: () => void;
  onPasswordChange: (value: string) => void;
  onPasswordSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onPasskeySignIn: () => void;
  onBack: () => void;
  onForgotPassword: () => void;
  t: ReturnType<typeof useTranslations<"auth">>;
}) {
  const [showPasswordFallback, setShowPasswordFallback] = React.useState(false);

  // Auto-send magic link on mount
  const hasSentRef = React.useRef(false);
  React.useEffect(() => {
    if (!hasSentRef.current && !magicLinkSent) {
      hasSentRef.current = true;
      onSendMagicLink();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (magicLinkSent && !showPasswordFallback) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <p className="text-center text-sm text-muted-foreground">
            {t("multiStep.magicLinkStep.sentDescription", { email })}
          </p>
        </div>
        <Button
          className="w-full"
          variant="outline"
          onClick={onSendMagicLink}
          disabled={pending}
        >
          {t("multiStep.magicLinkStep.resend")}
        </Button>
        {error ? (
          <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
            {error}
          </div>
        ) : null}
        <button
          type="button"
          className="w-full text-center text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
          onClick={() => setShowPasswordFallback(true)}
        >
          {t("multiStep.magicLinkStep.usePassword")}
        </button>
        {passkeySupported !== false ? (
          <Button type="button" variant="secondary" className="w-full" onClick={onPasskeySignIn} disabled={pending}>
            {t("multiStep.magicLinkStep.usePasskey")}
          </Button>
        ) : null}
        <Button
          className="w-full"
          type="button"
          variant="ghost"
          onClick={onBack}
          disabled={pending}
        >
          <ArrowLeft className="h-4 w-4" />
          {t("multiStep.back")}
        </Button>
      </div>
    );
  }

  // Password fallback from magic link primary
  return (
    <form className="space-y-4" onSubmit={onPasswordSubmit}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{t("fields.password")}</Label>
          <button
            type="button"
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
            onClick={onForgotPassword}
          >
            {t("multiStep.authStep.forgotPassword")}
          </button>
        </div>
        <PasswordInput
          id="password"
          name="password"
          placeholder={t("fields.passwordPlaceholder")}
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          required
          autoFocus
        />
      </div>
      {error ? (
        <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
          {error}
        </div>
      ) : null}
      <Button className="w-full" type="submit" disabled={pending}>
        {pending ? t("working") : t("multiStep.authStep.signInWithPassword")}
      </Button>
      {passkeySupported !== false ? (
        <Button type="button" variant="secondary" className="w-full" onClick={onPasskeySignIn} disabled={pending}>
          {t("multiStep.authStep.signInWithPasskey")}
        </Button>
      ) : null}
      <Button
        className="w-full"
        type="button"
        variant="ghost"
        onClick={onBack}
        disabled={pending}
      >
        <ArrowLeft className="h-4 w-4" />
        {t("multiStep.back")}
      </Button>
    </form>
  );
}
