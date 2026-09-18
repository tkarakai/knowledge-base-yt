/**
 * Admin bootstrap — first-time deployment setup.
 *
 * When a fresh Convex project is deployed, the database is empty: no admin
 * emails, no waitlist entries, no invitation tokens. These internal functions
 * let an operator seed the first admin from the Convex dashboard without
 * needing a UI.
 *
 * ## Functions
 *
 * - **initialize** — Seeds the first admin email, creates a waitlist entry,
 *   and sends an invitation token. Can only run once (guards against an
 *   existing `adminEmails` row).
 *
 * - **rescue** — Fixes a failed bootstrap (typo in email, expired token,
 *   etc.). Updates the admin email if needed, revokes old tokens, and resends
 *   a fresh invitation. Cannot run after the admin has already claimed the
 *   invite.
 *
 * - **status** — Read-only diagnostic that reports the current bootstrap state
 *   and an actionable hint (e.g. "token expired — run rescue").
 *
 * ## Usage (Convex dashboard → Functions → Run)
 *
 * ```
 * bootstrap:initialize  { "email": "you@example.com" }
 * bootstrap:status      {}
 * bootstrap:rescue      { "currentEmail": "typo@...", "newEmail": "correct@..." }
 * ```
 *
 * All three functions are `internalMutation`/`internalQuery` — they are **not**
 * callable from the client. Run them from the Convex dashboard or via
 * `bunx convex run`.
 *
 * @module
 */
import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalMutation, internalQuery } from "./_generated/server";
import { assertMaxLength, MAX_NAME_LENGTH } from "./functions";

/** Synthetic meta for bootstrap waitlist entries (valid per waitlist.ts validation). */
const BOOTSTRAP_META = JSON.stringify({
  superpowers: ["coffee-to-code"],
  excitement: ["take-my-money"],
});

/** Basic email format check — must contain @ and be reasonable length. */
function assertValidEmail(email: string): void {
  assertMaxLength(email, MAX_NAME_LENGTH, "EMAIL");
  if (!email.includes("@") || email.length < 3) {
    throw new Error("BOOTSTRAP_INVALID_EMAIL");
  }
}

// ---------------------------------------------------------------------------
// bootstrap:initialize — first-time admin setup
// ---------------------------------------------------------------------------

export const initialize = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("adminEmails").collect();
    if (existing.length > 0) {
      throw new Error("BOOTSTRAP_ALREADY_INITIALIZED");
    }

    assertValidEmail(args.email);

    // Guard: no existing waitlist entry for this email (prevents duplicates
    // that rescue's .first() would silently mishandle)
    const existingEntry = await ctx.db
      .query("waitlistEntries")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (existingEntry) {
      throw new Error("BOOTSTRAP_DUPLICATE_WAITLIST_ENTRY");
    }

    // Seed the admin email
    await ctx.db.insert("adminEmails", { email: args.email });

    // Create a waitlist entry and immediately invite
    const now = Date.now();
    const entryId = await ctx.db.insert("waitlistEntries", {
      email: args.email,
      meta: BOOTSTRAP_META,
      status: "waiting",
      createdAt: now,
    });

    await ctx.db.patch(entryId, {
      status: "invited",
      invitedAt: now,
    });

    // Schedule the token generation + email action (same as waitlist.invite)
    await ctx.scheduler.runAfter(
      0,
      internal.waitlistActions.generateTokenAndSendEmail,
      { entryId, email: args.email },
    );

    return {
      success: true,
      email: args.email,
      message: `Invitation sent to ${args.email}. Check inbox (or Convex dashboard logs if no RESEND_API_KEY).`,
    };
  },
});

// ---------------------------------------------------------------------------
// bootstrap:rescue — fix a failed bootstrap (typo, expired token, etc.)
// ---------------------------------------------------------------------------

