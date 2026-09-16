"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
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
  Label,
  Skeleton,
  Switch,
} from "@repo/design-system";
import {
  getOnboardingChangeCopy,
  type OnboardingPolicy,
  normalizeOnboardingPolicy,
} from "@/components/onboarding/onboarding-policy-copy";
import { OnboardingModeTransition } from "@/components/onboarding/onboarding-mode-transition";

export function WaitlistSettings() {
  const onboardingType = useQuery(api.appSettings.get, {
    key: "onboardingType",
  });
  const setSetting = useMutation(api.appSettings.set);

  const [togglePending, setTogglePending] = React.useState(false);
  const [confirmToggle, setConfirmToggle] = React.useState<boolean | null>(
    null
  );

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
      toast.error(
        err instanceof Error ? err.message : "Failed to update setting"
      );
    } finally {
      setTogglePending(false);
    }
  };

  if (onboardingType === undefined) {
    return <Skeleton className="h-8 w-32" />;
  }

  const waitlistEnabled = onboardingType === "publicWaitlist";
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
      <div className="flex items-center gap-2">
        <Switch
          id="waitlist-toggle"
          checked={waitlistEnabled === true}
          onCheckedChange={handleToggleRequest}
          disabled={togglePending}
        />
        <Label htmlFor="waitlist-toggle" className="text-sm font-medium">
          {waitlistEnabled ? "Enabled" : "Disabled"}
        </Label>
      </div>

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
