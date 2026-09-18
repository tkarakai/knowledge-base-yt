"use client";

import * as React from "react";

import { cn } from "../lib/utils";
import { formatCrackTime } from "../lib/password-validation";

export type PasswordStrengthTranslateFn = (
  key: string,
  params?: Record<string, string | number>,
) => string;

/** Shape of the server-side password strength evaluation result. */
export interface PasswordStrengthResult {
  valid: boolean;
  score: number;
  warningKey: string | null;
  suggestionKeys: string[];
  crackTimeSeconds: number;
  tooShort: boolean;
  minLength: number;
}

const SCORE_COLORS = [
  "bg-destructive", // 0 — very weak
  "bg-destructive", // 1 — weak
  "bg-orange-500", // 2 — fair
  "bg-yellow-500", // 3 — good
  "bg-green-600", // 4 — strong
] as const;

const SCORE_LABEL_KEYS = [
  "labels.veryWeak",
  "labels.weak",
  "labels.fair",
  "labels.good",
  "labels.strong",
] as const;

export interface PasswordStrengthMeterProps {
  /** Result from the server-side passwordStrength.evaluate query. */
  result: PasswordStrengthResult | null | undefined;
  /** The current password value — enables ghost/stale placeholders to prevent layout shift. */
  password: string;
  t: PasswordStrengthTranslateFn;
}

function PasswordStrengthMeter({
  result,
  password,
  t,
}: PasswordStrengthMeterProps): React.ReactNode {
  // Track the last valid result so we can show it (faded) while loading.
  const lastResultRef = React.useRef<PasswordStrengthResult | null>(null);

  if (result) {
    lastResultRef.current = result;
  }
  if (!password) {
    lastResultRef.current = null;
  }

  // Nothing to show when the password field is empty.
  if (!password) return null;

  const displayResult = result ?? lastResultRef.current;
  // fresh = current result available; stale = showing old result while loading; ghost = no result yet
  const isStale = !result && !!displayResult;
  const isGhost = !displayResult;

  const barColor = displayResult ? SCORE_COLORS[displayResult.score] : undefined;
  const barWidth = displayResult ? ((displayResult.score + 1) / 5) * 100 : 0;
  const label = displayResult ? t(SCORE_LABEL_KEYS[displayResult.score]) : "";

  // Build feedback parts
  const feedbackParts: string[] = [];
  if (displayResult) {
    if (displayResult.tooShort) {
      feedbackParts.push(t("minLength", { count: displayResult.minLength }));
    }
    if (displayResult.warningKey) {
      feedbackParts.push(t(displayResult.warningKey));
    }
    for (const key of displayResult.suggestionKeys) {
      feedbackParts.push(t(key));
    }
  }
  const feedback = feedbackParts.join(" ");

  const crackTime =
    displayResult && displayResult.crackTimeSeconds > 0
      ? formatCrackTime(displayResult.crackTimeSeconds, t)
      : null;

  return (
    <div
      className={cn(
        "space-y-1.5 transition-opacity duration-300",
        isStale && "opacity-50",
      )}
    >
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted",
            isGhost && "animate-pulse",
          )}
        >
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300 ease-out",
              barColor,
            )}
            style={{ width: `${barWidth}%` }}
          />
        </div>
        <span className="text-xs font-medium text-muted-foreground min-w-[4rem] text-right">
          {label}
        </span>
      </div>

      {/* Crack time */}
      {crackTime ? (
        <p className="text-xs text-muted-foreground">
          {t("crackTimeLabel", { time: crackTime })}
        </p>
      ) : null}

      {/* Feedback */}
      {feedback ? (
        <p className="text-xs text-muted-foreground">{feedback}</p>
      ) : null}
    </div>
  );
}

export { PasswordStrengthMeter };
