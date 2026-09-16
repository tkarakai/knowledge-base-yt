"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { usePreloadedAuthQuery } from "@convex-dev/better-auth/nextjs/client";
import type { Preloaded } from "convex/react";

import type { api } from "@repo/backend";
import { authClient } from "@repo/auth/client";

type AuthUser = {
  id?: string;
  name?: string;
  email?: string;
};

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

  // Track that we had a valid user at least once (avoids redirect during initial load).
  React.useEffect(() => {
    if (user != null) {
      setWasAuthenticated(true);
    }
  }, [user]);

  // Redirect to sign-in when the session is invalidated (e.g. signed out in another tab).
  // Two signals: Convex real-time subscription (user becomes null) or Better Auth session.
  React.useEffect(() => {
    const convexLost = wasAuthenticated && user === null;
    const sessionLost = !session.isPending && session.data === null;

    if (convexLost || sessionLost) {
      router.replace("/sign-in");
    }
  }, [wasAuthenticated, user, session.isPending, session.data, router]);

  const authUser: AuthUser = {
    id: session.data?.user?.id ?? undefined,
    name: user?.name ?? session.data?.user?.name ?? undefined,
    email: user?.email ?? session.data?.user?.email ?? undefined,
  };

  return (
    <AuthUserContext.Provider value={authUser}>
      {children}
    </AuthUserContext.Provider>
  );
}
