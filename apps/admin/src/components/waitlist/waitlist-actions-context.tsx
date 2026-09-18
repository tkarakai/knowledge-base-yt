"use client";

import * as React from "react";
import type { Doc } from "@repo/backend";

export type WaitlistEntry = Doc<"waitlistEntries"> & {
  invitationExpired: boolean;
};
export type WaitlistAction = "invite" | "uninvite" | "delete";

type WaitlistActionsContextValue = {
  onAction: (action: WaitlistAction, entries: WaitlistEntry[]) => void;
};

const WaitlistActionsContext =
  React.createContext<WaitlistActionsContextValue | null>(null);

export function useWaitlistActions(): WaitlistActionsContextValue {
  const ctx = React.useContext(WaitlistActionsContext);
  if (!ctx)
    throw new Error(
      "useWaitlistActions must be used within WaitlistActionsProvider"
    );
  return ctx;
}

export function WaitlistActionsProvider({
  onAction,
  children,
}: {
  onAction: (action: WaitlistAction, entries: WaitlistEntry[]) => void;
  children: React.ReactNode;
}) {
  const value = React.useMemo(() => ({ onAction }), [onAction]);
  return (
    <WaitlistActionsContext.Provider value={value}>
      {children}
    </WaitlistActionsContext.Provider>
  );
}
