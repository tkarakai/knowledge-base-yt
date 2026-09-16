"use client";

import { useQuery } from "convex/react";
import { Check, Copy, KeyRound, ShieldX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "@repo/backend";

import {
  Badge,
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
  toast,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system";
import type { WaitlistEntry } from "./waitlist-actions-context";

type TokenViewerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: WaitlistEntry;
};

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}

function formatRelativeTime(timestamp: number): string {
  const diffMs = timestamp - Date.now();
  const absDiffMs = Math.abs(diffMs);
  const seconds = Math.floor(absDiffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let relative: string;
  if (days > 0) {
    relative = `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    relative = `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    relative = `${minutes}m ${seconds % 60}s`;
  } else {
    relative = `${seconds}s`;
  }

  return diffMs > 0 ? `Expires in ${relative}` : `Expired ${relative} ago`;
}

type TokenStatus = "sent" | "claiming" | "claimed" | "revoked";

function resolveStatus(
  status: TokenStatus,
  expiresAt: number
): { label: string; variant: "outline" | "default" | "secondary" | "destructive" } {
  if (status === "sent" && Date.now() > expiresAt) {
    return { label: "Expired", variant: "destructive" };
  }
  const map: Record<
    TokenStatus,
    { label: string; variant: "outline" | "default" | "secondary" | "destructive" }
  > = {
    sent: { label: "Sent", variant: "outline" },
    claiming: { label: "Claiming", variant: "secondary" },
    claimed: { label: "Claimed", variant: "default" },
    revoked: { label: "Revoked", variant: "destructive" },
  };
  return map[status];
}

function CopyableToken({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await window.navigator.clipboard.writeText(token);
      setCopied(true);
      toast.success("Token copied to clipboard");
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy token");
    }
  }, [token]);

  const truncated = `${token.slice(0, 8)}\u2026${token.slice(-4)}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleCopy}
          className="group/token inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-mono text-[13px] leading-none transition-colors hover:bg-muted"
        >
          <span className="text-foreground/80 group-hover/token:text-foreground">
            {truncated}
          </span>
          {copied ? (
            <Check className="h-3 w-3 shrink-0 text-emerald-500" />
          ) : (
            <Copy className="h-3 w-3 shrink-0 text-muted-foreground/60 transition-colors group-hover/token:text-foreground/70" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>{copied ? "Copied!" : "Click to copy full token"}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function DateCell({ timestamp }: { timestamp: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-default whitespace-nowrap text-muted-foreground">
          {formatDate(timestamp)}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p>{formatDateTime(timestamp)}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function ExpirationCell({ timestamp }: { timestamp: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-default whitespace-nowrap text-muted-foreground">
          {formatDate(timestamp)}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p>{formatDateTime(timestamp)}</p>
        <p>{formatRelativeTime(timestamp)}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function LoadingSkeleton() {
  return (
    <Table className="min-w-max">
      <TableHeader>
        <TableRow>
          <TableHead>Token</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Expiration</TableHead>
          <TableHead>Claimed</TableHead>
          <TableHead>Revoked</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[1, 2, 3].map((i) => (
          <TableRow key={i}>
            <TableCell><Skeleton className="h-5 w-28" /></TableCell>
            <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <ShieldX className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground/70">No tokens found</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        This entry has no invitation tokens yet.
      </p>
    </div>
  );
}

export function TokenViewerDialog({
  open,
  onOpenChange,
  entry,
}: TokenViewerDialogProps) {
  const tokens = useQuery(
    api.waitlistTokens.listByEntry,
    open ? { waitlistEntryId: entry._id } : "skip"
  );
  const loading = tokens === undefined;
  const totalCount = tokens?.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            Invitation Tokens
          </DialogTitle>
          <DialogDescription>{entry.email}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="overflow-auto rounded-md border">
            <LoadingSkeleton />
          </div>
        ) : totalCount === 0 ? (
          <EmptyState />
        ) : (
          <div className="min-w-0 space-y-3">
            <div className="max-h-80 overflow-auto rounded-md border">
              <Table className="min-w-max">
                <TableHeader>
                  <TableRow>
                    <TableHead>Token</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Expiration</TableHead>
                    <TableHead>Claimed</TableHead>
                    <TableHead>Revoked</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tokens?.map((token) => {
                    const { label, variant } = resolveStatus(
                      token.status,
                      token.expiresAt
                    );
                    return (
                      <TableRow key={token._id}>
                        <TableCell>
                          <CopyableToken token={token.token} />
                        </TableCell>
                        <TableCell>
                          <Badge variant={variant}>{label}</Badge>
                        </TableCell>
                        <TableCell>
                          <DateCell timestamp={token.createdAt} />
                        </TableCell>
                        <TableCell>
                          {token.status === "claimed" ? (
                            <span className="text-muted-foreground">&mdash;</span>
                          ) : (
                            <ExpirationCell timestamp={token.expiresAt} />
                          )}
                        </TableCell>
                        <TableCell>
                          {token.claimedAt ? (
                            <DateCell timestamp={token.claimedAt} />
                          ) : (
                            <span className="text-muted-foreground">&mdash;</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {token.revokedAt ? (
                            <DateCell timestamp={token.revokedAt} />
                          ) : (
                            <span className="text-muted-foreground">&mdash;</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <p className="text-xs text-muted-foreground">
              {totalCount} token{totalCount === 1 ? "" : "s"}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
