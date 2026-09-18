"use client";

import * as React from "react";
import { Label, PasswordInput } from "@repo/design-system";
import {
  PasswordStrengthMeter,
  type PasswordStrengthResult,
} from "@repo/design-system/password-strength";
import { DemoSection } from "@/components/demo-section";

/** Simple pass-through translate function for storybook (no i18n). */
const LABELS: Record<string, string> = {
  "labels.veryWeak": "Very Weak",
  "labels.weak": "Weak",
  "labels.fair": "Fair",
  "labels.good": "Good",
  "labels.strong": "Strong",
  crackTimeLabel: "Estimated crack time: {time}",
  minLength: "Minimum {count} characters required.",
  strengthRequirement: "Password must be strong.",
  "warnings.straightRow": "Straight rows of keys on your keyboard are easy to guess.",
  "warnings.keyPattern": "Short keyboard patterns are easy to guess.",
  "warnings.simpleRepeat": "Repeated characters like \"aaa\" are easy to guess.",
  "warnings.extendedRepeat": "Repeated character patterns like \"abcabcabc\" are easy to guess.",
  "warnings.sequences": "Common character sequences like \"abc\" are easy to guess.",
  "warnings.recentYears": "Recent years are easy to guess.",
  "warnings.dates": "Dates are often easy to guess.",
  "warnings.topTen": "This is a heavily used password.",
  "warnings.topHundred": "This is a frequently used password.",
  "warnings.common": "This is a commonly used password.",
  "warnings.similarToCommon": "This is similar to a commonly used password.",
  "warnings.wordByItself": "Single words are easy to guess.",
  "warnings.namesByThemselves": "Single names or surnames are easy to guess.",
  "warnings.commonNames": "Common names and surnames are easy to guess.",
  "warnings.userInputs": "There should be no personal or page-related data.",
  "warnings.pwned": "This password has been exposed in a data breach.",
  "suggestions.l33t": "Avoid predictable letter substitutions like \"@\" for \"a\".",
  "suggestions.reverseWords": "Avoid reversed spellings of common words.",
  "suggestions.allUppercase": "Capitalize some but not all letters.",
  "suggestions.capitalization": "Capitalize more than the first letter.",
  "suggestions.dates": "Avoid dates and years associated with you.",
  "suggestions.recentYears": "Avoid recent years.",
  "suggestions.associatedYears": "Avoid years associated with you.",
  "suggestions.sequences": "Avoid common character sequences.",
  "suggestions.repeated": "Avoid repeated words and characters.",
  "suggestions.longerKeyboardPattern": "Use longer keyboard patterns and change typing direction multiple times.",
  "suggestions.anotherWord": "Add more words that are less common.",
  "suggestions.useWords": "Use multiple words, but avoid common phrases.",
  "suggestions.noNeed": "You can create strong passwords without using symbols, numbers, or uppercase letters.",
  "suggestions.pwned": "If you use this password elsewhere, you should change it.",
  "timeEstimation.ltSecond": "less than a second",
  "timeEstimation.second": "{base} second",
  "timeEstimation.seconds": "{base} seconds",
  "timeEstimation.minute": "{base} minute",
  "timeEstimation.minutes": "{base} minutes",
  "timeEstimation.hour": "{base} hour",
  "timeEstimation.hours": "{base} hours",
  "timeEstimation.day": "{base} day",
  "timeEstimation.days": "{base} days",
  "timeEstimation.month": "{base} month",
  "timeEstimation.months": "{base} months",
  "timeEstimation.year": "{base} year",
  "timeEstimation.years": "{base} years",
  "timeEstimation.centuries": "centuries",
};

