"use client";

import * as React from "react";
import { Check } from "lucide-react";

import { cn } from "@repo/design-system";

interface OnboardingStepIndicatorProps {
  /** 0-indexed current step (-1 means no step is active yet, e.g. intro screen) */
  currentStep: number;
  /** Short labels displayed below each circle */
  labels: string[];
}

/**
 * Visual progress indicator for the admin onboarding wizard.
 *
 * Renders circles connected by lines. Completed steps show a checkmark,
 * the current step is highlighted, and upcoming steps are dimmed.
 */
export function OnboardingStepIndicator({
  currentStep,
  labels,
}: OnboardingStepIndicatorProps) {
  return (
    <nav aria-label="Onboarding progress" className="flex items-start w-full">
      {labels.map((label, i) => {
        const completed = i < currentStep;
        const current = i === currentStep;

        return (
          <React.Fragment key={i}>
            {/* Step column: circle + label */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex shrink-0 items-center justify-center w-8 h-8 rounded-full border-2 text-sm font-medium transition-colors",
                  completed &&
                    "bg-primary border-primary text-primary-foreground",
                  current && "border-primary text-primary",
                  !completed &&
                    !current &&
                    "border-muted-foreground/30 text-muted-foreground/50",
                )}
                aria-current={current ? "step" : undefined}
              >
                {completed ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-[11px] text-center whitespace-nowrap leading-tight",
                  completed
                    ? "text-muted-foreground"
                    : current
                      ? "text-foreground font-medium"
                      : "text-muted-foreground/60",
                )}
              >
                {label}
              </span>
            </div>

            {/* Connector line between circles */}
            {i < labels.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-0.5 mt-4 mx-1 rounded-full",
                  completed ? "bg-primary" : "bg-border",
                )}
                aria-hidden
              />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
