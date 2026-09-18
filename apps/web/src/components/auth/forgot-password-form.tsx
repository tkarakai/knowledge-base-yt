"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Mail, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import { authClient } from "@repo/auth/client";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Separator,
} from "@repo/design-system";

function getAndClearPrefillEmail(): string {
  try {
    const value = window.sessionStorage.getItem("forgot-password-email");
    if (value) window.sessionStorage.removeItem("forgot-password-email");
    return value ?? "";
  } catch {
    return "";
  }
}

export function ForgotPasswordForm() {
  const router = useRouter();
  const t = useTranslations("auth");
  const tf = useTranslations("auth.forgotPassword");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState(getAndClearPrefillEmail);
  const [emailSent, setEmailSent] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      });

      // Always show "email sent" to prevent email enumeration, except for
      // rate limiting which is safe to surface (not user-specific).
      if (result.error?.status === 429) {
        setError("Too many requests. Please try again later.");
      } else {
        setEmailSent(true);
      }
    } catch {
      setEmailSent(true);
    } finally {
      setPending(false);
    }
  };

  if (emailSent) {
    return (
      <Card className="w-full max-w-md border-border/60 bg-card/80 shadow-xl shadow-primary/5">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            {tf("badge")}
          </div>
          <div className="flex justify-center py-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-8 w-8 text-primary animate-in fade-in zoom-in duration-500" />
            </div>
          </div>
          <CardTitle className="text-center text-2xl font-semibold">
            {tf("emailSent")}
          </CardTitle>
          <CardDescription className="text-center">
            {tf("emailSentDescription", { email })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Separator />
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => router.push("/sign-in")}
          >
            <ArrowLeft className="h-4 w-4" />
            {tf("backToSignIn")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md border-border/60 bg-card/80 shadow-xl shadow-primary/5">
      <CardHeader className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          <Sparkles className="h-4 w-4" />
          {tf("badge")}
        </div>
        <CardTitle className="text-2xl font-semibold">
          {tf("title")}
        </CardTitle>
        <CardDescription>{tf("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="forgot-email">{t("fields.email")}</Label>
            <Input
              id="forgot-email"
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
          <Button className="w-full" type="submit" disabled={pending}>
            {pending ? t("working") : tf("cta")}
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
            {tf("backToSignIn")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
