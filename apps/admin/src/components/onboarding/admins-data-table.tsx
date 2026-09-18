"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { toast } from "sonner";

import { api } from "@repo/backend";
import type { Doc } from "@repo/backend";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
import { ConfirmationDialog } from "../users/confirmation-dialog";
import { InviteAdminDialog } from "./invite-admin-dialog";

const PAGE_SIZE = 50;

type AdminInvitation = Doc<"adminInvitations"> & {
  invitationExpired: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

const STATUS_BADGE: Record<
  string,
  { label: string; variant: "outline" | "default" | "secondary" | "destructive" }
> = {
  invited: { label: "Invited", variant: "default" },
  expired: { label: "Invitation Expired", variant: "destructive" },
  claimed: { label: "Claimed", variant: "secondary" },
};

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

function createColumns(
  onDelete: (entry: AdminInvitation) => void
): ColumnDef<AdminInvitation>[] {
  return [
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
            Created
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
      cell: ({ row }) => {
        const entry = row.original;
        if (entry.status === "claimed") return null;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => onDelete(entry)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableHiding: false,
      size: 50,
    },
  ];
}

// ---------------------------------------------------------------------------
// AdminsDataTable
// ---------------------------------------------------------------------------

export function AdminsDataTable() {
  const [inviteOpen, setInviteOpen] = React.useState(false);

  const { results, status, loadMore } = usePaginatedQuery(
    api.adminInvitations.list,
    {},
    { initialNumItems: PAGE_SIZE }
  );

  const inviteMutation = useMutation(api.adminInvitations.invite);
  const removeMutation = useMutation(api.adminInvitations.remove);

  const loading = status === "LoadingFirstPage";
  const loadingMore = status === "LoadingMore";
  const canLoadMore = status === "CanLoadMore";

  const entries = results ?? [];

  // Table state
  const [sorting, setSorting] = React.useState<SortingState>([]);

  // ----- Delete dialog state -----

  const [deleteTarget, setDeleteTarget] = React.useState<AdminInvitation | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);

  const columns = React.useMemo(
    () => createColumns(setDeleteTarget),
    []
  );

  const table = useReactTable({
    data: entries,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row._id,
  });

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeletePending(true);
    try {
      await removeMutation({ entryId: deleteTarget._id });
      toast.success(`${deleteTarget.email} removed`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setDeletePending(false);
    }
  };

  // ----- Invite handler -----

  const handleInvite = React.useCallback(
    async (email: string) => {
      try {
        await inviteMutation({ email });
        toast.success(`Invitation sent to ${email}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to send invitation.";
        throw new Error(message, { cause: err });
      }
    },
    [inviteMutation]
  );

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Loading admins..."
              : `${entries.length} admin invitation${entries.length !== 1 ? "s" : ""}`}
          </p>
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Invite Admin
          </Button>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    {table.getVisibleFlatColumns().map((col) => (
                      <TableCell key={`skeleton-${i}-${col.id}`}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={table.getVisibleFlatColumns().length}
                    className="h-24 text-center"
                  >
                    No admin invitations found.
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Load more */}
        {(canLoadMore || loadingMore) && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadMore(PAGE_SIZE)}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading..." : "Load more"}
            </Button>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <ConfirmationDialog
          open
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
          title="Delete admin invitation"
          description={`Are you sure you want to delete the invitation for ${deleteTarget.email}? This action cannot be undone.`}
          confirmLabel="Delete"
          destructive
          pending={deletePending}
          onConfirm={handleDeleteConfirm}
        />
      )}

      <InviteAdminDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvite={handleInvite}
      />
    </TooltipProvider>
  );
}
