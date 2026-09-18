export type PolicyScope = "admin" | "user";

export const PASSKEY_POLICIES = [
  "disabled",
  "optional",
  "required",
] as const;

export type PasskeyPolicy = (typeof PASSKEY_POLICIES)[number];

export const USER_EMAIL_VERIFICATION_REQUIRED_KEY =
  "userEmailVerificationRequired";
export const ADMIN_EMAIL_VERIFICATION_REQUIRED_KEY =
  "adminEmailVerificationRequired";
export const USER_MFA_REQUIRED_KEY = "userMfaRequired";
export const ADMIN_MFA_REQUIRED_KEY = "adminMfaRequired";
export const USER_PASSKEY_POLICY_KEY = "userPasskeyPolicy";
export const ADMIN_PASSKEY_POLICY_KEY = "adminPasskeyPolicy";

export const USER_MAGIC_LINK_ENABLED_KEY = "userMagicLinkEnabled";

export const LEGACY_EMAIL_VERIFICATION_REQUIRED_KEY = "emailVerificationRequired";
export const LEGACY_MFA_REQUIRED_KEY = "emailMfaRequired";

export function isPasskeyPolicy(value: string): value is PasskeyPolicy {
  return (PASSKEY_POLICIES as readonly string[]).includes(value);
}

export function parsePasskeyPolicy(value: unknown): PasskeyPolicy {
  return isPasskeyPolicy(String(value)) ? (value as PasskeyPolicy) : "optional";
}

export function getPolicyScopeFromRole(role: unknown): PolicyScope {
  return role === "admin" ? "admin" : "user";
}

export function getEmailVerificationRequiredKey(scope: PolicyScope): string {
  return scope === "admin"
    ? ADMIN_EMAIL_VERIFICATION_REQUIRED_KEY
    : USER_EMAIL_VERIFICATION_REQUIRED_KEY;
}

export function getMfaRequiredKey(scope: PolicyScope): string {
  return scope === "admin" ? ADMIN_MFA_REQUIRED_KEY : USER_MFA_REQUIRED_KEY;
}

export function getPasskeyPolicyKey(scope: PolicyScope): string {
  return scope === "admin" ? ADMIN_PASSKEY_POLICY_KEY : USER_PASSKEY_POLICY_KEY;
}
