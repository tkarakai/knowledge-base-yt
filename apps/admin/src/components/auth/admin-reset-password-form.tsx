"use client";

import * as React from "react";
import Link from "next/link";

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
} from "@repo/design-system";
import {
  PasswordStrengthMeter,
  useThrottledPasswordCheck,
  type PasswordStrengthTranslateFn,
} from "@repo/design-system/password-strength";

// Plain-English translation function for PasswordStrengthMeter.
// The admin app has no i18n, so we provide direct English strings for all
// keys emitted by zxcvbn's key-path translations + the strength meter.
const t: PasswordStrengthTranslateFn = (key, params) => {
  const map: Record<string, string> = {
    // Strength labels
    "labels.veryWeak": "Very weak",
    "labels.weak": "Weak",
    "labels.fair": "Fair",
    "labels.good": "Good",
    "labels.strong": "Strong",

    // Min length
    minLength: `Must be at least ${params?.count ?? 0} characters.`,

    // Crack time
    crackTimeLabel: `Estimated crack time: ${params?.time ?? ""}`,

    // Warnings
    "warnings.straightRow": "Straight rows of keys on your keyboard are easy to guess.",
    "warnings.keyPattern": "Short keyboard patterns are easy to guess.",
    "warnings.simpleRepeat": "Repeated characters like \"aaa\" are easy to guess.",
    "warnings.extendedRepeat": "Repeated character patterns like \"abcabc\" are easy to guess.",
    "warnings.sequences": "Common character sequences like \"abc\" are easy to guess.",
    "warnings.recentYears": "Recent years are easy to guess.",
    "warnings.dates": "Dates are often easy to guess.",
    "warnings.topTen": "This is a heavily used password.",
    "warnings.topHundred": "This is a frequently used password.",
    "warnings.common": "This is a commonly used password.",
    "warnings.similarToCommon": "This is similar to a commonly used password.",
    "warnings.wordByItself": "Single words are easy to guess.",
    "warnings.namesByThemselves": "Single names or surnames are easy to guess.",
    "warnings.commonNames": "Common names and surnames are easy to guess.",
    "warnings.userInputs": "Personal or page-related data should not be included.",
    "warnings.pwned": "This password has been exposed in a data breach.",

    // Suggestions
    "suggestions.l33t": "Avoid predictable letter substitutions like \"@\" for \"a\".",
    "suggestions.reverseWords": "Avoid reversed spellings of common words.",
    "suggestions.allUppercase": "Capitalize some but not all letters.",
    "suggestions.capitalization": "Capitalize more than the first letter.",
    "suggestions.dates": "Avoid dates and years that are associated with you.",
    "suggestions.recentYears": "Avoid recent years.",
    "suggestions.associatedYears": "Avoid years that are associated with you.",
    "suggestions.sequences": "Avoid common character sequences.",
    "suggestions.repeated": "Avoid repeated words and characters.",
    "suggestions.longerKeyboardPattern": "Use longer keyboard patterns and change typing direction multiple times.",
    "suggestions.anotherWord": "Add more words that are less common.",
    "suggestions.useWords": "Use multiple words, but avoid common phrases.",
    "suggestions.noNeed": "You can create strong passwords without using symbols, numbers, or uppercase letters.",
    "suggestions.pwned": "If you use this password elsewhere, change it immediately.",

    // Time estimation
    "timeEstimation.ltSecond": "less than a second",
    "timeEstimation.second": `${params?.base ?? 1} second`,
    "timeEstimation.seconds": `${params?.base ?? 0} seconds`,
    "timeEstimation.minute": `${params?.base ?? 1} minute`,
    "timeEstimation.minutes": `${params?.base ?? 0} minutes`,
    "timeEstimation.hour": `${params?.base ?? 1} hour`,
    "timeEstimation.hours": `${params?.base ?? 0} hours`,
    "timeEstimation.day": `${params?.base ?? 1} day`,
    "timeEstimation.days": `${params?.base ?? 0} days`,
    "timeEstimation.month": `${params?.base ?? 1} month`,
    "timeEstimation.months": `${params?.base ?? 0} months`,
    "timeEstimation.year": `${params?.base ?? 1} year`,
    "timeEstimation.years": `${params?.base ?? 0} years`,
    "timeEstimation.centuries": "centuries",
  };
  return map[key] ?? key;
};

function formatResetError(error: { status?: number; message?: string }): string {
  if (
    error.message?.includes("INVALID_TOKEN") ||
    error.message?.includes("expired")
  ) {
    return "This reset link has expired or is invalid. Please request a new one.";
  }
  return formatAuthError(error, "Something went wrong. Please try again.");
}

export function AdminResetPasswordForm({
  token,
  error: urlError,
}: {
  token?: string;
  error?: string;
}) {
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
      ? { password: throttledPassword, email: "", role: "admin" as const }
      : "skip",
  );
  React.useEffect(() => {
    if (strengthResult !== undefined) notifyResolved();
  }, [strengthResult, notifyResolved]);
  const isPasswordValid = strengthResult?.valid ?? false;

  // No token — show invalid state
  if (!token) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">
            Invalid reset link
          </CardTitle>
          <CardDescription>
            {urlError === "EXPIRED"
              ? "This reset link has expired. Please request a new one."
              : "This reset link is invalid or has already been used."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button className="w-full" asChild>
            <Link href="/forgot-password">Request a new link</Link>
          </Button>
          <Button variant="ghost" className="w-full" asChild>
            <Link href="/sign-in">Back to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Success state
  if (success) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">
            Password reset
          </CardTitle>
          <CardDescription>
            Your password has been successfully reset. You can now sign in with
            your new password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" asChild>
            <Link href="/sign-in">Sign in now</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!isPasswordValid) {
      setError("Password does not meet strength requirements.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
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
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">
          Reset password
        </CardTitle>
        <CardDescription>Enter your new password below.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <PasswordInput
              id="new-password"
              name="new-password"
              placeholder="Enter new password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={40}
              autoFocus
            />
            <PasswordStrengthMeter result={strengthResult} password={password} t={t} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-new-password">Confirm password</Label>
            <PasswordInput
              id="confirm-new-password"
              name="confirm-new-password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              minLength={40}
            />
          </div>
          {error ? (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          <Button className="w-full" type="submit" disabled={pending || !isPasswordValid}>
            {pending ? "Resetting..." : "Reset password"}
          </Button>
          <Button type="button" variant="ghost" className="w-full" asChild>
            <Link href="/sign-in">Back to sign in</Link>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