function t(key: string, params?: Record<string, string | number>): string {
  let text = LABELS[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}

/** Mock results that simulate what the server-side query would return. */
const MOCK_RESULTS: { label: string; result: PasswordStrengthResult }[] = [
  {
    label: "Very Weak — \"password\"",
    result: {
      valid: false,
      score: 0,
      warningKey: "warnings.topTen",
      suggestionKeys: ["suggestions.anotherWord"],
      crackTimeSeconds: 0.001,
      tooShort: false,
      minLength: 12,
    },
  },
  {
    label: "Weak — \"MyP@ss123!ab\"",
    result: {
      valid: false,
      score: 1,
      warningKey: "warnings.similarToCommon",
      suggestionKeys: ["suggestions.anotherWord"],
      crackTimeSeconds: 120,
      tooShort: false,
      minLength: 12,
    },
  },
  {
    label: "Fair — \"sunflower-cake99\"",
    result: {
      valid: false,
      score: 2,
      warningKey: null,
      suggestionKeys: ["suggestions.anotherWord"],
      crackTimeSeconds: 86400,
      tooShort: false,
      minLength: 12,
    },
  },
  {
    label: "Good — \"correct-horse-battery\"",
    result: {
      valid: false,
      score: 3,
      warningKey: null,
      suggestionKeys: [],
      crackTimeSeconds: 31536000,
      tooShort: false,
      minLength: 12,
    },
  },
  {
    label: "Strong — \"correct-horse-battery-staple-xyz\"",
    result: {
      valid: true,
      score: 4,
      warningKey: null,
      suggestionKeys: [],
      crackTimeSeconds: 3153600000,
      tooShort: false,
      minLength: 12,
    },
  },
  {
    label: "Too Short (admin role, min 40)",
    result: {
      valid: false,
      score: 2,
      warningKey: null,
      suggestionKeys: [],
      crackTimeSeconds: 86400,
      tooShort: true,
      minLength: 40,
    },
  },
];

function StaticDemo({ label, result }: { label: string; result: PasswordStrengthResult }) {
  return (
    <div className="max-w-md space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <PasswordStrengthMeter result={result} password="demo" t={t} />
      <div className="rounded-md border bg-muted/50 p-3 text-xs font-mono space-y-1">
        <p>valid: <span className={result.valid ? "text-green-600" : "text-destructive"}>{String(result.valid)}</span></p>
        <p>score: {result.score}/4</p>
        <p>crackTimeSeconds: {result.crackTimeSeconds.toLocaleString()}</p>
        {result.warningKey ? <p>warning: {result.warningKey}</p> : null}
        {result.suggestionKeys.length > 0 ? (
          <p>suggestions: {result.suggestionKeys.join(", ")}</p>
        ) : null}
      </div>
    </div>
  );
}

function InteractiveDemo() {
  const [password, setPassword] = React.useState("");
  const [selectedScore, setSelectedScore] = React.useState(0);

  // Simulate server result based on selected score
  const mockResult: PasswordStrengthResult | null = password
    ? {
        valid: selectedScore >= 4,
        score: selectedScore,
        warningKey: selectedScore <= 1 ? "warnings.common" : null,
        suggestionKeys: selectedScore <= 2 ? ["suggestions.anotherWord"] : [],
        crackTimeSeconds: [0.001, 120, 86400, 31536000, 3153600000][selectedScore],
        tooShort: password.length < 12,
        minLength: 12,
      }
    : null;

  return (
    <div className="max-w-md space-y-3">
      <div className="space-y-2">
        <Label htmlFor="demo-password">Password</Label>
        <PasswordInput
          id="demo-password"
          placeholder="Type something to see the meter…"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordStrengthMeter result={mockResult} password={password} t={t} />
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor="demo-score" className="text-sm whitespace-nowrap">Simulated score:</Label>
        <select
          id="demo-score"
          className="rounded border bg-background px-2 py-1 text-sm"
          value={selectedScore}
          onChange={(e) => setSelectedScore(Number(e.target.value))}
        >
          <option value={0}>0 — Very Weak</option>
          <option value={1}>1 — Weak</option>
          <option value={2}>2 — Fair</option>
          <option value={3}>3 — Good</option>
          <option value={4}>4 — Strong</option>
        </select>
      </div>
      <p className="text-xs text-muted-foreground">
        In production, the score comes from the server-side zxcvbn evaluation via Convex query.
        This demo uses a mock score selector.
      </p>
    </div>
  );
}

export default function PasswordStrengthMeterShowcase() {
  return (
    <>
      <DemoSection title="Strength Levels">
        <div className="space-y-6">
          {MOCK_RESULTS.map((item) => (
            <StaticDemo key={item.label} label={item.label} result={item.result} />
          ))}
        </div>
      </DemoSection>

      <DemoSection title="Interactive Demo (Mocked)">
        <InteractiveDemo />
      </DemoSection>
    </>
  );
}
