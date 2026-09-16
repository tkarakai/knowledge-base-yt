"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Ban,
  Check,
  Monitor,
  MoreHorizontal,
  Shield,
  ShieldOff,
  Trash2,
  Unlock,
  X,
} from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system";
import type { AdminUser } from "@/lib/admin-api";
import { useUserActions } from "./user-actions-context";
import { BanDetailsCard } from "./ban-details-card";

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

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Highlights matching substrings in text for search results. */
function HighlightText({ text, highlight }: { text: string; highlight?: string }) {
  if (!highlight || !text) return <>{text}</>;
  const escaped = highlight.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="rounded-sm bg-yellow-200/70 dark:bg-yellow-800/50">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function ActionsCell({
  user,
  currentUserId,
  protectedEmails,
}: {
  user: AdminUser;
  currentUserId?: string;
  protectedEmails: Set<string>;
}) {
  const { onAction } = useUserActions();
  const isBanned = user.banned === true;
  const isSelf = currentUserId != null && user.id === currentUserId;
  const isProtected = protectedEmails.has(user.email);
  const isAdmin = user.role === "admin";

  const canBanOrDelete = !isSelf && !isProtected;
  const canChangeRole = !isSelf && !isProtected;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onAction("sessions", [user])}>
          <Monitor className="mr-2 h-4 w-4" />
          Sessions
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {isBanned ? (
          <DropdownMenuItem
            disabled={!canBanOrDelete}
            onSelect={() => onAction("unban", [user])}
          >
            <Unlock className="mr-2 h-4 w-4" />
            Unban user
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            disabled={!canBanOrDelete}
            onSelect={() => onAction("ban", [user])}
          >
            <Ban className="mr-2 h-4 w-4" />
            Ban user
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {isAdmin ? (
          <DropdownMenuItem
            disabled={!canChangeRole}
            onSelect={() => onAction("removeAdmin", [user])}
          >
            <ShieldOff className="mr-2 h-4 w-4" />
            Remove admin
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            disabled={!canChangeRole}
            onSelect={() => onAction("makeAdmin", [user])}
          >
            <Shield className="mr-2 h-4 w-4" />
            Make admin
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!canBanOrDelete}
          className="text-destructive focus:text-destructive"
          onSelect={() => onAction("delete", [user])}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete user
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Wraps a date cell with a tooltip showing full date/time + timezone. */
function DateCell({ date }: { date: Date }) {
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

type ColumnsConfig = {
  currentUserId?: string;
  protectedEmails: Set<string>;
  searchTerm?: string;
};

export function createColumns(config: ColumnsConfig): ColumnDef<AdminUser>[] {
  const { currentUserId, protectedEmails, searchTerm } = config;

  return [
    {
      id: "select",
      header: ({ table }) => {
        const selectableRows = table.getRowModel().rows.filter((row) => {
          const isSelf =
            currentUserId != null && row.original.id === currentUserId;
          const isProtected = protectedEmails.has(row.original.email);
          return !isSelf && !isProtected;
        });
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
        const isSelf =
          currentUserId != null && row.original.id === currentUserId;
        const isProtected = protectedEmails.has(row.original.email);

        return (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            disabled={isSelf || isProtected}
            aria-label="Select row"
          />
        );
      },
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },
    {
      id: "image",
      header: "",
      accessorFn: (row) => row.image,
      enableSorting: false,
      cell: ({ row }) => {
        const user = row.original;
        return (
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.image ?? undefined} alt={user.name} />
            <AvatarFallback className="text-xs">
              {getInitials(user.name || user.email)}
            </AvatarFallback>
          </Avatar>
        );
      },
      size: 50,
    },
    {
      accessorKey: "name",
      header: ({ column }) => {
        const sorted = column.getIsSorted();
        return (
          <Button
            variant="ghost"
            className={sorted ? "-ml-3 text-foreground" : "-ml-3"}
            onClick={() => column.toggleSorting(sorted === "asc")}
          >
            Name
            {renderSortIcon(sorted)}
          </Button>
        );
      },
      cell: ({ row }) => {
        const isSelf =
          currentUserId != null && row.original.id === currentUserId;
        const name = row.getValue("name") as string;
        return (
          <span className="font-medium">
            {name ? <HighlightText text={name} highlight={searchTerm} /> : "—"}
            {isSelf && (
              <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
            )}
          </span>
        );
      },
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
        <HighlightText text={row.getValue("email") as string} highlight={searchTerm} />
      ),
    },
    {
      accessorKey: "role",
      header: ({ column }) => {
        const sorted = column.getIsSorted();
        return (
          <Button
            variant="ghost"
            className={sorted ? "-ml-3 text-foreground" : "-ml-3"}
            onClick={() => column.toggleSorting(sorted === "asc")}
          >
            Role
            {renderSortIcon(sorted)}
          </Button>
        );
      },
      cell: ({ row }) => {
        const role = row.getValue("role") as string | null;
        return (
          <Badge variant={role === "admin" ? "default" : "secondary"}>
            {role ?? "user"}
          </Badge>
        );
      },
    },
    {
      id: "status",
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
      accessorFn: (row) => row.banned,
      cell: ({ row }) => {
        const user = row.original;
        const banned = user.banned === true;

        if (!banned) {
          return <Badge variant="outline">Active</Badge>;
        }

        return (
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="cursor-pointer">
                <Badge variant="destructive">Banned</Badge>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" side="bottom" align="start">
              <BanDetailsCard user={user} className="border-0 rounded-none" />
            </PopoverContent>
          </Popover>
        );
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
            Created
            {renderSortIcon(sorted)}
          </Button>
        );
      },
      cell: ({ row }) => <DateCell date={row.getValue("createdAt") as Date} />,
    },
    {
      accessorKey: "updatedAt",
      header: ({ column }) => {
        const sorted = column.getIsSorted();
        return (
          <Button
            variant="ghost"
            className={sorted ? "-ml-3 text-foreground" : "-ml-3"}
            onClick={() => column.toggleSorting(sorted === "asc")}
          >
            Updated
            {renderSortIcon(sorted)}
          </Button>
        );
      },
      cell: ({ row }) => <DateCell date={row.getValue("updatedAt") as Date} />,
    },
    {
      id: "emailVerified",
      header: "Email Verified",
      accessorFn: (row) => row.emailVerified,
      enableSorting: false,
      cell: ({ row }) => {
        return row.original.emailVerified ? (
          <Check className="h-4 w-4 text-green-600" />
        ) : (
          <X className="h-4 w-4 text-muted-foreground" />
        );
      },
    },
    {
      accessorKey: "phoneNumber",
      header: "Phone",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.phoneNumber || "—"}
        </span>
      ),
    },
    {
      id: "phoneNumberVerified",
      header: "Phone Verified",
      accessorFn: (row) => row.phoneNumberVerified,
      enableSorting: false,
      cell: ({ row }) => {
        if (!row.original.phoneNumber) return <span className="text-muted-foreground">—</span>;
        return row.original.phoneNumberVerified ? (
          <Check className="h-4 w-4 text-green-600" />
        ) : (
          <X className="h-4 w-4 text-muted-foreground" />
        );
      },
    },
    {
      id: "twoFactorEnabled",
      header: "2FA",
      accessorFn: (row) => row.twoFactorEnabled,
      enableSorting: false,
      cell: ({ row }) => {
        return row.original.twoFactorEnabled ? (
          <Check className="h-4 w-4 text-green-600" />
        ) : (
          <X className="h-4 w-4 text-muted-foreground" />
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <ActionsCell
          user={row.original}
          currentUserId={currentUserId}
          protectedEmails={protectedEmails}
        />
      ),
      enableHiding: false,
      size: 50,
    },
  ];
}