export const rescue = internalMutation({
  args: {
    currentEmail: v.string(),
    newEmail: v.string(),
  },
  handler: async (ctx, args) => {
    // Guard: exactly one admin email must exist
    const adminEmails = await ctx.db.query("adminEmails").collect();
    if (adminEmails.length === 0) {
      throw new Error("BOOTSTRAP_NOT_INITIALIZED");
    }
    if (adminEmails.length > 1) {
      throw new Error("BOOTSTRAP_MULTIPLE_ADMINS");
    }

    // Guard: caller must prove they know the current email
    const adminRow = adminEmails[0];
    if (adminRow.email !== args.currentEmail) {
      throw new Error("BOOTSTRAP_EMAIL_MISMATCH");
    }

    // Guard: bootstrap must not already be complete
    const waitlistEntry = await ctx.db
      .query("waitlistEntries")
      .withIndex("by_email", (q) => q.eq("email", args.currentEmail))
      .first();

    if (waitlistEntry && waitlistEntry.status === "claimed") {
      throw new Error("BOOTSTRAP_ALREADY_COMPLETE");
    }

    assertValidEmail(args.newEmail);

    const emailChanged = args.newEmail !== args.currentEmail;

    // Guard: no existing waitlist entry for the new email (prevents duplicates
    // when changing email to one that's already on the waitlist)
    if (emailChanged) {
      const existingNewEntry = await ctx.db
        .query("waitlistEntries")
        .withIndex("by_email", (q) => q.eq("email", args.newEmail))
        .first();
      if (existingNewEntry) {
        throw new Error("BOOTSTRAP_DUPLICATE_WAITLIST_ENTRY");
      }
    }

    // Update admin email if changed
    if (emailChanged) {
      await ctx.db.patch(adminRow._id, { email: args.newEmail });
    }

    // Revoke all existing tokens for the old email
    const oldTokens = await ctx.db
      .query("invitationTokens")
      .withIndex("by_email", (q) => q.eq("email", args.currentEmail))
      .collect();

    const revokeNow = Date.now();
    for (const token of oldTokens) {
      if (token.status === "sent" || token.status === "claiming") {
        await ctx.db.patch(token._id, { status: "revoked", revokedAt: revokeNow });
      }
    }

    // Handle waitlist entry
    const now = Date.now();
    let entryId;

    if (waitlistEntry) {
      // Reset existing entry
      await ctx.db.patch(waitlistEntry._id, {
        email: args.newEmail,
        status: "waiting",
        invitedAt: undefined,
        invitationExpiresAt: undefined,
      });
      entryId = waitlistEntry._id;
    } else {
      // Edge case: entry was manually deleted — recreate
      entryId = await ctx.db.insert("waitlistEntries", {
        email: args.newEmail,
        meta: BOOTSTRAP_META,
        status: "waiting",
        createdAt: now,
      });
    }

    // Re-invite
    await ctx.db.patch(entryId, {
      status: "invited",
      invitedAt: now,
    });

    await ctx.scheduler.runAfter(
      0,
      internal.waitlistActions.generateTokenAndSendEmail,
      { entryId, email: args.newEmail },
    );

    return {
      success: true,
      email: args.newEmail,
      previousEmail: args.currentEmail,
      changed: emailChanged,
      message: emailChanged
        ? `Admin email updated from ${args.currentEmail} to ${args.newEmail}. New invitation sent.`
        : `Invitation resent to ${args.newEmail}. Check inbox (or Convex dashboard logs if no RESEND_API_KEY).`,
    };
  },
});

// ---------------------------------------------------------------------------
// bootstrap:status — diagnostic for bootstrap state
// ---------------------------------------------------------------------------

export const status = internalQuery({
  args: {},
  handler: async (ctx) => {
    const adminEmails = await ctx.db.query("adminEmails").collect();

    if (adminEmails.length === 0) {
      return {
        bootstrapped: false,
        adminEmail: null,
        waitlistStatus: null,
        tokenStatus: null,
        tokenExpired: null,
        hint: "Run bootstrap:initialize to set up the first admin.",
      };
    }

    const adminEmail = adminEmails[0].email;

    // Check waitlist entry
    const waitlistEntry = await ctx.db
      .query("waitlistEntries")
      .withIndex("by_email", (q) => q.eq("email", adminEmail))
      .first();

    if (waitlistEntry?.status === "claimed") {
      return {
        bootstrapped: true,
        adminEmail,
      };
    }

    // Find the most recent token for this email
    const tokens = await ctx.db
      .query("invitationTokens")
      .withIndex("by_email", (q) => q.eq("email", adminEmail))
      .collect();

    const latestToken = tokens.length > 0
      ? tokens.reduce((a, b) => (a.createdAt > b.createdAt ? a : b))
      : null;

    const now = Date.now();
    const tokenExpired = latestToken ? now > latestToken.expiresAt : null;
    const tokenStatus = latestToken?.status ?? null;

    // Build actionable hint
    let hint: string;
    if (!waitlistEntry) {
      hint = "Waitlist entry is missing. Run bootstrap:rescue to recreate.";
    } else if (!latestToken) {
      hint = "Token generation may have failed. Run bootstrap:rescue to retry.";
    } else if (tokenExpired) {
      hint = "Invitation token expired. Run bootstrap:rescue to resend.";
    } else if (tokenStatus === "revoked") {
      hint = "Invitation was revoked. Run bootstrap:rescue to resend.";
    } else if (tokenStatus === "claiming") {
      hint = "Signup is in progress. The admin is currently completing registration.";
    } else {
      hint = "Invitation is active. Check inbox (or Convex dashboard logs in dev).";
    }

    return {
      bootstrapped: false,
      adminEmail,
      waitlistStatus: waitlistEntry?.status ?? null,
      tokenStatus,
      tokenExpired,
      hint,
    };
  },
});
