import { zxcvbn, zxcvbnOptions } from "@zxcvbn-ts/core";
import * as zxcvbnCommonPackage from "@zxcvbn-ts/language-common";
import * as zxcvbnEnPackage from "@zxcvbn-ts/language-en";
import { v } from "convex/values";

import { query } from "./_generated/server";

// Use key-path translations so zxcvbn returns translatable keys
// instead of hardcoded English strings.
const KEY_TRANSLATIONS: typeof zxcvbnEnPackage.translations = {
  warnings: {
    straightRow: "warnings.straightRow",
    keyPattern: "warnings.keyPattern",
    simpleRepeat: "warnings.simpleRepeat",
    extendedRepeat: "warnings.extendedRepeat",
    sequences: "warnings.sequences",
    recentYears: "warnings.recentYears",
    dates: "warnings.dates",
    topTen: "warnings.topTen",
    topHundred: "warnings.topHundred",
    common: "warnings.common",
    similarToCommon: "warnings.similarToCommon",
    wordByItself: "warnings.wordByItself",
    namesByThemselves: "warnings.namesByThemselves",
    commonNames: "warnings.commonNames",
    userInputs: "warnings.userInputs",
    pwned: "warnings.pwned",
  },
  suggestions: {
    l33t: "suggestions.l33t",
    reverseWords: "suggestions.reverseWords",
    allUppercase: "suggestions.allUppercase",
    capitalization: "suggestions.capitalization",
    dates: "suggestions.dates",
    recentYears: "suggestions.recentYears",
    associatedYears: "suggestions.associatedYears",
    sequences: "suggestions.sequences",
    repeated: "suggestions.repeated",
    longerKeyboardPattern: "suggestions.longerKeyboardPattern",
    anotherWord: "suggestions.anotherWord",
    useWords: "suggestions.useWords",
    noNeed: "suggestions.noNeed",
    pwned: "suggestions.pwned",
  },
  timeEstimation: {
    ltSecond: "timeEstimation.ltSecond",
    second: "timeEstimation.second",
    seconds: "timeEstimation.seconds",
    minute: "timeEstimation.minute",
    minutes: "timeEstimation.minutes",
    hour: "timeEstimation.hour",
    hours: "timeEstimation.hours",
    day: "timeEstimation.day",
    days: "timeEstimation.days",
    month: "timeEstimation.month",
    months: "timeEstimation.months",
    year: "timeEstimation.year",
    years: "timeEstimation.years",
    centuries: "timeEstimation.centuries",
  },
};

let optionsLoaded = false;

function ensureOptions(): void {
  if (optionsLoaded) return;
  zxcvbnOptions.setOptions({
    graphs: zxcvbnCommonPackage.adjacencyGraphs,
    dictionary: {
      ...zxcvbnCommonPackage.dictionary,
      ...zxcvbnEnPackage.dictionary,
    },
    translations: KEY_TRANSLATIONS,
  });
  optionsLoaded = true;
}

const MIN_LENGTHS = { admin: 40, user: 12 } as const;
const REQUIRED_SCORE = 4;

/**
 * Evaluate password strength server-side via reactive query.
 * Clients call this with a debounced password to get real-time feedback
 * without shipping the ~8MB zxcvbn dictionaries to the browser.
 */
export const evaluate = query({
  args: {
    password: v.string(),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("user")),
  },
  handler: async (_ctx, { password, email, role }) => {
    ensureOptions();

    const minLength = MIN_LENGTHS[role];

    if (!password) {
      return null;
    }

    const userInputs = [email, role, "admin", "user"];
    const emailParts = email.split(/[@.+]/);
    userInputs.push(...emailParts.filter((p) => p.length > 2));

    const result = zxcvbn(password, userInputs);

    const tooShort = password.length < minLength;
    const scoreTooLow = result.score < REQUIRED_SCORE;
    const effectiveScore = tooShort
      ? Math.min(result.score, 2)
      : result.score;

    return {
      valid: !tooShort && !scoreTooLow,
      score: effectiveScore,
      warningKey: result.feedback.warning || null,
      suggestionKeys: result.feedback.suggestions,
      crackTimeSeconds:
        result.crackTimesSeconds.offlineSlowHashing1e4PerSecond as number,
      tooShort,
      minLength,
    };
  },
});

/**
 * Internal validation used by the passwordStrengthPlugin in auth.ts.
 * Not a Convex function — called directly within the plugin's onRequest handler.
 */
export function validatePasswordStrength(
  password: string,
  email: string,
  role: "admin" | "user",
): { valid: boolean; reason?: string } {
  ensureOptions();

  const minLength = MIN_LENGTHS[role];
  if (password.length < minLength) {
    return {
      valid: false,
      reason: `Password must be at least ${minLength} characters`,
    };
  }

  const userInputs = [email, role, "admin", "user"];
  const emailParts = email.split(/[@.+]/);
  userInputs.push(...emailParts.filter((p) => p.length > 2));

  const result = zxcvbn(password, userInputs);
  if (result.score < REQUIRED_SCORE) {
    return { valid: false, reason: "Password is not strong enough" };
  }

  return { valid: true };
}
