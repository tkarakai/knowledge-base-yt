"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";

import { api } from "@repo/backend";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Skeleton,
  Switch,
} from "@repo/design-system";
import { EmailVerificationTemplateEditor } from "./email-verification-template-editor";

type Scope = "admin" | "user";

const SETTINGS_KEY: Record<Scope, string> = {
  user: "userEmailVerificationRequired",
  admin: "adminEmailVerificationRequired",
};

export function EmailVerificationPolicyCard({ scope }: { scope: Scope }) {
  const isAdminScope = scope === "admin";
  const key = SETTINGS_KEY[scope];

  const emailVerifRequired = useQuery(api.appSettings.get, {
    key,
  });
  const setSetting = useMutation(api.appSettings.set);

  const [togglePending, setTogglePending] = React.useState(false);
  const [confirmToggle, setConfirmToggle] = React.useState<boolean | null>(null);

  const handleToggleRequest = (checked: boolean) => {
    setConfirmToggle(checked);
  };

  const handleToggleConfirm = async () => {
    if (confirmToggle === null) return;
    const checked = confirmToggle;
    setConfirmToggle(null);
    setTogglePending(true);
    try {
      await setSetting({ key, value: String(checked) });
      toast.success(
        checked
          ? `Email verification requirement enabled for ${scope}s`
          : `Email verification requirement disabled for ${scope}s`,
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update email verification policy",
      );
    } finally {
      setTogglePending(false);
    }
  };

  const isLoading = emailVerifRequired === undefined;
  // Default is true when the setting has never been stored (null from getPublic default)
  const isEnabled = emailVerifRequired === null ? true : emailVerifRequired === true;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
              <MailCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">
                {isAdminScope ? "Admin Email Verification Policy" : "User Email Verification Policy"}
              </CardTitle>
              <CardDescription>
                {isAdminScope
                  ? "Require admins to verify their email address before accessing admin routes"
                  : "Require users to verify their email address before accessing the app"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-9 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <Switch
                  id="email-verif-toggle"
                  checked={isEnabled}
                  onCheckedChange={handleToggleRequest}
                  disabled={togglePending}
                />
                <Label htmlFor="email-verif-toggle" className="text-sm font-medium">
                  {isEnabled ? "Required" : "Optional"}
                </Label>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {isEnabled
                  ? isAdminScope
                    ? "Admins must verify their email address before accessing dashboard routes."
                    : "Users must verify their email address before accessing the dashboard. Unverified users are redirected to a verification page."
                  : isAdminScope
                  ? "Email verification is optional for admins."
                  : "Email verification is optional. Users can access the app immediately after signing up without verifying their email."}
              </p>
            </>
          )}
          {!isAdminScope ? (
            <EmailVerificationTemplateEditor
              disabled={isLoading || !isEnabled}
              embedded
            />
          ) : null}
        </CardContent>
      </Card>

      <AlertDialog
        open={confirmToggle !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmToggle(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmToggle
                ? `Require email verification for all ${scope}s?`
                : `Make email verification optional for ${scope}s?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmToggle
                ? `All ${scope}s will be required to verify their email before protected access.`
                : `Email verification becomes optional for ${scope}s.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleConfirm}>
              {confirmToggle ? "Enable" : "Disable"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
