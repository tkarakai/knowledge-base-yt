"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { ListChecks } from "lucide-react";
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
  Input,
  Label,
  Skeleton,
  Switch,
} from "@repo/design-system";
import {
  getOnboardingChangeCopy,
  normalizeOnboardingPolicy,
  type OnboardingPolicy,
} from "@/components/onboarding/onboarding-policy-copy";
import { OnboardingModeTransition } from "@/components/onboarding/onboarding-mode-transition";
import { EmailTemplateEditor } from "@/components/waitlist/email-template-editor";

export function WaitlistFeatureCard() {
  const onboardingType = useQuery(api.appSettings.get, {
    key: "onboardingType",
  });
  const invitationExpiryDays = useQuery(api.appSettings.get, {
    key: "invitationTokenExpiryDays",
  });
  const setSetting = useMutation(api.appSettings.set);

  const [togglePending, setTogglePending] = React.useState(false);
  const [confirmToggle, setConfirmToggle] = React.useState<boolean | null>(null);
  const [expiryInput, setExpiryInput] = React.useState("");
  const [expiryPending, setExpiryPending] = React.useState(false);

  React.useEffect(() => {
    if (
      invitationExpiryDays !== undefined &&
      invitationExpiryDays !== null
    ) {
      setExpiryInput(String(invitationExpiryDays));
    }
  }, [invitationExpiryDays]);

  const handleToggleRequest = (checked: boolean) => {
    setConfirmToggle(checked);
  };

  const handleToggleConfirm = async () => {
    if (confirmToggle === null) return;
    const checked = confirmToggle;
    setConfirmToggle(null);
    setTogglePending(true);
    try {
      await setSetting({
        key: "onboardingType",
        value: checked ? "publicWaitlist" : "inviteOnly",
      });
      toast.success(
        checked ? "Public waitlist enabled" : "Public waitlist disabled"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update setting");
    } finally {
      setTogglePending(false);
    }
  };

  const handleExpiryBlur = async () => {
    const num = parseInt(expiryInput, 10);
    if (Number.isNaN(num) || num < 1 || num > 365) {
      toast.error("Token expiry must be between 1 and 365 days");
      setExpiryInput(String(invitationExpiryDays ?? 7));
      return;
    }
    if (num === invitationExpiryDays) return;

    setExpiryPending(true);
    try {
      await setSetting({
        key: "invitationTokenExpiryDays",
        value: String(num),
      });
      toast.success(`Invitation tokens now expire in ${num} days`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update setting"
      );
    } finally {
      setExpiryPending(false);
    }
  };

  const isLoading = onboardingType === undefined;
  const isEnabled = onboardingType === "publicWaitlist";
  const mode = typeof onboardingType === "string" ? onboardingType : "inviteOnly";
  const currentPolicy = normalizeOnboardingPolicy(onboardingType);
  const nextPolicy: OnboardingPolicy | null =
    confirmToggle === null
      ? null
      : confirmToggle
        ? "publicWaitlist"
        : "inviteOnly";
  const confirmCopy = getOnboardingChangeCopy(
    currentPolicy,
    nextPolicy ?? currentPolicy
  );

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
              <ListChecks className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Public Waitlist</CardTitle>
              <CardDescription>
                Allow visitors to join a public waitlist
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
                  id="waitlist-toggle"
                  checked={isEnabled}
                  onCheckedChange={handleToggleRequest}
                  disabled={togglePending}
                />
                <Label htmlFor="waitlist-toggle" className="text-sm font-medium">
                  {isEnabled ? "Enabled" : "Disabled"}
                </Label>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {mode === "publicWaitlist"
                  ? "Landing shows the waitlist form. Public self-signup is disabled."
                  : mode === "publicSignup"
                  ? "Public self-signup is enabled. Public waitlist is disabled."
                  : "Invite-only onboarding is enabled. No public self-service onboarding is available."}
              </p>
              {invitationExpiryDays === undefined ? (
                <Skeleton className="h-8 w-44" />
              ) : (
                <div className="flex items-center gap-1.5">
                  <Label
                    htmlFor="expiry-days"
                    className="shrink-0 text-sm text-muted-foreground"
                  >
                    Invitation Expiry
                  </Label>
                  <Input
                    id="expiry-days"
                    type="number"
                    min={1}
                    max={365}
                    value={expiryInput || "7"}
                    onChange={(e) => setExpiryInput(e.target.value)}
                    onBlur={handleExpiryBlur}
                    disabled={expiryPending}
                    className="h-8 w-16"
                  />
                  <span className="text-sm text-muted-foreground">days</span>
                </div>
              )}
            </>
          )}
          <EmailTemplateEditor
            disabled={isLoading || !isEnabled}
            embedded
          />
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
            <AlertDialogTitle>{confirmCopy.title}</AlertDialogTitle>
            <AlertDialogDescription>
              Review the mode transition before confirming.
            </AlertDialogDescription>
            <OnboardingModeTransition
              currentLabel={confirmCopy.currentLabel}
              nextLabel={confirmCopy.nextLabel}
            />
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleConfirm}>
              {confirmCopy.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
