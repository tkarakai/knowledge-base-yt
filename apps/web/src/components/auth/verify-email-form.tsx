"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Mail, Sparkles, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import { useQuery } from "convex/react";
import { api } from "@repo/backend";
import { authClient, formatAuthError } from "@repo/auth/client";
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
  Separator,
  parseUserAgent,
} from "@repo/design-system";

function formatDeviceName(userAgent: string | null | undefined): string {
  const parsed = parseUserAgent(userAgent);
  if (parsed.browser === "Unknown" && parsed.os === "Unknown") {
    return "this device";
  }
  if (parsed.browser === "Unknown") return parsed.os;
  if (parsed.os === "Unknown") return parsed.browser;
  return `${parsed.browser} on ${parsed.os}`;
}

export function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tv = useTranslations("auth.verifyEmail");
  const t = useTranslations("auth");
  const verificationError = searchParams.get("error");
  const isVerificationSuccess =
    searchParams.get("verified") === "1" && !verificationError;
  const showTokenResult = isVerificationSuccess || Boolean(verificationError);
  const [hasActiveSession, setHasActiveSession] = React.useState<boolean | null>(
    null,
  );
  const [deviceName, setDeviceName] = React.useState("this device");
  const [resending, setResending] = React.useState(false);
  const [resent, setResent] = React.useState(false);
  const [resendError, setResendError] = React.useState<string | null>(null);

  // Email may be passed as a URL param (recovery flow: redirected from sign-in)
  // or derived from the current session (post-signup flow).
  const emailParam = searchParams.get("email") ?? "";
  const session = authClient.useSession();
  const sessionEmail = session.data?.user?.email ?? "";
  const email = emailParam || sessionEmail;
  const [resendEmail, setResendEmail] = React.useState(email);

  React.useEffect(() => {
    if (!resendEmail && email) {
      setResendEmail(email);
    }
  }, [email, resendEmail]);

  // Real-time subscription: when the user verifies via the email link (even in
  // another tab), Convex pushes the updated record and we redirect automatically.
  const currentUser = useQuery(api.auth.getCurrentUser);
  React.useEffect(() => {
    if (showTokenResult) return;
    const userRecord = currentUser as Record<string, unknown> | null | undefined;
    if (userRecord?.emailVerified) {
      broadcastAuth();
      redirectWithUserLocale(router);
    }
  }, [currentUser, router, showTokenResult]);

  React.useEffect(() => {
    if (!isVerificationSuccess) return;

    let cancelled = false;
    setHasActiveSession(null);

    void (async () => {
      try {
        const result = await authClient.getSession();
        if (cancelled) return;

        const sessionRecord = result.data?.session as
          | { token?: string; userAgent?: string | null }
          | undefined;

        if (!sessionRecord?.token) {
          setHasActiveSession(false);
          return;
        }

        setHasActiveSession(true);
        setDeviceName(formatDeviceName(sessionRecord.userAgent));
      } catch {
        if (!cancelled) setHasActiveSession(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isVerificationSuccess]);

  const handleCloseWindow = () => {
    globalThis.window?.close();
  };

  const handleResend = async () => {
    setResendError(null);
    setResent(false);

    const normalizedEmail = resendEmail.trim();
    if (!normalizedEmail) {
      setResendError(tv("verificationErrorUnknown"));
      return;
    }

    setResending(true);
    try {
      const result = await authClient.sendVerificationEmail({
        email: normalizedEmail,
        callbackURL: EMAIL_VERIFICATION_CALLBACK_URL,
      });

      if (result.error) {
        setResendError(
          formatAuthError(result.error, tv("verificationErrorUnknown")),
        );
        return;
      }

      setResent(true);
    } catch {
      setResendError(tv("verificationErrorUnknown"));
    } finally {
      setResending(false);
    }
  };

  if (showTokenResult) {
    const errorMessage = verificationError
      ? (() => {
          switch (verificationError) {
            case "token_expired":
              return tv("verificationErrorTokenExpired");
            case "invalid_token":
              return tv("verificationErrorInvalidToken");
            case "user_not_found":
              return tv("verificationErrorUserNotFound");
            case "unauthorized":
              return tv("verificationErrorUnauthorized");
            default:
              return tv("verificationErrorUnknown");
          }
        })()
      : null;

    const resultCard = (
      <Card className="w-full max-w-md border-border/60 bg-card shadow-xl shadow-primary/5">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            {tv("badge")}
          </div>
          <div className="flex justify-center py-4">
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-full ${
                errorMessage ? "bg-destructive/10" : "bg-primary/10"
              }`}
            >
              {errorMessage ? (
                <TriangleAlert className="h-8 w-8 text-destructive" />
              ) : (
                <CheckCircle2 className="h-8 w-8 text-primary" />
              )}
            </div>
          </div>
          <CardTitle className="text-center text-2xl font-semibold">
            {errorMessage
              ? tv("verificationErrorTitle")
              : tv("verificationSuccessTitle")}
          </CardTitle>
          <CardDescription className="text-center">
            {errorMessage ?? tv("verificationSuccessDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center text-sm text-foreground">
          {isVerificationSuccess ? (
            hasActiveSession === null ? (
              <p>{tv("sessionStatusChecking")}</p>
            ) : hasActiveSession ? (
              <p>{tv("sessionStatusSignedInOnDevice", { device: deviceName })}</p>
            ) : (
              <div className="space-y-2">
                <p>{tv("sessionStatusNoSession")}</p>
                <a
                  className="font-medium text-primary underline underline-offset-4"
                  href="/sign-in"
                >
                  {tv("goToSignIn")}
                </a>
              </div>
            )
          ) : null}
          {!isVerificationSuccess ? (
            <div className="space-y-3 text-left">
              <div className="space-y-2">
                <Label htmlFor="verify-resend-email">{t("fields.email")}</Label>
                <Input
                  id="verify-resend-email"
                  type="email"
                  value={resendEmail}
                  placeholder={t("fields.emailPlaceholder")}
                  onChange={(event) => setResendEmail(event.target.value)}
                />
              </div>
              {resendError ? (
                <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
                  {resendError}
                </div>
              ) : null}
              {resent ? (
                <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">
                  {tv("resent")}
                </div>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleResend}
                disabled={resending || !resendEmail.trim()}
              >
                {resending ? t("working") : tv("resend")}
              </Button>
            </div>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleCloseWindow}
          >
            {tv("closeWindow")}
          </Button>
        </CardContent>
      </Card>
    );

    if (isVerificationSuccess) {
      return (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-background px-6 py-16"
        >
          {resultCard}
        </div>
      );
    }

    return resultCard;
  }

  return (
    <Card className="w-full max-w-md border-border/60 bg-card/80 shadow-xl shadow-primary/5">
      <CardHeader className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          <Sparkles className="h-4 w-4" />
          {tv("badge")}
        </div>
        <div className="flex justify-center py-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-8 w-8 text-primary" />
          </div>
        </div>
        <CardTitle className="text-center text-2xl font-semibold">
          {tv("title")}
        </CardTitle>
        <CardDescription className="text-center">
          {email
            ? tv("descriptionWithEmail", { email })
            : tv("description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Separator className="flex-1 min-w-0 w-auto" />
          <span>{t("footer")}</span>
          <Separator className="flex-1 min-w-0 w-auto" />
        </div>
        <Button
          variant="ghost"
          className="w-full"
          onClick={async () => {
            await authClient.signOut();
            router.push("/sign-in");
          }}
        >
          <ArrowLeft className="h-4 w-4" />
          {tv("backToSignIn")}
        </Button>
      </CardContent>
    </Card>
  );
}
