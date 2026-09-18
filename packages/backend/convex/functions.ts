import {
  customCtx,
  customMutation,
} from "convex-helpers/server/customFunctions";
import type { ObjectType, PropertyValidators } from "convex/values";

import { authComponent } from "./auth";
import { rateLimit } from "./rateLimits";
import {
  LEGACY_EMAIL_VERIFICATION_REQUIRED_KEY,
  getEmailVerificationRequiredKey,
  getPolicyScopeFromRole,
} from "./securityPolicies";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";

async function getBooleanSetting(
  ctx: QueryCtx,
  key: string,
  defaultValue: boolean,
): Promise<boolean> {
  const setting = await ctx.db
    .query("appSettings")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();

  if (!setting) return defaultValue;

  try {
    return JSON.parse(setting.value) === true;
  } catch {
    return defaultValue;
  }
}

export async function isEmailVerificationRequired(
  ctx: QueryCtx,
  user: Record<string, unknown>,
): Promise<boolean> {
  const scope = getPolicyScopeFromRole(user.role);
  const scopedKey = getEmailVerificationRequiredKey(scope);
  const scoped = await ctx.db
    .query("appSettings")
    .withIndex("by_key", (q) => q.eq("key", scopedKey))
    .unique();

  if (scoped) {
    try {
      return JSON.parse(scoped.value) === true;
    } catch {
      return true;
    }
  }

  return await getBooleanSetting(ctx, LEGACY_EMAIL_VERIFICATION_REQUIRED_KEY, true);
}

/**
 * Resolve the authenticated user without throwing.
 * Uses `authComponent.safeGetAuthUser` (returns undefined when
 * unauthenticated) and derives the canonical `ownerId`.
 */
async function getAuth(ctx: QueryCtx) {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) return null;

  // Banned users are treated as unauthenticated (spec §14)
  if ((user as Record<string, unknown>).banned === true) {
    return null;
  }

  const emailVerificationRequired = await isEmailVerificationRequired(
    ctx,
    user as Record<string, unknown>,
  );
  if (emailVerificationRequired && (user as Record<string, unknown>).emailVerified !== true) {
    return null;
  }

  return { user, ownerId: (user.userId ?? user._id).toString() };
}

type AuthInfo = NonNullable<Awaited<ReturnType<typeof getAuth>>>;

/**
 * Authenticated query builder.
 * Handlers receive `ctx.user` and `ctx.ownerId` automatically.
 * Returns `null` when the caller is not authenticated — safe for
 * reactive `useQuery` subscriptions (no thrown errors to crash the UI).
 */
export function authedQuery<
  ArgsValidator extends PropertyValidators,
  Output,
>(func: {
  args: ArgsValidator;
  handler: (
    ctx: QueryCtx & AuthInfo,
    args: ObjectType<ArgsValidator>,
  ) => Output | Promise<Output>;
}) {
  return query({
    args: func.args,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: async (ctx: QueryCtx, args: any): Promise<Output | null> => {
      const auth = await getAuth(ctx);
      if (!auth) return null;
      return func.handler({ ...ctx, ...auth }, args);
    },
  });
}

/**
 * Authenticated mutation builder.
 * Handlers receive `ctx.user` and `ctx.ownerId` automatically.
 * Throws if the caller is not authenticated.
 * Enforces a global per-user rate limit on all mutations.
 */
export const authedMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    const auth = await getAuth(ctx);
    if (!auth) throw new Error("NOT_AUTHENTICATED");

    await rateLimit(ctx, {
      name: "mutationGlobal",
      key: auth.ownerId,
      throws: true,
    });

    return auth;
  }),
);

/** Maximum lengths for user-supplied string fields (defense against resource exhaustion). */
export const MAX_NAME_LENGTH = 255;
export const MAX_DESCRIPTION_LENGTH = 5000;

/** Throw if a string exceeds the allowed length. */
export function assertMaxLength(
  value: string | undefined,
  maxLength: number,
  fieldName: string,
): void {
  if (value !== undefined && value.length > maxLength) {
    throw new Error(`${fieldName}_TOO_LONG`);
  }
}

/**
 * Verify the project belongs to the authenticated user.
 * Use for ALL project-scoped operations (tasks, uploads, etc.)
 * so ownership is always checked through the project chain.
 */
export async function requireProjectAccess(
  ctx: { db: { get: (id: Id<"projects">) => Promise<Doc<"projects"> | null> }; ownerId: string },
  projectId: Id<"projects">,
): Promise<Doc<"projects">> {
  const project = await ctx.db.get(projectId);
  if (!project || project.ownerId !== ctx.ownerId) {
    throw new Error("PROJECT_NOT_FOUND");
  }
  return project;
}
