"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  KeyRound,
  Mail,
  MoreHorizontal,
  Trash2,
  Undo2,
} from "lucide-react";
import { useState } from "react";

import {
  Badge,
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system";
import { TokenViewerDialog } from "./token-viewer-dialog";
import type { WaitlistEntry } from "./waitlist-actions-context";
import { useWaitlistActions } from "./waitlist-actions-context";

function renderSortIcon(sorted: false | "asc" | "desc") {
  if (sorted === "asc") return <ArrowUp className="ml-2 h-4 w-4" />;
  if (sorted === "desc") return <ArrowDown className="ml-2 h-4 w-4" />;
  return <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />;
}

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

function DateCell({ timestamp }: { timestamp: number }) {
  const date = new Date(timestamp);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-default">{formatDate(date)}</span>
      </TooltipTrigger>
      <TooltipContent>
        <p>{formatFullDateTime(date)}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function HighlightText({
  text,
  highlight,
}: {
  text: string;
  highlight?: string;
}) {
  if (!highlight || !text) return <>{text}</>;
  const escaped = highlight.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            className="rounded-sm bg-yellow-200/70 dark:bg-yellow-800/50"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

const STATUS_BADGE: Record<
  string,
  { label: string; variant: "outline" | "default" | "secondary" | "destructive" }
> = {
  waiting: { label: "Waiting", variant: "outline" },
  invited: { label: "Invited", variant: "default" },
  expired: { label: "Invitation Expired", variant: "destructive" },
  claimed: { label: "Claimed", variant: "secondary" },
};

interface WaitlistMeta {
  superpowers?: string[];
  excitement?: string[];
}

function parseMeta(meta: string): WaitlistMeta {
  try {
    return JSON.parse(meta) as WaitlistMeta;
  } catch {
    return {};
  }
}

const SUPERPOWER_LABELS: Record<string, string> = {
  "coffee-to-code": "Coffee to code",
  "pixel-perfect": "Pixel perfect",
  "bug-whisperer": "Bug whisperer",
  "spreadsheet-wizard": "Spreadsheet wizard",
  "inbox-zero": "Inbox zero",
  "parallel-parking": "Parallel parking",
  "remembering-names": "Remembering names",
  "never-burning-toast": "Never burns toast",
  "explaining-tech": "Explaining tech",
  "finding-restaurants": "Finding restaurants",
  "staying-calm": "Staying calm",
  other: "Other",
};

const EXCITEMENT_LABELS: Record<string, string> = {
  "take-my-money": "Take my money",
  "cant-wait": "Can't wait",
  "cautiously-optimistic": "Cautiously optimistic",
  "just-browsing": "Just browsing",
  "friend-made-me": "Friend made me",
};

function ActionsCell({ entry }: { entry: WaitlistEntry }) {
  const { onAction } = useWaitlistActions();
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {entry.status === "waiting" && (
            <DropdownMenuItem onSelect={() => onAction("invite", [entry])}>
              <Mail className="mr-2 h-4 w-4" />
              Send invitation
            </DropdownMenuItem>
          )}
          {entry.invitationExpired && (
            <DropdownMenuItem onSelect={() => onAction("invite", [entry])}>
              <Mail className="mr-2 h-4 w-4" />
              Resend invitation
            </DropdownMenuItem>
          )}
          {entry.status === "invited" && !entry.invitationExpired && (
            <DropdownMenuItem onSelect={() => onAction("uninvite", [entry])}>
              <Undo2 className="mr-2 h-4 w-4" />
              Revoke invitation
            </DropdownMenuItem>
          )}
          {(entry.status === "waiting" || entry.status === "invited") && (
            <DropdownMenuSeparator />
          )}
          <DropdownMenuItem onSelect={() => setTokenDialogOpen(true)}>
            <KeyRound className="mr-2 h-4 w-4" />
            View tokens
          </DropdownMenuItem>
          {entry.status !== "claimed" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => onAction("delete", [entry])}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <TokenViewerDialog
        open={tokenDialogOpen}
        onOpenChange={setTokenDialogOpen}
        entry={entry}
      />
    </>
  );
}

type ColumnsConfig = {
  searchTerm?: string;
};

export function createColumns(
  config: ColumnsConfig
): ColumnDef<WaitlistEntry>[] {
  const { searchTerm } = config;

  return [
    {
      id: "select",
      header: ({ table }) => {
        const rows = table.getRowModel().rows;
        const selectableRows = rows.filter(
          (r) => r.original.status !== "claimed"
        );
        const allSelected =
          selectableRows.length > 0 &&
          selectableRows.every((r) => r.getIsSelected());
        const someSelected = selectableRows.some((r) => r.getIsSelected());

        return (
          <Checkbox
            checked={allSelected || (someSelected && "indeterminate")}
            onCheckedChange={(value) => {
              for (const row of selectableRows) {
                row.toggleSelected(!!value);
              }
            }}
            aria-label="Select all"
          />
        );
      },
      cell: ({ row }) => {
        const isClaimed = row.original.status === "claimed";
        return (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            disabled={isClaimed}
            aria-label="Select row"
          />
        );
      },
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },
    {
      accessorKey: "email",
      header: ({ column }) => {
        const sorted = column.getIsSorted();
        return (
          <Button
            variant="ghost"
            className={sorted ? "-ml-3 text-foreground" : "-ml-3"}
            onClick={() => column.toggleSorting(sorted === "asc")}
          >
            Email
            {renderSortIcon(sorted)}
          </Button>
        );
      },
      cell: ({ row }) => (
        <HighlightText
          text={row.getValue("email") as string}
          highlight={searchTerm}
        />
      ),
    },
    {
      id: "superpowers",
      header: "Superpowers",
      accessorFn: (row) => parseMeta(row.meta).superpowers ?? [],
      cell: ({ row }) => {
        const items = parseMeta(row.original.meta).superpowers ?? [];
        if (items.length === 0) {
          return <span className="text-muted-foreground">&mdash;</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {items.map((s) => (
              <Badge key={s} variant="outline" className="text-xs">
                {SUPERPOWER_LABELS[s] ?? s}
              </Badge>
            ))}
          </div>
        );
      },
      enableSorting: false,
    },
    {
      id: "excitement",
      header: "Excitement",
      accessorFn: (row) => parseMeta(row.meta).excitement ?? [],
      cell: ({ row }) => {
        const items = parseMeta(row.original.meta).excitement ?? [];
        if (items.length === 0) {
          return <span className="text-muted-foreground">&mdash;</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {items.map((e) => (
              <Badge key={e} variant="secondary" className="text-xs">
                {EXCITEMENT_LABELS[e] ?? e}
              </Badge>
            ))}
          </div>
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: "status",
      header: ({ column }) => {
        const sorted = column.getIsSorted();
        return (
          <Button
            variant="ghost"
            className={sorted ? "-ml-3 text-foreground" : "-ml-3"}
            onClick={() => column.toggleSorting(sorted === "asc")}
          >
            Status
            {renderSortIcon(sorted)}
          </Button>
        );
      },
      cell: ({ row }) => {
        const status = row.original.invitationExpired
          ? "expired"
          : (row.getValue("status") as string);
        const badge = STATUS_BADGE[status] ?? {
          label: status,
          variant: "outline" as const,
        };
        return <Badge variant={badge.variant}>{badge.label}</Badge>;
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => {
        const sorted = column.getIsSorted();
        return (
          <Button
            variant="ghost"
            className={sorted ? "-ml-3 text-foreground" : "-ml-3"}
            onClick={() => column.toggleSorting(sorted === "asc")}
          >
            Joined Waitlist
            {renderSortIcon(sorted)}
          </Button>
        );
      },
      cell: ({ row }) => (
        <DateCell timestamp={row.getValue("createdAt") as number} />
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => <ActionsCell entry={row.original} />,
      enableHiding: false,
      size: 50,
    },
  ];
}
