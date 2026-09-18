import { redirect } from "next/navigation";

import { api } from "@repo/backend";
import {
  preloadAuthQuery,
  fetchAuthQuery,
  isAuthenticated,
} from "@repo/auth/server";
import { AuthGuard } from "@/components/auth/auth-guard";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authed = await isAuthenticated();
  if (!authed) {
    redirect("/api/auth/clear-session");
  }

  let preloadedUser;
  try {
    preloadedUser = await preloadAuthQuery(api.auth.getCurrentUser);
  } catch {
    redirect("/api/auth/clear-session");
  }

  const user = await fetchAuthQuery(api.auth.getCurrentUser);
  if (!user) {
    redirect("/api/auth/clear-session");
  }

  const userRecord = user as Record<string, unknown>;

  // Admins cannot use the web app (spec §14)
  if (userRecord.role === "admin") {
    redirect("/forbidden");
  }

  // Banned users cannot access the dashboard (spec §14)
  if (userRecord.banned === true) {
    redirect("/forbidden");
  }

  // Server-side MFA enforcement: if userMfaRequired policy is enabled and
  // the user hasn't set up 2FA, redirect to settings security tab.
  if (userRecord.twoFactorEnabled !== true) {
    try {
      const mfaRequired = await fetchAuthQuery(api.appSettings.getPublic, {
        key: "userMfaRequired",
      });
      if (mfaRequired === true) {
        redirect("/dashboard/settings?tab=security&enforce=mfa");
      }
    } catch {
      // If the query fails, fall through — client-side AuthGuard
      // will enforce MFA as a secondary check.
    }
  }

  return <AuthGuard preloadedUser={preloadedUser}>{children}</AuthGuard>;
}
