export type OnboardingPolicy = "inviteOnly" | "publicWaitlist" | "publicSignup";

const ONBOARDING_POLICY_LABELS: Record<OnboardingPolicy, string> = {
  inviteOnly: "Invite Only",
  publicWaitlist: "Public Waitlist",
  publicSignup: "Public Self-Signup",
};

export function normalizeOnboardingPolicy(value: unknown): OnboardingPolicy {
  if (value === "publicWaitlist" || value === "waitlist") {
    return "publicWaitlist";
  }
  if (value === "publicSignup" || value === "signup") {
    return "publicSignup";
  }
  if (value === "inviteOnly") {
    return "inviteOnly";
  }
  return "inviteOnly";
}

export function getOnboardingPolicyLabel(policy: OnboardingPolicy): string {
  return ONBOARDING_POLICY_LABELS[policy];
}

export function getOnboardingChangeCopy(
  current: OnboardingPolicy,
  next: OnboardingPolicy
): {
  title: string;
  currentLabel: string;
  nextLabel: string;
  confirmLabel: string;
} {
  const currentLabel = getOnboardingPolicyLabel(current);
  const nextLabel = getOnboardingPolicyLabel(next);

  return {
    title: "Change onboarding mode?",
    currentLabel,
    nextLabel,
    confirmLabel: `Switch to ${nextLabel}`,
  };
}
