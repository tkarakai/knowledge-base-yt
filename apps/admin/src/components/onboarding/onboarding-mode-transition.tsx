"use client";

import { ArrowRight } from "lucide-react";

type OnboardingModeTransitionProps = {
  currentLabel: string;
  nextLabel: string;
};

export function OnboardingModeTransition({
  currentLabel,
  nextLabel,
}: OnboardingModeTransitionProps) {
  return (
    <div className="mt-2 rounded-lg bg-muted/25 px-3 py-2">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">Current mode</div>
          <div className="truncate text-sm font-semibold text-foreground">
            {currentLabel}
          </div>
        </div>
        <div className="flex justify-center text-muted-foreground">
          <ArrowRight className="h-4 w-4 rotate-90 sm:rotate-0" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">New mode</div>
          <div className="truncate text-sm font-semibold text-foreground">
            {nextLabel}
          </div>
        </div>
      </div>
    </div>
  );
}
