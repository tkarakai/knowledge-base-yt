"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { useMutation, useQuery } from "convex/react";
import { api } from "@repo/backend";
import type { AuditStatus } from "@repo/backend";
import { authClient } from "@repo/auth/client";
import {
  Button,
  Checkbox,
  Label,
  PasswordInput,
  toast,
} from "@repo/design-system";
import { PasswordStrengthMeter, useThrottledPasswordCheck } from "@repo/design-system/password-strength";
import { useAuthUser } from "@/components/auth/auth-guard";

export function ChangePasswordForm() {
  const tcp = useTranslations("dashboard.changePassword");
  const tc = useTranslations("common");
  const ta = useTranslations("auth");
  const tps = useTranslations("passwordStrength");

  const authUser = useAuthUser();
  const postAuditEvent = useMutation(api.auditTrail.postEvent);
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
      ? { password: throttledPassword, email: authUser?.email ?? "", role: "user" as const }
      : "skip",
  );
  React.useEffect(() => {
    if (strengthResult !== undefined) notifyResolved();
  }, [strengthResult, notifyResolved]);
  const isNewPasswordValid = strengthResult?.valid ?? false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(ta("errors.passwordMismatch"));
      return;
    }

    if (!isNewPasswordValid) {
      toast.error(tps("strengthRequirement"));
      return;
    }

    setSubmitting(true);
    const happenedAt = Date.now();
    let status: AuditStatus = "succeeded";

    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions,
      });
      if (result.error) {
        status = "failed.wrong_password";
        toast.error(tcp("errorCurrentPassword"));
      } else {
        toast.success(tcp("success"));
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setRevokeOtherSessions(false);
      }
    } catch {
      status = "failed.unknown";
      toast.error(tc("error"));
    } finally {
      setSubmitting(false);
      postAuditEvent({
        happenedAt,
        sourceDetail: "settings",
        action: "auth.password_changed",
        resource: "user:self",
        status,
        meta: revokeOtherSessions ? JSON.stringify({ revokeOtherSessions: true }) : undefined,
      }).catch(() => {});
    }
  };

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length > 0 &&
    confirmPassword.length > 0 &&
    isNewPasswordValid &&
    newPassword === confirmPassword &&
    !submitting;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div className="space-y-2">
        <Label htmlFor="current-password">{tcp("currentPassword")}</Label>
        <PasswordInput
          id="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="new-password">{tcp("newPassword")}</Label>
        <PasswordInput
          id="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={12}
        />
        <PasswordStrengthMeter result={strengthResult} password={newPassword} t={tps} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password">{tcp("confirmPassword")}</Label>
        <PasswordInput
          id="confirm-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={12}
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="revoke-sessions"
          checked={revokeOtherSessions}
          onCheckedChange={(checked) => setRevokeOtherSessions(checked === true)}
        />
        <Label htmlFor="revoke-sessions" className="text-sm font-normal">
          {tcp("revokeOtherSessions")}
        </Label>
      </div>

      <Button type="submit" disabled={!canSubmit}>
        {submitting ? tc("saving") : tcp("cta")}
      </Button>
    </form>
  );
}
