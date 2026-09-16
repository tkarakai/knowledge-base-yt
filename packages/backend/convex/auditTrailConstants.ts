// ---------------------------------------------------------------------------
// Audit Trail Enums
//
// All enums use hierarchical dot notation. Dots separate hierarchy levels,
// underscores separate words within a level.
//
// Actions describe WHAT happened (never the outcome).
// Statuses describe THE OUTCOME (never the action).
//
// These enums are runtime-enforced by the audit trail. Adding a new value
// here is all that's needed — old values in the database are unaffected.
// ---------------------------------------------------------------------------

export const AUDIT_ACTIONS = [
  // auth.*
  "auth.sign_in",
  "auth.sign_in.requested",
  "auth.sign_out",
  "auth.sign_up",
  "auth.sign_up.requested",
  "auth.password_reset.requested",
  "auth.password_reset.completed",
  "auth.password_changed",
  "auth.email_verified",
  "auth.email_verification.requested",
  "auth.two_factor.setup_started",
  "auth.two_factor.enabled",
  "auth.two_factor.disabled",
  "auth.two_factor.verify_totp",
  "auth.two_factor.verify_backup_code",
  "auth.two_factor.backup_codes_regenerated",
  "auth.passkey.added",
  "auth.passkey.renamed",
  "auth.passkey.deleted",
  "auth.passkey.sign_in",
  "auth.session.revoked",
  "auth.session.revoked_all",

  // user.*
  "user.profile_updated",
  "user.name_changed",
  "user.avatar_changed",

  // admin.*
  "admin.user.banned",
  "admin.user.unbanned",
  "admin.user.deleted",
  "admin.role_changed",
  "admin.mfa_policy_changed",
  "admin.email_verification_policy_changed",
  "admin.user_mfa_policy_changed",
  "admin.admin_mfa_policy_changed",
  "admin.user_email_verification_policy_changed",
  "admin.admin_email_verification_policy_changed",
  "admin.user_magic_link_policy_changed",
  "admin.user_passkey_policy_changed",
  "admin.admin_passkey_policy_changed",
  "admin.waitlist_setting_changed",
  "announcement.created",
  "announcement.updated",
  "announcement.deleted",
  "announcement.live_enabled",
  "announcement.live_disabled",
  "announcement.publish_scheduled",
  "announcement.publish_canceled",
  "announcement.published",
  "announcement.publish_noop",
  "announcement.unpublish_scheduled",
  "announcement.unpublished",
  "announcement.unpublish_noop",
  "admin.session.revoked",
  "admin.session.revoked_all",
  "admin.invitation.sent",
  "admin.invitation.revoked",
  "admin.invitation.deleted",

  // admin.onboarding.*
  "admin.onboarding.account_created",
  "admin.onboarding.totp_configured",
  "admin.onboarding.backup_codes_acknowledged",
  "admin.onboarding.passkey_registered",
  "admin.onboarding.passkey_skipped",
  "admin.onboarding.completed",

  // waitlist.*
  "waitlist.joined",
  "waitlist.invitation.sent",
  "waitlist.invitation.revoked",
  "waitlist.entry.deleted",

  // waitlist.token.*
  "waitlist.token.claimed",
  "waitlist.token.released",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_STATUSES = [
  // success
  "succeeded",

  // failed.*
  "failed.wrong_password",
  "failed.invalid_period",
  "failed.not_found",
  "failed.unauthorized",
  "failed.validation_error",
  "failed.rate_limited",
  "failed.internal_error",
  "failed.expired",
  "failed.already_used",
  "failed.blocked",
  "failed.invalid_code",
  "failed.unknown",
] as const;

export type AuditStatus = (typeof AUDIT_STATUSES)[number];

export const AUDIT_SOURCE_TRANSPORTS = ["web", "server"] as const;

export type AuditSourceTransport = (typeof AUDIT_SOURCE_TRANSPORTS)[number];
