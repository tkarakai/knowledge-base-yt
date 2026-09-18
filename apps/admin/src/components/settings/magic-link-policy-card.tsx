"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { Mail } from "lucide-react";
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

export function MagicLinkPolicyCard() {
  const magicLinkEnabled = useQuery(api.appSettings.get, {
    key: "userMagicLinkEnabled",
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
      await setSetting({ key: "userMagicLinkEnabled", value: String(checked) });
      toast.success(
        checked
          ? "Magic link sign-in enabled for users"
          : "Magic link sign-in disabled for users",
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update magic link policy",
      );
    } finally {
      setTogglePending(false);
    }
  };

  const isLoading = magicLinkEnabled === undefined;
  const isEnabled = magicLinkEnabled === true;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">
                Magic Link Sign-In
              </CardTitle>
              <CardDescription>
                Allow users to sign in via a one-time link sent to their email
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
                  id="magic-link-toggle"
                  checked={isEnabled}
                  onCheckedChange={handleToggleRequest}
                  disabled={togglePending}
                />
                <Label htmlFor="magic-link-toggle" className="text-sm font-medium">
                  {isEnabled ? "Enabled" : "Disabled"}
                </Label>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {isEnabled
                  ? "Users can choose to receive a sign-in link via email instead of entering their password."
                  : "Magic link sign-in is disabled. Users must use password or passkey to sign in."}
              </p>
            </>
          )}
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
                ? "Enable magic link sign-in for users?"
                : "Disable magic link sign-in for users?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmToggle
                ? "Users will see a \"Sign in with magic link\" option on the sign-in page."
                : "The magic link option will be hidden from the sign-in page. Users with magic link as their preferred method will be shown password sign-in instead."}
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
