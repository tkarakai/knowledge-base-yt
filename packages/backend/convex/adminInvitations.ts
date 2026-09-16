import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { scheduleAuditEvent } from "./auditTrailHelpers";
import { authedMutation } from "./functions";
import { sha256Hex } from "./tokenHash";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------------------------------------------------------------------
// Admin query: list admin invitations (paginated)
// ---------------------------------------------------------------------------

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    const role = user ? (user as Record<string, unknown>).role : undefined;
    if (role !== "admin") {
      return {
        page: [],
        isDone: true,
        continueCursor: "",
      };
    }

    const entries = await ctx.db
      .query("adminInvitations")
      .withIndex("by_created")
      .order("desc")
      .paginate(args.paginationOpts);

    const now = Date.now();

    return {
      ...entries,
      page: entries.page.map((entry) => ({
        ...entry,
        invitationExpired:
          entry.status === "invited" &&
          entry.invitationExpiresAt != null &&
          now > entry.invitationExpiresAt,
      })),
    };
  },
});

// ---------------------------------------------------------------------------
// Admin mutation: invite a single email as admin
// ---------------------------------------------------------------------------

export const invite = authedMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const role = (ctx.user as Record<string, unknown>).role;
    if (role !== "admin") throw new Error("NOT_ADMIN");

    const email = args.email.trim().toLowerCase();
    if (!email || !EMAIL_PATTERN.test(email)) {
      throw new Error("INVALID_EMAIL");
    }

    // Check for existing invitation
    const existing = await ctx.db
      .query("adminInvitations")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    let invitationId: string;

    if (existing) {
      if (existing.status === "claimed" || existing.status === "completed") {
        throw new Error("ALREADY_CLAIMED");
      }
      const alreadyInvited =
        existing.status === "invited" &&
        (!existing.invitationExpiresAt ||
          Date.now() <= existing.invitationExpiresAt);
      if (alreadyInvited) {
        throw new Error("ALREADY_INVITED");
      }
      // Re-invite (expired invitation)
      await ctx.db.patch(existing._id, {
        status: "invited",
        invitedAt: Date.now(),
        invitationExpiresAt: undefined,
        token: undefined,
      });
      invitationId = existing._id;
    } else {
      const now = Date.now();
      invitationId = await ctx.db.insert("adminInvitations", {
        email,
        status: "invited",
        invitedAt: now,
        createdAt: now,
      });
    }

    // NOTE: adminEmails is NOT inserted here — it is added only when the
    // invitation token is claimed (claimInvitation), proving token possession.
    // This prevents admin role escalation without the token.

    const actorEmail = (ctx.user as Record<string, unknown>).email as string;
    await scheduleAuditEvent(ctx, {
      actor: actorEmail,
      authenticatedUserId: ctx.ownerId,
      sourceDetail: "admin-mutation",
      action: "admin.invitation.sent",
      resource: `admin-invitation:${email}`,
      status: "succeeded",
      meta: JSON.stringify({ inviteeEmail: email }),
    });

    // Schedule token generation and email sending
    await ctx.scheduler.runAfter(
      0,
      internal.adminInvitationActions.generateTokenAndSendEmail,
      { adminInvitationId: invitationId as never, email }
    );
  },
});

// ---------------------------------------------------------------------------
// Admin mutation: delete admin invitation
// ---------------------------------------------------------------------------

export const remove = authedMutation({
  args: { entryId: v.id("adminInvitations") },
  handler: async (ctx, args) => {
    const role = (ctx.user as Record<string, unknown>).role;
    if (role !== "admin") throw new Error("NOT_ADMIN");

    const entry = await ctx.db.get(args.entryId);
    if (!entry) throw new Error("ENTRY_NOT_FOUND");
    if (entry.status === "claimed" || entry.status === "completed") {
      throw new Error("CANNOT_DELETE_CLAIMED");
    }

    await ctx.db.delete(args.entryId);

    const actorEmail = (ctx.user as Record<string, unknown>).email as string;
    await scheduleAuditEvent(ctx, {
      actor: actorEmail,
      authenticatedUserId: ctx.ownerId,
      sourceDetail: "admin-mutation",
      action: "admin.invitation.deleted",
      resource: `admin-invitation:${args.entryId}`,
      status: "succeeded",
      meta: JSON.stringify({ inviteeEmail: entry.email }),
    });
  },
});

// ---------------------------------------------------------------------------
// Internal: create admin invitation entry (for dev seed)
// ---------------------------------------------------------------------------

export const createForSeed = internalMutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("adminInvitations")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (existing) return;

    const now = Date.now();
    await ctx.db.insert("adminInvitations", {
      email: args.email,
      status: "completed",
      invitedAt: now,
      claimedAt: now,
      createdAt: now,
    });
  },
});

