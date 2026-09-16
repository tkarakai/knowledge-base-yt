import { v } from "convex/values";

import { internalQuery, query, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { EmailTemplate } from "./emailTemplates";
import { DEFAULT_EMAIL_TEMPLATE, DEFAULT_VERIFICATION_EMAIL_TEMPLATE } from "./emailTemplates";
import type { AuditAction } from "./auditTrailConstants";
import { scheduleAuditEvent } from "./auditTrailHelpers";
import { authedMutation, authedQuery } from "./functions";
import { isOnboardingType, parseOnboardingType } from "./onboardingType";
import {
  ADMIN_EMAIL_VERIFICATION_REQUIRED_KEY,
  ADMIN_MFA_REQUIRED_KEY,
  ADMIN_PASSKEY_POLICY_KEY,
  LEGACY_EMAIL_VERIFICATION_REQUIRED_KEY,
  LEGACY_MFA_REQUIRED_KEY,
  USER_EMAIL_VERIFICATION_REQUIRED_KEY,
  USER_MAGIC_LINK_ENABLED_KEY,
  USER_MFA_REQUIRED_KEY,
  USER_PASSKEY_POLICY_KEY,
  isPasskeyPolicy,
  parsePasskeyPolicy,
} from "./securityPolicies";

/** Keys that unauthenticated callers may read via getPublic. */
const PUBLIC_KEYS = [
  "onboardingType",
  LEGACY_EMAIL_VERIFICATION_REQUIRED_KEY,
  USER_EMAIL_VERIFICATION_REQUIRED_KEY,
  ADMIN_EMAIL_VERIFICATION_REQUIRED_KEY,
  USER_MAGIC_LINK_ENABLED_KEY,
  USER_MFA_REQUIRED_KEY,
  ADMIN_MFA_REQUIRED_KEY,
  USER_PASSKEY_POLICY_KEY,
  ADMIN_PASSKEY_POLICY_KEY,
] as const;

/** All valid setting keys and their value validators. */
const VALID_KEYS = [
  "onboardingType",
  "invitationTokenExpiryDays",
  "invitationEmailTemplate",
  LEGACY_MFA_REQUIRED_KEY,
  LEGACY_EMAIL_VERIFICATION_REQUIRED_KEY,
  USER_MAGIC_LINK_ENABLED_KEY,
  USER_MFA_REQUIRED_KEY,
  ADMIN_MFA_REQUIRED_KEY,
  USER_EMAIL_VERIFICATION_REQUIRED_KEY,
  ADMIN_EMAIL_VERIFICATION_REQUIRED_KEY,
  USER_PASSKEY_POLICY_KEY,
  ADMIN_PASSKEY_POLICY_KEY,
  "emailVerificationTemplate",
] as const;

/** Default values returned when a key has never been set. */
const DEFAULTS: Record<string, unknown> = {
  onboardingType: "inviteOnly",
  invitationTokenExpiryDays: 7,
  [LEGACY_MFA_REQUIRED_KEY]: false,
  [LEGACY_EMAIL_VERIFICATION_REQUIRED_KEY]: true,
  [USER_MAGIC_LINK_ENABLED_KEY]: false,
  [USER_MFA_REQUIRED_KEY]: false,
  [ADMIN_MFA_REQUIRED_KEY]: false,
  [USER_EMAIL_VERIFICATION_REQUIRED_KEY]: true,
  [ADMIN_EMAIL_VERIFICATION_REQUIRED_KEY]: true,
  [USER_PASSKEY_POLICY_KEY]: "optional",
  [ADMIN_PASSKEY_POLICY_KEY]: "optional",
};

function getDefault(key: string): unknown {
  return DEFAULTS[key] ?? null;
}

function parseSettingValue(key: string, value: string): unknown {
  if (key === "onboardingType") {
    return parseOnboardingType(value);
  }
  if (key === USER_PASSKEY_POLICY_KEY || key === ADMIN_PASSKEY_POLICY_KEY) {
    try {
      const parsed = JSON.parse(value);
      return parsePasskeyPolicy(parsed);
    } catch {
      return parsePasskeyPolicy(value);
    }
  }
  return JSON.parse(value);
}

/** Max size for the email template JSON value (50 KB). */
const MAX_TEMPLATE_SIZE = 50_000;

/** Validate the JSON-encoded value for a given key. Throws on invalid input. */
function validateValue(key: string, value: string): void {
  if (key === "onboardingType") {
    if (!isOnboardingType(value)) {
      throw new Error(
        "INVALID_VALUE: onboardingType must be one of 'inviteOnly', 'publicWaitlist', or 'publicSignup'"
      );
    }
  } else if (key === "invitationTokenExpiryDays") {
    const num = parseInt(value, 10);
    if (Number.isNaN(num) || num < 1 || num > 365) {
      throw new Error(
        "INVALID_VALUE: invitationTokenExpiryDays must be an integer between 1 and 365"
      );
    }
  } else if (key === USER_MAGIC_LINK_ENABLED_KEY) {
    if (value !== "true" && value !== "false") {
      throw new Error(
        "INVALID_VALUE: userMagicLinkEnabled must be 'true' or 'false'"
      );
    }
  } else if (
    key === LEGACY_MFA_REQUIRED_KEY ||
    key === USER_MFA_REQUIRED_KEY ||
    key === ADMIN_MFA_REQUIRED_KEY
  ) {
    if (value !== "true" && value !== "false") {
      throw new Error(
        "INVALID_VALUE: mfa required setting must be 'true' or 'false'"
      );
    }
  } else if (
    key === LEGACY_EMAIL_VERIFICATION_REQUIRED_KEY ||
    key === USER_EMAIL_VERIFICATION_REQUIRED_KEY ||
    key === ADMIN_EMAIL_VERIFICATION_REQUIRED_KEY
  ) {
    if (value !== "true" && value !== "false") {
      throw new Error(
        "INVALID_VALUE: email verification required setting must be 'true' or 'false'"
      );
    }
  } else if (key === USER_PASSKEY_POLICY_KEY || key === ADMIN_PASSKEY_POLICY_KEY) {
    if (!isPasskeyPolicy(value)) {
      throw new Error(
        "INVALID_VALUE: passkey policy must be one of 'disabled', 'optional', or 'required'"
      );
    }
  } else if (key === "emailVerificationTemplate") {
    if (value.length > MAX_TEMPLATE_SIZE) {
      throw new Error(
        `INVALID_VALUE: emailVerificationTemplate exceeds ${MAX_TEMPLATE_SIZE} bytes`
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error(
        "INVALID_VALUE: emailVerificationTemplate must be valid JSON"
      );
    }
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>).subject !== "string" ||
      typeof (parsed as Record<string, unknown>).html !== "string" ||
      typeof (parsed as Record<string, unknown>).text !== "string"
    ) {
      throw new Error(
        "INVALID_VALUE: emailVerificationTemplate must have subject, html, and text string fields"
      );
    }
    const tpl = parsed as EmailTemplate;
    if (!tpl.subject.trim()) {
      throw new Error(
        "INVALID_VALUE: emailVerificationTemplate subject cannot be empty"
      );
    }
    if (!tpl.html.includes("{{verification_link}}")) {
      throw new Error(
        "INVALID_VALUE: emailVerificationTemplate html must contain {{verification_link}}"
      );
    }
    if (!tpl.text.includes("{{verification_link}}")) {
      throw new Error(
        "INVALID_VALUE: emailVerificationTemplate text must contain {{verification_link}}"
      );
    }
  } else if (key === "invitationEmailTemplate") {
    if (value.length > MAX_TEMPLATE_SIZE) {
      throw new Error(
        `INVALID_VALUE: invitationEmailTemplate exceeds ${MAX_TEMPLATE_SIZE} bytes`
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error(
        "INVALID_VALUE: invitationEmailTemplate must be valid JSON"
      );
    }
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>).subject !== "string" ||
      typeof (parsed as Record<string, unknown>).html !== "string" ||
      typeof (parsed as Record<string, unknown>).text !== "string"
    ) {
      throw new Error(
        "INVALID_VALUE: invitationEmailTemplate must have subject, html, and text string fields"
      );
    }
    const tpl = parsed as EmailTemplate;
    if (!tpl.subject.trim()) {
      throw new Error(
        "INVALID_VALUE: invitationEmailTemplate subject cannot be empty"
      );
    }
    if (!tpl.html.includes("{{invitation_link}}")) {
      throw new Error(
        "INVALID_VALUE: invitationEmailTemplate html must contain {{invitation_link}}"
      );
    }
    if (!tpl.text.includes("{{invitation_link}}")) {
      throw new Error(
        "INVALID_VALUE: invitationEmailTemplate text must contain {{invitation_link}}"
      );
    }
  }
}

