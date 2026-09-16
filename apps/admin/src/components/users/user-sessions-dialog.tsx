"use client";

import * as React from "react";
import {
  Globe,
  Monitor,
  RefreshCw,
  Smartphone,
  Tablet,
  Trash2,
} from "lucide-react";
import { useMutation } from "convex/react";
import { toast } from "sonner";

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
  parseUserAgent,
} from "@repo/design-system";
import type { AdminSession, AdminUser } from "@/lib/admin-api";
import { listUserSessions, revokeAllSessions, revokeSession } from "@/lib/admin-api";

type UserSessionsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AdminUser | null;
};

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
  if (device === "mobile") {
    return <Smartphone className="h-4 w-4 text-muted-foreground" />;
  }
  if (device === "tablet") {
    return <Tablet className="h-4 w-4 text-muted-foreground" />;
  }
  return <Monitor className="h-4 w-4 text-muted-foreground" />;
}

export function UserSessionsDialog({
  open,
  onOpenChange,
  user,
}: UserSessionsDialogProps) {
  const postAuditEvent = useMutation(api.auditTrail.postEvent);
  const [sessions, setSessions] = React.useState<AdminSession[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [revokeTarget, setRevokeTarget] = React.useState<AdminSession | null>(null);
  const [revokePending, setRevokePending] = React.useState(false);
  const [revokeAllOpen, setRevokeAllOpen] = React.useState(false);
  const [revokeAllPending, setRevokeAllPending] = React.useState(false);
  const requestIdRef = React.useRef(0);

  const fetchSessions = React.useCallback(async () => {
    if (!user) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const result = await listUserSessions(user.id);
      if (requestId !== requestIdRef.current) return;
      setSessions(result);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      toast.error(err instanceof Error ? err.message : "Failed to load sessions");
      setSessions([]);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [user]);

  React.useEffect(() => {
    requestIdRef.current += 1;
    setSessions([]);
    setRevokeTarget(null);
    setRevokeAllOpen(false);
    setLoading(false);
    if (!open || !user) return;
    void fetchSessions();
  }, [open, user, fetchSessions]);

  const handleRevokeConfirm = async () => {
    if (!user || !revokeTarget) return;
    setRevokePending(true);
    try {
      await revokeSession(revokeTarget.token, postAuditEvent);
      toast.success("Session revoked");
      setRevokeTarget(null);
      fetchSessions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke session");
    } finally {
      setRevokePending(false);
    }
  };

  const handleRevokeAllConfirm = async () => {
    if (!user) return;
    setRevokeAllPending(true);
    try {
      await revokeAllSessions(user.id, postAuditEvent);
      toast.success(`All sessions revoked for ${user.email}`);
      setRevokeAllOpen(false);
      fetchSessions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke sessions");
    } finally {
      setRevokeAllPending(false);
    }
  };

  const isExpired = (session: AdminSession): boolean =>
    session.expiresAt.getTime() < Date.now();

  if (!user) return null;

  return (
    <TooltipProvider>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setRevokeTarget(null);
            setRevokeAllOpen(false);
          }
          onOpenChange(nextOpen);
        }}
      >
        <DialogContent className="w-[96vw] max-w-[1400px]">
          <DialogHeader>
            <DialogTitle>Sessions</DialogTitle>
            <DialogDescription>
              {user.name ? `${user.name} · ${user.email}` : user.email}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                void fetchSessions();
              }}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              <span className="sr-only">Refresh sessions</span>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={loading || sessions.length === 0}
              onClick={() => setRevokeAllOpen(true)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Revoke All
            </Button>
          </div>

          <div className="overflow-auto rounded-md border">
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>Browser</TableHead>
                  <TableHead>OS</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[120px] text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
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
                      <TableRow key={session.id} className={expired ? "opacity-60" : ""}>
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
                            <span className="font-mono text-sm">
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
                            <Badge
                              variant="outline"
                              className="border-green-500/30 text-green-600 dark:text-green-400"
                            >
                              Active
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={loading}
                            onClick={() => setRevokeTarget(session)}
                          >
                            Revoke
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={revokeTarget !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setRevokeTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke session</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately sign out this device and invalidate the session token.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokePending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={revokePending}
              onClick={handleRevokeConfirm}
            >
              {revokePending ? "Revoking..." : "Revoke"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={revokeAllOpen} onOpenChange={setRevokeAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke all sessions?</AlertDialogTitle>
            <AlertDialogDescription>
              This will sign out this user from all devices immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeAllPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={revokeAllPending}
              onClick={handleRevokeAllConfirm}
            >
              {revokeAllPending ? "Revoking..." : "Revoke All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
