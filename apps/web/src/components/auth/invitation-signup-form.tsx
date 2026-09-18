"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { ArrowRight, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import { api } from "@repo/backend";
import { authClient, isAuthRateLimited, isConvexRateLimited } from "@repo/auth/client";
import { broadcastAuth } from "@/lib/auth-broadcast";
import { EMAIL_VERIFICATION_CALLBACK_URL } from "@/lib/auth-callbacks";
import { redirectWithUserLocale } from "@/lib/auth-locale";
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
  Skeleton,
} from "@repo/design-system";
import { PasswordStrengthMeter, useThrottledPasswordCheck } from "@repo/design-system/password-strength";

export function InvitationSignupForm({ token }: { token?: string }) {
  const router = useRouter();
  const t = useTranslations("auth");
  const ti = useTranslations("auth.invitation");
  const tps = useTranslations("passwordStrength");

  // Validate token via Convex query (real-time)
  const tokenValidation = useQuery(
    api.waitlistTokens.validate,
    token ? { token } : "skip"
  );

  const beginClaim = useMutation(api.waitlistTokens.beginClaim);
  const finalizeClaim = useMutation(api.waitlistTokens.finalizeClaim);

  // Read admin setting so we know whether to gate unverified users after sign-up.
  const emailVerifRequired = useQuery(api.appSettings.getPublic, {
    key: "userEmailVerificationRequired",
  });

  const [name, setName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Throttled password for server-side strength evaluation (at most once per 500ms)
  const [throttledPassword, notifyResolved] = useThrottledPasswordCheck(password);
  const strengthResult = useQuery(
    api.passwordStrength.evaluate,
    throttledPassword && tokenValidation?.valid
      ? { password: throttledPassword, email: tokenValidation.email, role: "user" as const }
      : "skip",
  );
  React.useEffect(() => {
    if (strengthResult !== undefined) notifyResolved();
  }, [strengthResult, notifyResolved]);

  // Session conflict detection
  const [sessionConflict, setSessionConflict] = React.useState<{
    sessionEmail: string;
  } | null>(null);
  const [signingOut, setSigningOut] = React.useState(false);

  React.useEffect(() => {
    if (!token || !tokenValidation?.valid) return;

    async function checkSession() {
      try {
        const session = await authClient.getSession();
        const userEmail = (session.data?.user as Record<string, unknown>)?.email as string | undefined;
        if (session.data?.session && userEmail && userEmail !== tokenValidation!.email) {
          setSessionConflict({ sessionEmail: userEmail });
        } else {
          setSessionConflict(null);
        }
      } catch {
        // No session or error checking — not a conflict
      }
    }

    checkSession();
  }, [token, tokenValidation]);

  // No token provided
  if (!token) {
    return (
      <Card className="w-full max-w-md border-border/60 bg-card/80 shadow-xl shadow-primary/5">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {ti("invalidTitle")}
          </CardTitle>
          <CardDescription className="text-xl font-semibold leading-tight text-foreground">
            {ti("noToken")}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Loading state
  if (tokenValidation === undefined) {
    return (
      <Card className="w-full max-w-md border-border/60 bg-card/80 shadow-xl shadow-primary/5">
        <CardContent className="space-y-4 pt-6">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Invalid token
  if (!tokenValidation.valid) {
    const reasonMessages: Record<string, string> = {
      EXPIRED: ti("tokenExpired"),
      ALREADY_USED: ti("tokenUsed"),
      REVOKED: ti("tokenInvalid"),
      NOT_FOUND: ti("tokenInvalid"),
    };

    return (
      <Card className="w-full max-w-md border-border/60 bg-card/80 shadow-xl shadow-primary/5">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {ti("invalidTitle")}
          </CardTitle>
          <CardDescription className="text-xl font-semibold leading-tight text-foreground">
            {reasonMessages[tokenValidation.reason] ?? ti("tokenInvalid")}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Session conflict: different user already signed in
  if (sessionConflict) {
    return (
      <Card className="w-full max-w-md border-border/60 bg-card/80 shadow-xl shadow-primary/5">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {ti("sessionConflictTitle")}
          </CardTitle>
          <CardDescription className="text-xl font-semibold leading-tight text-foreground">
            {ti("sessionConflictDescription", { email: sessionConflict.sessionEmail })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2">
            <Button
              className="w-full"
              disabled={signingOut}
              onClick={async () => {
                setSigningOut(true);
                try {
                  await authClient.signOut();
                  window.location.reload();
                } catch {
                  setSigningOut(false);
                }
              }}
            >
              {signingOut ? t("working") : ti("signOutAndContinue")}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              disabled={signingOut}
              onClick={() => router.push("/dashboard")}
            >
              {ti("cancel")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      // Step 1: Create account via Better Auth (before claiming the token,
      // so that password validation failures like HIBP don't consume the token).
      const result = await authClient.signUp.email({
        name,
        email: tokenValidation.email,
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
        return;
      }

      // Step 2: Account created — now claim the token (sent → claiming → claimed).
      // If claiming fails, the account still exists but the token can be retried.
      try {
        await beginClaim({ token });
        await finalizeClaim({ token });
      } catch {
        // Token claim failure is non-fatal — the account was already created.
        // The token will auto-reset from "claiming" after the TTL expires.
      }

      broadcastAuth();

      // If email verification is required and the user isn't verified yet,
      // redirect to the verify-email page (same gate as the main sign-up form).
      const data = result.data as Record<string, unknown> | undefined;
      const newUser = data?.user as Record<string, unknown> | undefined;
      if (newUser && !newUser.emailVerified && emailVerifRequired === true) {
        router.push("/verify-email");
        return;
      }

      await redirectWithUserLocale(router);
    } catch (err) {
      setError(isConvexRateLimited(err) ? t("errors.rateLimited") : t("errors.generic"));
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-border/60 bg-card/80 shadow-xl shadow-primary/5">
      <CardHeader className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          <Sparkles className="h-4 w-4" />
          {ti("badge")}
        </div>
        <CardTitle className="text-2xl font-semibold">{ti("title")}</CardTitle>
        <CardDescription>{ti("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="invite-email">{t("fields.email")}</Label>
            <Input
              id="invite-email"
              type="email"
              value={tokenValidation.email}
              readOnly
              className="bg-muted"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-name">{t("fields.name")}</Label>
            <Input
              id="invite-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("fields.namePlaceholder")}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-password">{t("fields.password")}</Label>
            <PasswordInput
              id="invite-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("fields.passwordSignUpPlaceholder")}
              required
              minLength={12}
            />
            <PasswordStrengthMeter result={strengthResult} password={password} t={tps} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-confirm-password">
              {t("fields.confirmPassword")}
            </Label>
            <PasswordInput
              id="invite-confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t("fields.confirmPasswordPlaceholder")}
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
            {pending ? t("working") : ti("cta")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
