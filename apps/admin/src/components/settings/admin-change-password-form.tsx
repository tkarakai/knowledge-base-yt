"use client";

import * as React from "react";
import { useQuery } from "convex/react";

import { api } from "@repo/backend";
import { authClient } from "@repo/auth/client";
import {
  Button,
  Checkbox,
  Label,
  PasswordInput,
  toast,
} from "@repo/design-system";
import {
  PasswordStrengthMeter,
  useThrottledPasswordCheck,
  type PasswordStrengthTranslateFn,
} from "@repo/design-system/password-strength";
import { useAuthUser } from "@/components/auth/auth-guard";

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

export function AdminChangePasswordForm() {
  const authUser = useAuthUser();
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [revokeOtherSessions, setRevokeOtherSessions] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Throttled password for server-side strength evaluation (at most once per 500ms)
  const [throttledPassword, notifyResolved] = useThrottledPasswordCheck(newPassword);
  const strengthResult = useQuery(
    api.passwordStrength.evaluate,
    throttledPassword
      ? { password: throttledPassword, email: authUser?.email ?? "", role: "admin" as const }
      : "skip",
  );
  React.useEffect(() => {
    if (strengthResult !== undefined) notifyResolved();
  }, [strengthResult, notifyResolved]);
  const isNewPasswordValid = strengthResult?.valid ?? false;

  const passwordsMatch = newPassword === confirmPassword;
  const canSubmit =
    currentPassword.length > 0 &&
    isNewPasswordValid &&
    passwordsMatch &&
    !submitting;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!passwordsMatch) {
      toast.error("Passwords do not match");
      return;
    }

    if (!isNewPasswordValid) {
      toast.error("Password does not meet strength requirements");
      return;
    }

    setSubmitting(true);
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions,
      });

      if (result.error) {
        toast.error(result.error.message ?? "Current password is incorrect");
        return;
      }

      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setRevokeOtherSessions(false);
    } catch {
      toast.error("Failed to change password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div className="space-y-2">
        <Label htmlFor="admin-current-password">Current password</Label>
        <PasswordInput
          id="admin-current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="admin-new-password">New password</Label>
        <PasswordInput
          id="admin-new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
          minLength={40}
        />
        <PasswordStrengthMeter result={strengthResult} password={newPassword} t={t} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="admin-confirm-password">Confirm password</Label>
        <PasswordInput
          id="admin-confirm-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          minLength={40}
        />
        {confirmPassword && !passwordsMatch ? (
          <p className="text-xs text-destructive">Passwords do not match.</p>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="admin-revoke-sessions"
          checked={revokeOtherSessions}
          onCheckedChange={(checked) => setRevokeOtherSessions(checked === true)}
        />
        <Label htmlFor="admin-revoke-sessions" className="text-sm font-normal">
          Sign out all other devices
        </Label>
      </div>

      <Button type="submit" disabled={!canSubmit}>
        {submitting ? "Saving..." : "Update password"}
      </Button>
    </form>
  );
}