type SettingReadCtx = Pick<QueryCtx, "db">;

async function getSettingRecord(ctx: SettingReadCtx, key: string) {
  return await ctx.db
    .query("appSettings")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique() as Doc<"appSettings"> | null;
}

async function getSettingValueWithFallback(
  ctx: SettingReadCtx,
  key: string,
): Promise<unknown> {
  const setting = await getSettingRecord(ctx, key);

  if (setting) {
    return parseSettingValue(key, setting.value);
  }

  if (key === "onboardingType") {
    const legacyWaitlist = await getSettingRecord(ctx, "waitlistEnabled");
    if (legacyWaitlist) {
      try {
        return JSON.parse(legacyWaitlist.value) === true
          ? "publicWaitlist"
          : "publicSignup";
      } catch {
        return getDefault(key);
      }
    }
  }

  if (key === USER_EMAIL_VERIFICATION_REQUIRED_KEY) {
    const legacy = await getSettingRecord(ctx, LEGACY_EMAIL_VERIFICATION_REQUIRED_KEY);
    if (legacy) {
      return parseSettingValue(LEGACY_EMAIL_VERIFICATION_REQUIRED_KEY, legacy.value);
    }
  }

  if (key === USER_MFA_REQUIRED_KEY) {
    const legacy = await getSettingRecord(ctx, LEGACY_MFA_REQUIRED_KEY);
    if (legacy) {
      return parseSettingValue(LEGACY_MFA_REQUIRED_KEY, legacy.value);
    }
  }

  return getDefault(key);
}

