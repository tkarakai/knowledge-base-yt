"use client";

import * as React from "react";
import type { AdminUser } from "@/lib/admin-api";

type UserAction =
  | "ban"
  | "unban"
  | "delete"
  | "makeAdmin"
  | "removeAdmin"
  | "sessions";

type UserActionsContextValue = {
  onAction: (action: UserAction, users: AdminUser[]) => void;
};

const UserActionsContext = React.createContext<UserActionsContextValue | null>(null);

export function useUserActions(): UserActionsContextValue {
  const ctx = React.useContext(UserActionsContext);
  if (!ctx) throw new Error("useUserActions must be used within UserActionsProvider");
  return ctx;
}

export function UserActionsProvider({
  onAction,
  children,
}: {
  onAction: (action: UserAction, users: AdminUser[]) => void;
  children: React.ReactNode;
}) {
  const value = React.useMemo(() => ({ onAction }), [onAction]);
  return (
    <UserActionsContext.Provider value={value}>
      {children}
    </UserActionsContext.Provider>
  );
}
