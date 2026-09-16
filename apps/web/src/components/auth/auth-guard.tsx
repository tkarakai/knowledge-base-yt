"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { usePreloadedAuthQuery } from "@convex-dev/better-auth/nextjs/client";
import { useQuery } from "convex/react";
import type { Preloaded } from "convex/react";

import { api } from "@repo/backend";
import { authClient } from "@repo/auth/client";

type AuthUser = {
  name?: string;
  email?: string;
};
type PasskeyPolicy = "disabled" | "optional" | "required";

function toPasskeyPolicy(value: unknown): PasskeyPolicy {
  return value === "disabled" || value === "required" ? value : "optional";
}

function toBoolean(value: unknown, defaultValue: boolean): boolean {
  return typeof value === "boolean" ? value : defaultValue;
}

const AuthUserContext = React.createContext<AuthUser | null>(null);

export function useAuthUser(): AuthUser | null {
  return React.useContext(AuthUserContext);
}

type AuthGuardProps = {
  preloadedUser: Preloaded<typeof api.auth.getCurrentUser>;
  children: React.ReactNode;
};

export function AuthGuard({ preloadedUser, children }: AuthGuardProps) {
  const router = useRouter();
  const user = usePreloadedAuthQuery(preloadedUser);
  const session = authClient.useSession();
  const [wasAuthenticated, setWasAuthenticated] = React.useState(false);

  const userEmailVerifRequired = useQuery(api.appSettings.getPublic, {
    key: "userEmailVerificationRequired",
  });
  const adminEmailVerifRequired = useQuery(api.appSettings.getPublic, {
    key: "adminEmailVerificationRequired",
  });
  const userMfaRequired = useQuery(api.appSettings.getPublic, {
    key: "userMfaRequired",
  });
  const adminMfaRequired = useQuery(api.appSettings.getPublic, {
    key: "adminMfaRequired",
  });
  const userPasskeyPolicy = useQuery(api.appSettings.getPublic, {
    key: "userPasskeyPolicy",
  });
  const adminPasskeyPolicy = useQuery(api.appSettings.getPublic, {
    key: "adminPasskeyPolicy",
  });

  // Track that we had a valid user at least once (avoids redirect during initial load).
  React.useEffect(() => {
    if (user != null) {
      setWasAuthenticated(true);
    }
  }, [user]);

  // Redirect to sign-in when the session is invalidated (e.g. signed out in another tab).
  // We rely on the Convex real-time subscription as the authoritative signal.
  // A debounce prevents false redirects during transient session refreshes
  // (e.g. password change, 2FA enable/disable) where the Convex query briefly
  // returns null while the new session token propagates.
  React.useEffect(() => {
    if (!(wasAuthenticated && user === null)) return;

    const timeout = setTimeout(() => {
      router.replace("/sign-in");
    }, 3000);

    return () => clearTimeout(timeout);
  }, [wasAuthenticated, user, router]);

  // Real-time email verification gate: if the admin enables verification while
  // the user is on the dashboard, or if an unverified user somehow bypasses
  // the server-side check, redirect them to the verify-email page immediately.
  React.useEffect(() => {
    if (!wasAuthenticated || user == null) return;
    const userRecord = user as Record<string, unknown>;
    const isAdmin = userRecord.role === "admin";
    const selectedSetting = isAdmin
      ? adminEmailVerifRequired
      : userEmailVerifRequired;
    if (selectedSetting === undefined) return;

    const verificationRequired = selectedSetting !== false;
    if (verificationRequired && !userRecord.emailVerified) {
      router.replace("/verify-email");
    }
  }, [
    wasAuthenticated,
    user,
    userEmailVerifRequired,
    adminEmailVerifRequired,
    router,
  ]);

  React.useEffect(() => {
    if (!wasAuthenticated || user == null) return;
    const userRecord = user as Record<string, unknown>;
    const isAdmin = userRecord.role === "admin";
    const selectedMfaRequired = isAdmin ? adminMfaRequired : userMfaRequired;
    const selectedPasskeyPolicy = isAdmin ? adminPasskeyPolicy : userPasskeyPolicy;
    if (selectedMfaRequired === undefined || selectedPasskeyPolicy === undefined) return;

    const enforceSecurityPolicies = async () => {
      if (toBoolean(selectedMfaRequired, false) && userRecord.twoFactorEnabled !== true) {
        router.replace("/dashboard/settings?tab=security&enforce=mfa");
        return;
      }

      if (toPasskeyPolicy(selectedPasskeyPolicy) !== "required") {
        return;
      }

      try {
        const passkeyResult = await (authClient as unknown as {
          passkey?: {
            listUserPasskeys?: () => Promise<{ data?: unknown[]; error?: unknown }>;
          };
        }).passkey?.listUserPasskeys?.();

        if (!passkeyResult || passkeyResult.error || (passkeyResult.data ?? []).length === 0) {
          router.replace("/dashboard/settings?tab=security&enforce=passkey");
        }
      } catch {
        router.replace("/dashboard/settings?tab=security&enforce=passkey");
      }
    };

    void enforceSecurityPolicies();
  }, [
    wasAuthenticated,
    user,
    userMfaRequired,
    adminMfaRequired,
    userPasskeyPolicy,
    adminPasskeyPolicy,
    router,
  ]);

  const authUser: AuthUser = {
    name: user?.name ?? session.data?.user?.name ?? undefined,
    email: user?.email ?? session.data?.user?.email ?? undefined,
  };

  return (
    <AuthUserContext.Provider value={authUser}>
      {children}
    </AuthUserContext.Provider>
  );
}