const POLICY_AUDIT_ACTIONS: Partial<Record<string, AuditAction>> = {
  [USER_MAGIC_LINK_ENABLED_KEY]: "admin.user_magic_link_policy_changed",
  [USER_MFA_REQUIRED_KEY]: "admin.user_mfa_policy_changed",
  [ADMIN_MFA_REQUIRED_KEY]: "admin.admin_mfa_policy_changed",
  [USER_EMAIL_VERIFICATION_REQUIRED_KEY]:
    "admin.user_email_verification_policy_changed",
  [ADMIN_EMAIL_VERIFICATION_REQUIRED_KEY]:
    "admin.admin_email_verification_policy_changed",
  [USER_PASSKEY_POLICY_KEY]: "admin.user_passkey_policy_changed",
  [ADMIN_PASSKEY_POLICY_KEY]: "admin.admin_passkey_policy_changed",
};

// ---------------------------------------------------------------------------
// Public query — only for allow-listed keys (used by landing page via httpAction)
// ---------------------------------------------------------------------------

export const getPublic = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    if (!(PUBLIC_KEYS as readonly string[]).includes(args.key)) return null;
    return await getSettingValueWithFallback(ctx, args.key);
  },
});

// ---------------------------------------------------------------------------
// Admin query — read any setting
// ---------------------------------------------------------------------------

export const get = authedQuery({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const role = (ctx.user as Record<string, unknown>).role;
    if (role !== "admin") return null;
    return await getSettingValueWithFallback(ctx, args.key);
  },
});

