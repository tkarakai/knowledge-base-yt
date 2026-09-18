"use client";

import * as React from "react";
import {
  Globe,
  Laptop,
  Monitor,
  MoreHorizontal,
  RefreshCw,
  Smartphone,
  Tablet,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@repo/backend";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/design-system";
import type { AdminSession } from "@/lib/admin-api";
import {
  fetchUsers,
  listUserSessions,
  revokeSession,
  revokeAllSessions,
} from "@/lib/admin-api";
import { parseUserAgent } from "@repo/design-system";

/** Debounce delay for search (ms). */
const SEARCH_DEBOUNCE = 300;

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatFullDateTime(date: Date): string {
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

function DeviceIcon({ device }: { device: string }) {
  switch (device) {
    case "mobile":
      return <Smartphone className="h-4 w-4 text-muted-foreground" />;
    case "tablet":
      return <Tablet className="h-4 w-4 text-muted-foreground" />;
    default:
      return <Monitor className="h-4 w-4 text-muted-foreground" />;
  }
}

type SelectedUser = {
  id: string;
  name: string;
  email: string;
};

type UserSearchResult = {
  id: string;
  name: string;
  email: string;
};

export function SessionViewer() {
  const postAuditEvent = useMutation(api.auditTrail.postEvent);

  // User search state
  const [searchInput, setSearchInput] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<UserSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [showDropdown, setShowDropdown] = React.useState(false);
  const searchRef = React.useRef<HTMLDivElement>(null);

  // Selected user + sessions
  const [selectedUser, setSelectedUser] = React.useState<SelectedUser | null>(null);
  const [sessions, setSessions] = React.useState<AdminSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = React.useState(false);

  // Revoke dialog state
  const [revokeTarget, setRevokeTarget] = React.useState<AdminSession | null>(null);
  const [revokePending, setRevokePending] = React.useState(false);

  // Revoke all dialog state
  const [revokeAllOpen, setRevokeAllOpen] = React.useState(false);
  const [revokeAllPending, setRevokeAllPending] = React.useState(false);

  // Debounce search input
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), SEARCH_DEBOUNCE);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Perform user search
  React.useEffect(() => {
    if (!debouncedSearch || debouncedSearch.length < 2) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;
    const search = async () => {
      setSearchLoading(true);
      try {
        const [byName, byEmail] = await Promise.all([
          fetchUsers({
            searchValue: debouncedSearch,
            searchField: "name",
            searchOperator: "contains",
            limit: 10,
          }),
          fetchUsers({
            searchValue: debouncedSearch,
            searchField: "email",
            searchOperator: "contains",
            limit: 10,
          }),
        ]);

        if (cancelled) return;

        const seen = new Set<string>();
        const merged: UserSearchResult[] = [];
        for (const u of [...byName.users, ...byEmail.users]) {
          if (!seen.has(u.id)) {
            seen.add(u.id);
            merged.push({ id: u.id, name: u.name, email: u.email });
          }
        }
        setSearchResults(merged.slice(0, 10));
        setShowDropdown(true);
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    };

    search();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  // Close dropdown on outside click
  React.useEffect(() => {
    const handler = (e: globalThis.MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as globalThis.Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch sessions when a user is selected
  const fetchSessions = React.useCallback(async (userId: string) => {
    setSessionsLoading(true);
    try {
      const result = await listUserSessions(userId);
      setSessions(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load sessions");
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  const handleSelectUser = (user: UserSearchResult) => {
    setSelectedUser(user);
    setSearchInput("");
    setShowDropdown(false);
    setSearchResults([]);
    fetchSessions(user.id);
  };

  const handleClearUser = () => {
    setSelectedUser(null);
    setSessions([]);
  };

  const handleRefresh = () => {
    if (selectedUser) {
      fetchSessions(selectedUser.id);
    }
  };

  // Revoke single session
  const handleRevokeConfirm = async () => {
    if (!revokeTarget || !selectedUser) return;
    setRevokePending(true);
    try {
      await revokeSession(revokeTarget.token, postAuditEvent);
      toast.success("Session revoked");
      setRevokeTarget(null);
      fetchSessions(selectedUser.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke session");
    } finally {
      setRevokePending(false);
    }
  };

  // Revoke all sessions
  const handleRevokeAllConfirm = async () => {
    if (!selectedUser) return;
    setRevokeAllPending(true);
    try {
      await revokeAllSessions(selectedUser.id, postAuditEvent);
      toast.success(`All sessions revoked for ${selectedUser.email}`);
      setRevokeAllOpen(false);
      fetchSessions(selectedUser.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke sessions");
    } finally {
      setRevokeAllPending(false);
    }
  };

  const isExpired = (session: AdminSession): boolean => {
    return session.expiresAt.getTime() < Date.now();
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* User search */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div ref={searchRef} className="relative flex-1 max-w-md">
            <Input
              placeholder="Search user by name or email..."
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                if (e.target.value.length >= 2) setShowDropdown(true);
              }}
              onFocus={() => {
                if (searchResults.length > 0) setShowDropdown(true);
              }}
              className="w-full"
            />
            {showDropdown && (searchLoading || searchResults.length > 0) && (
              <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
                {searchLoading ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    Searching...
                  </div>
                ) : (
                  <ul className="max-h-60 overflow-y-auto py-1">
                    {searchResults.map((user) => (
                      <li key={user.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                          onClick={() => handleSelectUser(user)}
                        >
                          <div className="flex flex-col items-start">
                            <span className="font-medium">{user.name || "Unnamed"}</span>
                            <span className="text-xs text-muted-foreground">
                              {user.email}
                            </span>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {selectedUser && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1.5 py-1 pl-2.5 pr-1.5">
                <span className="text-sm">
                  {selectedUser.name || selectedUser.email}
                </span>
                <button
                  type="button"
                  onClick={handleClearUser}
                  className="ml-0.5 rounded-sm p-0.5 hover:bg-muted-foreground/20 transition-colors"
                >
                  <X className="h-3 w-3" />
                  <span className="sr-only">Clear selection</span>
                </button>
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleRefresh}
                disabled={sessionsLoading}
              >
                <RefreshCw
                  className={`h-4 w-4 ${sessionsLoading ? "animate-spin" : ""}`}
                />
                <span className="sr-only">Refresh</span>
              </Button>
              {sessions.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setRevokeAllOpen(true)}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Revoke all
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Sessions table */}
        {selectedUser ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>Browser</TableHead>
                  <TableHead>OS</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessionsLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={`skeleton-${i}`}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <TableCell key={`skeleton-${i}-${j}`}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : sessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      No active sessions found.
                    </TableCell>
                  </TableRow>
                ) : (
                  sessions.map((session) => {
                    const parsed = parseUserAgent(session.userAgent);
                    const expired = isExpired(session);
                    return (
                      <TableRow
                        key={session.id}
                        className={expired ? "opacity-60" : ""}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <DeviceIcon device={parsed.device} />
                            <span className="text-sm capitalize">{parsed.device}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{parsed.browser}</TableCell>
                        <TableCell className="text-sm">{parsed.os}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm font-mono">
                              {session.ipAddress ?? "Unknown"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-default text-sm">
                                {formatDate(session.createdAt)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{formatFullDateTime(session.createdAt)}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-default text-sm">
                                {formatRelativeTime(session.updatedAt)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{formatFullDateTime(session.updatedAt)}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          {expired ? (
                            <Badge variant="outline" className="text-muted-foreground">
                              Expired
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-green-500/30 text-green-600 dark:text-green-400">
                              Active
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Session actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={() => setRevokeTarget(session)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Revoke session
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-12 text-center">
            <Laptop className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              Search and select a user to view their sessions
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              You can view active sessions, device info, and revoke access.
            </p>
          </div>
        )}

        {selectedUser && sessions.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {sessions.length} session{sessions.length !== 1 ? "s" : ""} found for{" "}
            {selectedUser.email}
          </p>
        )}
      </div>

      {/* Revoke single session dialog */}
      <AlertDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke session</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke this session? The user will be
              logged out from this device immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokePending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeConfirm}
              disabled={revokePending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revokePending ? "Revoking..." : "Revoke"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke all sessions dialog */}
      <AlertDialog
        open={revokeAllOpen}
        onOpenChange={(open) => {
          if (!open) setRevokeAllOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke all sessions</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke all {sessions.length} session
              {sessions.length !== 1 ? "s" : ""} for{" "}
              <span className="font-medium">{selectedUser?.email}</span>? The
              user will be logged out from all devices immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeAllPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeAllConfirm}
              disabled={revokeAllPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revokeAllPending ? "Revoking..." : "Revoke all"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
