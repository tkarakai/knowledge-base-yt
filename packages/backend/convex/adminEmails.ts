import { internalQuery, query } from "./_generated/server";
import { authComponent } from "./auth";

export const list = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("adminEmails").collect();
  },
});

/**
 * Returns the list of protected admin emails.
 * Restricted to admin users only to prevent information disclosure.
 */
export const listProtected = query({
  args: {},
  handler: async (ctx) => {
    let user;
    try {
      user = await authComponent.getAuthUser(ctx);
    } catch {
      return [];
    }
    if (!user) {
      return [];
    }

    // Only admin users may see the admin email list.
    // Without this check any authenticated user could enumerate admin emails,
    // which could be combined with other attacks (e.g. phishing, account takeover).
    const role = (user as Record<string, unknown>).role;
    if (role !== "admin") {
      return [];
    }

    const rows = await ctx.db.query("adminEmails").collect();
    return rows.map((r) => r.email);
  },
});