// ---------------------------------------------------------------------------
// Admin query — get effective email template (custom or default) + isCustom
// ---------------------------------------------------------------------------

export const getEmailTemplate = authedQuery({
  args: {},
  handler: async (ctx) => {
    const role = (ctx.user as Record<string, unknown>).role;
    if (role !== "admin") return null;

    const setting = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "invitationEmailTemplate"))
      .unique();

    if (setting) {
      const template = JSON.parse(setting.value) as EmailTemplate;
      return { ...template, isCustom: true as const };
    }

    return { ...DEFAULT_EMAIL_TEMPLATE, isCustom: false as const };
  },
});

// ---------------------------------------------------------------------------
// Admin query — get effective verification email template (custom or default)
// ---------------------------------------------------------------------------

export const getVerificationEmailTemplate = authedQuery({
  args: {},
  handler: async (ctx) => {
    const role = (ctx.user as Record<string, unknown>).role;
    if (role !== "admin") return null;

    const setting = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "emailVerificationTemplate"))
      .unique();

    if (setting) {
      const template = JSON.parse(setting.value) as EmailTemplate;
      return { ...template, isCustom: true as const };
    }

    return { ...DEFAULT_VERIFICATION_EMAIL_TEMPLATE, isCustom: false as const };
  },
});

// ---------------------------------------------------------------------------
// Admin mutation — upsert a setting
// ---------------------------------------------------------------------------

export const set = authedMutation({
  args: { key: v.string(), value: v.string() },
  handler: async (ctx, args) => {
    const role = (ctx.user as Record<string, unknown>).role;
    if (role !== "admin") throw new Error("NOT_ADMIN");

    if (!(VALID_KEYS as readonly string[]).includes(args.key)) {
      throw new Error("INVALID_SETTING_KEY");
    }

    validateValue(args.key, args.value);

    const existing = await getSettingRecord(ctx, args.key);

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        updatedAt: Date.now(),
        updatedBy: ctx.ownerId,
      });
    } else {
      await ctx.db.insert("appSettings", {
        key: args.key,
        value: args.value,
        updatedAt: Date.now(),
        updatedBy: ctx.ownerId,
      });
    }

    const policyAction = POLICY_AUDIT_ACTIONS[args.key];
    if (policyAction) {
      await scheduleAuditEvent(ctx, {
        happenedAt: Date.now(),
        actor: ctx.ownerId,
        authenticatedUserId: ctx.ownerId,
        sourceDetail: "admin-settings",
        action: policyAction,
        resource: `appSettings:${args.key}`,
        status: "succeeded",
        oldValue: existing?.value,
        newValue: args.value,
      });
    }

    // Cleanup legacy setting once onboardingType is explicitly managed.
    if (args.key === "onboardingType") {
      const legacyWaitlist = await getSettingRecord(ctx, "waitlistEnabled");
      if (legacyWaitlist) {
        await ctx.db.delete(legacyWaitlist._id);
      }
    }
  },
});

// ---------------------------------------------------------------------------
// Admin mutation — remove a setting (resets to default)
// ---------------------------------------------------------------------------

export const remove = authedMutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const role = (ctx.user as Record<string, unknown>).role;
    if (role !== "admin") throw new Error("NOT_ADMIN");

    if (!(VALID_KEYS as readonly string[]).includes(args.key)) {
      throw new Error("INVALID_SETTING_KEY");
    }

    const existing = await getSettingRecord(ctx, args.key);

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    if (args.key === "onboardingType") {
      const legacyWaitlist = await getSettingRecord(ctx, "waitlistEnabled");
      if (legacyWaitlist) {
        await ctx.db.delete(legacyWaitlist._id);
      }
    }
  },
});

// ---------------------------------------------------------------------------
// Internal query — for use in databaseHooks, httpActions, etc.
// ---------------------------------------------------------------------------

export const getInternal = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    return await getSettingValueWithFallback(ctx, args.key);
  },
});
