"use client";

import { MonitorSmartphone } from "lucide-react";

import { cn } from "../../lib/utils";

export interface PasskeyUnsupportedAlertProps {
  className?: string;
  /** Bold heading line. */
  title?: string;
  /** Description text below the heading. */
  description?: string;
}

const defaultTitle = "Passkeys aren't supported on this device or browser.";
const defaultDescription =
  "Passkeys are two-factor by design \u2014 no separate 2FA needed, making them more secure and more convenient for daily use. Sign in later from a device that supports passkeys to set one up.";

export function PasskeyUnsupportedAlert({
  className,
  title,
  description,
}: PasskeyUnsupportedAlertProps) {
  return (
    <div
      role="status"
      data-slot="passkey-unsupported-alert"
      className={cn(
        "flex items-start gap-3 rounded-md border border-amber-500/50 bg-amber-500/10 p-3",
        className,
      )}
    >
      <MonitorSmartphone className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <div className="space-y-1 text-sm text-amber-800 dark:text-amber-300">
        <p className="font-medium">{title ?? defaultTitle}</p>
        <p>{description ?? defaultDescription}</p>
      </div>
    </div>
  );
}
