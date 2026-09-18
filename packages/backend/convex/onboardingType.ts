export const ONBOARDING_TYPES = [
  "inviteOnly",
  "publicWaitlist",
  "publicSignup",
] as const;

export type OnboardingType = (typeof ONBOARDING_TYPES)[number];

export const DEFAULT_ONBOARDING_TYPE: OnboardingType = "inviteOnly";

export function isOnboardingType(value: string): value is OnboardingType {
  return (ONBOARDING_TYPES as readonly string[]).includes(value);
}

function fromLegacyValue(value: string): OnboardingType | null {
  if (value === "none") return "inviteOnly";
  if (value === "waitlist") return "publicWaitlist";
  if (value === "signup") return "publicSignup";
  return null;
}

export function parseOnboardingType(value: unknown): OnboardingType {
  if (typeof value === "string") {
    if (isOnboardingType(value)) return value;

    const mapped = fromLegacyValue(value);
    if (mapped) return mapped;

    try {
      const parsed = JSON.parse(value);
      if (parsed !== value) return parseOnboardingType(parsed);
    } catch {
      // Non-JSON string values fall back to default.
    }
  }
  return DEFAULT_ONBOARDING_TYPE;
}

export function isWaitlistOnboarding(value: OnboardingType): boolean {
  return value === "publicWaitlist";
}

export function isSignupOnboarding(value: OnboardingType): boolean {
  return value === "publicSignup";
}

export function isInviteOnlyOnboarding(value: OnboardingType): boolean {
  return value === "inviteOnly";
}
