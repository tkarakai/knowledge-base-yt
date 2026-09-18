import { describe, expect, test } from "vitest";

import {
  ADMIN_EMAIL_VERIFICATION_REQUIRED_KEY,
  ADMIN_MFA_REQUIRED_KEY,
  ADMIN_PASSKEY_POLICY_KEY,
  USER_EMAIL_VERIFICATION_REQUIRED_KEY,
  USER_MFA_REQUIRED_KEY,
  USER_PASSKEY_POLICY_KEY,
  getEmailVerificationRequiredKey,
  getMfaRequiredKey,
  getPasskeyPolicyKey,
  getPolicyScopeFromRole,
  isPasskeyPolicy,
  parsePasskeyPolicy,
} from "./securityPolicies";

describe("securityPolicies helpers", () => {
  test("maps role to policy scope", () => {
    expect(getPolicyScopeFromRole("admin")).toBe("admin");
    expect(getPolicyScopeFromRole("user")).toBe("user");
    expect(getPolicyScopeFromRole(undefined)).toBe("user");
  });

  test("passkey policy guards and parsing", () => {
    expect(isPasskeyPolicy("disabled")).toBe(true);
    expect(isPasskeyPolicy("optional")).toBe(true);
    expect(isPasskeyPolicy("required")).toBe(true);
    expect(isPasskeyPolicy("unknown")).toBe(false);

    expect(parsePasskeyPolicy("disabled")).toBe("disabled");
    expect(parsePasskeyPolicy("required")).toBe("required");
    expect(parsePasskeyPolicy("unknown")).toBe("optional");
  });

  test("returns scope-specific settings keys", () => {
    expect(getEmailVerificationRequiredKey("user")).toBe(
      USER_EMAIL_VERIFICATION_REQUIRED_KEY
    );
    expect(getEmailVerificationRequiredKey("admin")).toBe(
      ADMIN_EMAIL_VERIFICATION_REQUIRED_KEY
    );
    expect(getMfaRequiredKey("user")).toBe(USER_MFA_REQUIRED_KEY);
    expect(getMfaRequiredKey("admin")).toBe(ADMIN_MFA_REQUIRED_KEY);
    expect(getPasskeyPolicyKey("user")).toBe(USER_PASSKEY_POLICY_KEY);
    expect(getPasskeyPolicyKey("admin")).toBe(ADMIN_PASSKEY_POLICY_KEY);
  });
});
