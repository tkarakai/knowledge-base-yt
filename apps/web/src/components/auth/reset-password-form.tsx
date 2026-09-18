"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import { useQuery } from "convex/react";
import { api } from "@repo/backend";
import { authClient, formatAuthError } from "@repo/auth/client";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  PasswordInput,
  Separator,
} from "@repo/design-system";
import { PasswordStrengthMeter, useThrottledPasswordCheck } from "@repo/design-system/password-strength";

function formatResetError(error: { status?: number; message?: string }): string {
  if (error.message?.includes("INVALID_TOKEN") || error.message?.includes("expired")) {
    return "This reset link has expired or is invalid. Please request a new one.";
  }
  return formatAuthError(error, "Something went wrong. Please try again.");
}

export function ResetPasswordForm({
  token,
  error: urlError,
}: {
  token?: string;
  error?: string;
}) {
  const router = useRouter();
  const t = useTranslations("auth");
  const tr = useTranslations("auth.resetPassword");
  const tps = useTranslations("passwordStrength");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [success, setSuccess] = React.useState(false);

  // Throttled password for server-side strength evaluation (at most once per 500ms)
  const [throttledPassword, notifyResolved] = useThrottledPasswordCheck(password);
  const strengthResult = useQuery(
    api.passwordStrength.evaluate,
    throttledPassword
      ? { password: throttledPassword, email: "", role: "user" as const }
      : "skip",
  );
  React.useEffect(() => {
    if (strengthResult !== undefined) notifyResolved();
  }, [strengthResult, notifyResolved]);
  const isPasswordValid = strengthResult?.valid ?? false;

  // No token — show invalid state
  if (!token) {
    return (
      <Card className="w-full max-w-md border-border/60 bg-card/80 shadow-xl shadow-primary/5">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            {tr("badge")}
          </div>
          <CardTitle className="text-2xl font-semibold">
            {tr("invalidTitle")}
          </CardTitle>
          <CardDescription>
            {urlError === "EXPIRED" ? tr("tokenExpired") : tr("tokenInvalid")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            className="w-full"
            onClick={() => router.push("/forgot-password")}
          >
            {tr("requestNewLink")}
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => router.push("/sign-in")}
          >
            <ArrowLeft className="h-4 w-4" />
            {tr("backToSignIn")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Success state
  if (success) {
    return (
      <Card className="w-full max-w-md border-border/60 bg-card/80 shadow-xl shadow-primary/5">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            {tr("badge")}
          </div>
          <div className="flex justify-center py-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-8 w-8 text-primary animate-in fade-in zoom-in duration-500" />
            </div>
          </div>
          <CardTitle className="text-center text-2xl font-semibold">
            {tr("successTitle")}
          </CardTitle>
          <CardDescription className="text-center">
            {tr("successDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            className="w-full"
            onClick={() => router.push("/sign-in")}
          >
            {tr("signInNow")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!isPasswordValid) {
      setError(tps("strengthRequirement"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("errors.passwordMismatch"));
      return;
    }

    setPending(true);

    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      });

      if (result.error) {
        setError(formatResetError(result.error));
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-border/60 bg-card/80 shadow-xl shadow-primary/5">
      <CardHeader className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          <Sparkles className="h-4 w-4" />
          {tr("badge")}
        </div>
        <CardTitle className="text-2xl font-semibold">
          {tr("title")}
        </CardTitle>
        <CardDescription>{tr("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="new-password">{tr("newPassword")}</Label>
            <PasswordInput
              id="new-password"
              name="new-password"
              placeholder={t("fields.passwordSignUpPlaceholder")}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={12}
              autoFocus
            />
            <PasswordStrengthMeter result={strengthResult} password={password} t={tps} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-new-password">{t("fields.confirmPassword")}</Label>
            <PasswordInput
              id="confirm-new-password"
              name="confirm-new-password"
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
          <Button className="w-full" type="submit" disabled={pending || !isPasswordValid}>
            {pending ? t("working") : tr("cta")}
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
            <ArrowLeft className="h-4 w-4" />
            {tr("backToSignIn")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
