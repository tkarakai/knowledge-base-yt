"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { KeyRound } from "lucide-react";
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
import {
  getOnboardingChangeCopy,
  normalizeOnboardingPolicy,
} from "@/components/onboarding/onboarding-policy-copy";
import { OnboardingModeTransition } from "@/components/onboarding/onboarding-mode-transition";

export function InviteOnlyFeatureCard() {
  const onboardingType = useQuery(api.appSettings.get, {
    key: "onboardingType",
  });
  const setSetting = useMutation(api.appSettings.set);

  const [togglePending, setTogglePending] = React.useState(false);
  const [confirmEnable, setConfirmEnable] = React.useState(false);

  const isLoading = onboardingType === undefined;
  const isEnabled = onboardingType === "inviteOnly";
  const currentPolicy = normalizeOnboardingPolicy(onboardingType);
  const confirmCopy = getOnboardingChangeCopy(currentPolicy, "inviteOnly");

  const handleToggleRequest = (checked: boolean) => {
    // This acts like a radio option: selecting this mode only.
    if (checked) setConfirmEnable(true);
  };

  const handleConfirm = async () => {
    setConfirmEnable(false);
    setTogglePending(true);
    try {
      await setSetting({
        key: "onboardingType",
        value: "inviteOnly",
      });
      toast.success("Invite-only onboarding enabled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update setting");
    } finally {
      setTogglePending(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
              <KeyRound className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Invite Only</CardTitle>
              <CardDescription>
                Only admins can invite people to onboard
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
                  id="invite-only-toggle"
                  checked={isEnabled}
                  onCheckedChange={handleToggleRequest}
                  disabled={togglePending}
                />
                <Label htmlFor="invite-only-toggle" className="text-sm font-medium">
                  {isEnabled ? "Enabled" : "Disabled"}
                </Label>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Landing shows only sign-in. Admins can still invite users directly from
                the Onboarding page.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmEnable} onOpenChange={setConfirmEnable}>
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
            <AlertDialogAction onClick={handleConfirm}>
              {confirmCopy.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
