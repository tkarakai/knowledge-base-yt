/**
 * Helper functions for business service developers to create audit trail events.
 *
 * Separated from auditTrail.ts to avoid circular dependency:
 * auditTrail.ts defines `insertEvent`, and `internal.auditTrail.insertEvent`
 * references it — importing `internal` in the same file creates a cycle.
 */

import type { AuditAction, AuditStatus } from "./auditTrailConstants";
import type { ActionCtx, MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";

// ---------------------------------------------------------------------------
// InsertEvent args type
// ---------------------------------------------------------------------------

export interface InsertEventArgs {
  happenedAt?: number;
  authenticatedUserId?: string;
  actor: string;
  sourceDetail: string;
  action: AuditAction;
  resource: string;
  status: AuditStatus;
  oldValue?: string;
  newValue?: string;
  reason?: string;
  meta?: string;
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Fire-and-forget audit event via scheduler. Use in **mutation** handlers.
 * Wraps the call in try/catch — never throws, logs failures to console.
 */
export async function scheduleAuditEvent(
  ctx: Pick<MutationCtx, "scheduler">,
  event: InsertEventArgs,
): Promise<void> {
  try {
    await ctx.scheduler.runAfter(0, internal.auditTrail.insertEvent, event);
  } catch (error) {
    console.error("Failed to schedule audit event:", error);
  }
}

/**
 * Direct audit event call for **action** contexts (auth hooks, HTTP actions).
 * In action contexts `ctx.scheduler` is not available, so this uses
 * `actionCtx.runMutation()` which already runs in a separate transaction.
 * Wraps the call in try/catch — never throws, logs failures to console.
 */
export async function runAuditEvent(
  actionCtx: Pick<ActionCtx, "runMutation">,
  event: InsertEventArgs,
): Promise<void> {
  try {
    await actionCtx.runMutation(internal.auditTrail.insertEvent, event);
  } catch (error) {
    console.error("Failed to run audit event:", error);
  }
}
