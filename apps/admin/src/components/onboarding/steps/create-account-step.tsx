"use client";

import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { useQuery } from "convex/react";

import { api } from "@repo/backend";
import { authClient, formatAuthError, isConvexRateLimited, AUTH_RATE_LIMIT_MESSAGE } from "@repo/auth/client";
import {
  Button,
  Input,
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

interface CreateAccountStepProps {
  email: string;
  onBeforeSignUp?: () => Promise<void>;
  onComplete: (password: string) => Promise<void>;
  onBack: () => void;
}

export function CreateAccountStep({ email, onBeforeSignUp, onComplete, onBack }: CreateAccountStepProps) {
  const [name, setName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Throttled password for server-side strength evaluation (at most once per 500ms)
  const [throttledPassword, notifyResolved] = useThrottledPasswordCheck(password);
  const strengthResult = useQuery(
    api.passwordStrength.evaluate,
    throttledPassword
      ? { password: throttledPassword, email, role: "admin" as const }
      : "skip",
  );
  React.useEffect(() => {
    if (strengthResult !== undefined) notifyResolved();
  }, [strengthResult, notifyResolved]);

  const passwordsMatch = password === confirmPassword;
  const canSubmit = name.trim() && (strengthResult?.valid ?? false) && passwordsMatch && !loading;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);

    try {
      // Claim the invitation token before signup. This proves token
      // possession and adds the email to adminEmails for auto-promotion.
      if (onBeforeSignUp) {
        await onBeforeSignUp();
      }

      const result = await authClient.signUp.email({
        name: name.trim(),
        email,
        password,
      });

      if (result.error) {
        const msg = formatAuthError(result.error, "Failed to create account");
        setError(msg);
        return;
      }

      await onComplete(password);
    } catch (err) {
      if (isConvexRateLimited(err)) {
        setError(AUTH_RATE_LIMIT_MESSAGE);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="onboarding-email">Email</Label>
        <Input
          id="onboarding-email"
          type="email"
          value={email}
          disabled
          className="bg-muted"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="onboarding-name">Name</Label>
        <Input
          id="onboarding-name"
          type="text"
          placeholder="Your full name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="onboarding-password">Password</Label>
        <PasswordInput
          id="onboarding-password"
          placeholder="Min. 40 characters"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <PasswordStrengthMeter result={strengthResult} password={password} t={t} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="onboarding-confirm-password">Confirm password</Label>
        <PasswordInput
          id="onboarding-confirm-password"
          placeholder="Re-enter your password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />
        {confirmPassword && !passwordsMatch ? (
          <p className="text-xs text-destructive">Passwords do not match.</p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <Button className="w-full" type="submit" disabled={!canSubmit}>
        {loading ? "Creating account..." : "Create account"}
      </Button>
      <Button
        className="w-full"
        type="button"
        variant="ghost"
        disabled={loading}
        onClick={onBack}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to intro
      </Button>
    </form>
  );
}