// ---------------------------------------------------------------------------
// Internal: store token hash on invitation row (called by action)
// ---------------------------------------------------------------------------

export const setToken = internalMutation({
  args: {
    adminInvitationId: v.id("adminInvitations"),
    tokenHash: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    // The `token` field stores a SHA-256 hash, not the raw token.
    await ctx.db.patch(args.adminInvitationId, {
      token: args.tokenHash,
      invitationExpiresAt: args.expiresAt,
    });
  },
});

// ---------------------------------------------------------------------------
// Public query: validate an invitation token
// ---------------------------------------------------------------------------

export const validateToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tokenHash = sha256Hex(args.token);
    const doc = await ctx.db
      .query("adminInvitations")
      .withIndex("by_token", (q) => q.eq("token", tokenHash))
      .unique();

    if (!doc) {
      return { valid: false as const, reason: "NOT_FOUND" as const };
    }
    if (doc.status === "claimed" || doc.status === "completed") {
      return { valid: false as const, reason: "ALREADY_CLAIMED" as const };
    }
    if (doc.invitationExpiresAt && Date.now() > doc.invitationExpiresAt) {
      return { valid: false as const, reason: "EXPIRED" as const };
    }

    return { valid: true as const, email: doc.email };
  },
});

// ---------------------------------------------------------------------------
// Public mutation: claim invitation before account creation
// ---------------------------------------------------------------------------

export const claimInvitation = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tokenHash = sha256Hex(args.token);
    const doc = await ctx.db
      .query("adminInvitations")
      .withIndex("by_token", (q) => q.eq("token", tokenHash))
      .unique();

    if (!doc) throw new Error("TOKEN_NOT_FOUND");
    if (doc.status === "claimed" || doc.status === "completed") {
      throw new Error("ALREADY_CLAIMED");
    }
    if (doc.invitationExpiresAt && Date.now() > doc.invitationExpiresAt) {
      throw new Error("TOKEN_EXPIRED");
    }

    await ctx.db.patch(doc._id, {
      status: "claimed",
      claimedAt: Date.now(),
      onboardingStep: 1,
    });

    // Add email to adminEmails so the auth hook auto-promotes to admin on
    // signup. This only happens after token validation — proving possession.
    const existingAdmin = await ctx.db
      .query("adminEmails")
      .withIndex("by_email", (q) => q.eq("email", doc.email))
      .first();
    if (!existingAdmin) {
      await ctx.db.insert("adminEmails", { email: doc.email });
    }
  },
});

// ---------------------------------------------------------------------------
// Authenticated mutation: advance onboarding step
// ---------------------------------------------------------------------------

export const advanceOnboardingStep = mutation({
  args: { step: v.number() },
  handler: async (ctx, args) => {
    // Auth session may not have propagated yet during onboarding (race with
    // Better Auth sign-up). This mutation is non-critical — it only persists
    // the step for resume-on-abandon — so silently bail out if unauthenticated.
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return;

    const doc = await ctx.db
      .query("adminInvitations")
      .withIndex("by_email", (q) => q.eq("email", user.email))
      .unique();

    if (!doc || doc.status !== "claimed") return;

    await ctx.db.patch(doc._id, { onboardingStep: args.step });
  },
});

// ---------------------------------------------------------------------------
// Authenticated mutation: complete onboarding
// ---------------------------------------------------------------------------

export const completeOnboarding = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new Error("NOT_AUTHENTICATED");

    const doc = await ctx.db
      .query("adminInvitations")
      .withIndex("by_email", (q) => q.eq("email", user.email))
      .unique();

    if (!doc || doc.status === "completed") return;

    await ctx.db.patch(doc._id, {
      status: "completed",
      onboardingStep: undefined,
    });
  },
});

// ---------------------------------------------------------------------------
// Authenticated query: get onboarding status for current user
// ---------------------------------------------------------------------------

export const getMyOnboardingStatus = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;
    if ((user as Record<string, unknown>).role !== "admin") return null;

    const doc = await ctx.db
      .query("adminInvitations")
      .withIndex("by_email", (q) => q.eq("email", user.email))
      .unique();

    if (!doc) return { completed: true, step: null };

    return {
      completed: doc.status === "completed",
      step: doc.onboardingStep ?? null,
    };
  },
});

// ---------------------------------------------------------------------------
// Internal query: check if email has a valid admin invitation (for auth hook)
// ---------------------------------------------------------------------------

export const hasValidAdminInvitation = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("adminInvitations")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();

    if (!doc) return false;
    // An admin with a claimed or completed invitation already has an account
    if (doc.status === "claimed" || doc.status === "completed") return true;
    // A valid invitation: status is "invited" and not expired
    if (doc.invitationExpiresAt && Date.now() > doc.invitationExpiresAt) {
      return false;
    }
    return true;
  },
});
