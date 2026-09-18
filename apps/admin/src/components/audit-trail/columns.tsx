"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ShieldCheck } from "lucide-react";

import {
  Badge,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system";
import type { Doc } from "@repo/backend";
import { EventDetails } from "./event-details";

type AuditEvent = Doc<"auditTrail">;

function formatRelativeTime(ms: number): string {
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatFullDateTime(ms: number): string {
  return new Date(ms).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}

function truncate(str: string, max: number): string {
  return str.length > max ? `${str.slice(0, max)}...` : str;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "succeeded") {
    return (
      <Badge variant="outline" className="border-green-500/50 text-green-700 dark:text-green-400">
        succeeded
      </Badge>
    );
  }
  return (
    <Badge variant="destructive">
      {status}
    </Badge>
  );
}

function SourceBadge({ source }: { source: string }) {
  const isServer = source.startsWith("server:");
  return (
    <Badge variant={isServer ? "secondary" : "outline"} className="font-mono text-xs">
      {source}
    </Badge>
  );
}

export const columns: ColumnDef<AuditEvent>[] = [
  {
    accessorKey: "happenedAt",
    header: "Time",
    cell: ({ row }) => {
      const ms = row.getValue("happenedAt") as number;
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-default whitespace-nowrap text-sm">
              {formatRelativeTime(ms)}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{formatFullDateTime(ms)}</p>
          </TooltipContent>
        </Tooltip>
      );
    },
  },
  {
    accessorKey: "action",
    header: "Action",
    cell: ({ row }) => (
      <Badge variant="secondary" className="font-mono text-xs">
        {row.getValue("action") as string}
      </Badge>
    ),
  },
  {
    accessorKey: "actor",
    header: "Actor",
    cell: ({ row }) => {
      const actor = row.getValue("actor") as string;
      const authenticatedUserId = row.original.authenticatedUserId;
      const short = truncate(actor, 20);
      const content = (
        <span className="inline-flex items-center gap-1.5 text-sm font-mono">
          {authenticatedUserId && (
            <Tooltip>
              <TooltipTrigger asChild>
                <ShieldCheck className="h-3.5 w-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Authenticated user</p>
              </TooltipContent>
            </Tooltip>
          )}
          {short !== actor ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-default">{short}</span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-mono">{actor}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <span>{actor}</span>
          )}
        </span>
      );
      return content;
    },
  },
  {
    accessorKey: "source",
    header: "Source",
    cell: ({ row }) => (
      <SourceBadge source={row.getValue("source") as string} />
    ),
  },
  {
    accessorKey: "resource",
    header: "Resource",
    cell: ({ row }) => {
      const resource = row.getValue("resource") as string;
      const short = truncate(resource, 24);
      if (short === resource) {
        return <span className="text-sm font-mono">{resource}</span>;
      }
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-default text-sm font-mono">{short}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-mono">{resource}</p>
          </TooltipContent>
        </Tooltip>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.getValue("status") as string} />,
  },
  {
    id: "details",
    header: "",
    cell: ({ row }) => {
      const event = row.original;
      const hasDetails = event.oldValue || event.newValue || event.reason || event.meta || event.truncatedFields;
      if (!hasDetails) return null;
      return <EventDetails event={event} />;
    },
    size: 50,
  },
];
