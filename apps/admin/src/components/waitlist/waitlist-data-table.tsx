"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { useMutation, usePaginatedQuery } from "convex/react";
import { toast } from "sonner";

import { api } from "@repo/backend";
import {
  Button,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TooltipProvider,
} from "@repo/design-system";
import type {
  WaitlistAction,
  WaitlistEntry,
} from "./waitlist-actions-context";
import { WaitlistActionsProvider } from "./waitlist-actions-context";
import { createColumns } from "./columns";
import { WaitlistFilterBar } from "./waitlist-filter-bar";
import { ConfirmationDialog } from "../users/confirmation-dialog";
import { WaitlistBatchDialog } from "./waitlist-batch-dialog";
import { WaitlistInviteDialog } from "./waitlist-invite-dialog";

const SEARCH_DEBOUNCE = 300;
const PAGE_SIZE = 50;

export function WaitlistDataTable() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.waitlist.list,
    {},
    { initialNumItems: PAGE_SIZE }
  );
  const inviteMutation = useMutation(api.waitlist.invite);
  const inviteManyMutation = useMutation(api.waitlist.inviteMany);
  const uninviteMutation = useMutation(api.waitlist.uninvite);
  const removeMutation = useMutation(api.waitlist.remove);

  const loading = status === "LoadingFirstPage";
  const loadingMore = status === "LoadingMore";
  const canLoadMore = status === "CanLoadMore";

  // Filter state
  const [searchInput, setSearchInput] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");

  // Table state
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [rowSelection, setRowSelection] = React.useState<
    Record<string, boolean>
  >({});

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedSearch(searchInput),
      SEARCH_DEBOUNCE
    );
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Client-side filtering
  const filteredEntries = React.useMemo(() => {
    if (!results) return [];

    let entries = results;

    // Status filter
    if (statusFilter === "expired") {
      entries = entries.filter((e) => e.invitationExpired);
    } else if (statusFilter !== "all") {
      entries = entries.filter(
        (e) => e.status === statusFilter && !e.invitationExpired
      );
    }

    // Search filter
    if (debouncedSearch) {
      const lower = debouncedSearch.toLowerCase();
      entries = entries.filter((e) =>
        e.email.toLowerCase().includes(lower)
      );
    }

    return entries;
  }, [results, statusFilter, debouncedSearch]);

  // Clear selection when filters change
  React.useEffect(() => {
    setRowSelection({});
  }, [debouncedSearch, statusFilter]);

  const columns = React.useMemo(
    () => createColumns({ searchTerm: debouncedSearch }),
    [debouncedSearch]
  );

  const table = useReactTable({
    data: filteredEntries,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row._id,
  });

  // ----- Dialog state -----

  const [singleAction, setSingleAction] = React.useState<{
    action: WaitlistAction;
    entries: WaitlistEntry[];
  } | null>(null);
  const [singlePending, setSinglePending] = React.useState(false);

  const [batchAction, setBatchAction] = React.useState<{
    action: WaitlistAction;
    entries: WaitlistEntry[];
  } | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = React.useState(false);

  const selectedEntries = React.useMemo(() => {
    const ids = Object.keys(rowSelection).filter((id) => rowSelection[id]);
    return filteredEntries.filter(
      (e) => ids.includes(e._id) && e.status !== "claimed"
    );
  }, [rowSelection, filteredEntries]);

  // ----- Action routing -----

  const handleAction = React.useCallback(
    (action: WaitlistAction, entries: WaitlistEntry[]) => {
      if (entries.length === 1) {
        setSingleAction({ action, entries });
      } else {
        setBatchAction({ action, entries });
      }
    },
    []
  );

  // ----- Single action confirm -----

  const handleSingleConfirm = async () => {
    if (!singleAction) return;
    const { action, entries } = singleAction;
    const entry = entries[0];

    setSinglePending(true);
    try {
      if (action === "invite") {
        await inviteMutation({ entryId: entry._id });
        toast.success(`Invitation sent to ${entry.email}`);
      } else if (action === "uninvite") {
        await uninviteMutation({ entryId: entry._id });
        toast.success(`Invitation revoked for ${entry.email}`);
      } else if (action === "delete") {
        await removeMutation({ entryId: entry._id });
        toast.success(`${entry.email} removed from waitlist`);
      }
      setSingleAction(null);
      setRowSelection({});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setSinglePending(false);
    }
  };

  // ----- Batch action -----

  const handleBatchClose = () => {
    setBatchAction(null);
    setRowSelection({});
  };

  const handleBatchCancel = () => {
    setBatchAction(null);
  };

  const batchExecutor = React.useCallback(
    async (entry: WaitlistEntry) => {
      if (!batchAction) return;
      if (batchAction.action === "invite") {
        if (entry.status !== "waiting" && !entry.invitationExpired) return;
        await inviteMutation({ entryId: entry._id });
      } else if (batchAction.action === "uninvite") {
        if (entry.status !== "invited" || entry.invitationExpired) return;
        await uninviteMutation({ entryId: entry._id });
      } else if (batchAction.action === "delete") {
        if (entry.status === "claimed") return;
        await removeMutation({ entryId: entry._id });
      }
    },
    [batchAction, inviteMutation, uninviteMutation, removeMutation]
  );

  // ----- Label helpers -----

  const actionLabel = (action: WaitlistAction): string => {
    const labels: Record<WaitlistAction, string> = {
      invite: "Invite",
      uninvite: "Revoke invitation",
      delete: "Delete",
    };
    return labels[action];
  };

  const actionDescription = (
    action: WaitlistAction,
    target: string
  ): string => {
    if (action === "invite")
      return `Send an invitation email to ${target}?`;
    if (action === "uninvite")
      return `Revoke the invitation for ${target}? They will be moved back to the waiting list.`;
    if (action === "delete")
      return `Are you sure you want to delete ${target} from the waitlist? This action cannot be undone.`;
    return `Are you sure you want to ${action} ${target}?`;
  };

  const batchDescriptionText = React.useCallback(
    (action: WaitlistAction, entries: WaitlistEntry[]): string => {
      const count = entries.length;
      if (action === "invite") {
        const applicable = entries.filter(
          (e) => e.status === "waiting" || e.invitationExpired
        ).length;
        if (applicable === 0)
          return "None of the selected entries can be invited.";
        if (applicable < count)
          return `${applicable} of ${count} selected entries will be invited (${count - applicable} not eligible).`;
        return `Send invitations to ${count} selected entries?`;
      }
      if (action === "delete")
        return `Are you sure you want to delete ${count} selected entries? This action cannot be undone.`;
      return `Are you sure you want to ${action} ${count} selected entries?`;
    },
    []
  );

  const batchApplicableEntries = React.useMemo(() => {
    if (!batchAction) return [];
    if (batchAction.action === "invite")
      return batchAction.entries.filter(
        (e) => e.status === "waiting" || e.invitationExpired
      );
    if (batchAction.action === "uninvite")
      return batchAction.entries.filter(
        (e) => e.status === "invited" && !e.invitationExpired
      );
    if (batchAction.action === "delete")
      return batchAction.entries.filter((e) => e.status !== "claimed");
    return batchAction.entries;
  }, [batchAction]);

  const handleInviteMany = React.useCallback(
    async (emails: string[]) => {
      const result = await inviteManyMutation({ emails });
      const invitedCount = result.invited.length;
      const skippedCount = result.skipped.length;

      if (invitedCount === 0) {
        const firstSkipped = result.skipped[0];
        throw new Error(
          firstSkipped
            ? `No invitations were sent (${firstSkipped.email}: ${firstSkipped.reason}).`
            : "No invitations were sent."
        );
      }

      toast.success(
        invitedCount === 1
          ? `Invitation sent to ${result.invited[0]}`
          : `Invitations sent to ${invitedCount} people`
      );

      if (skippedCount > 0) {
        toast.message(
          `${skippedCount} address${skippedCount === 1 ? " was" : "es were"} skipped.`
        );
      }
    },
    [inviteManyMutation]
  );

  return (
    <WaitlistActionsProvider onAction={handleAction}>
      <TooltipProvider>
        <div className="space-y-4">
          <WaitlistFilterBar
            searchValue={searchInput}
            onSearchChange={setSearchInput}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            onInvite={() => setInviteDialogOpen(true)}
            selectedCount={selectedEntries.length}
            onBatchInvite={() => handleAction("invite", selectedEntries)}
            onBatchDelete={() => handleAction("delete", selectedEntries)}
            total={filteredEntries.length}
            loading={loading}
          />

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
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
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
                      No waitlist entries found.
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={
                        row.getIsSelected() ? "selected" : undefined
                      }
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
        </div>

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
      </TooltipProvider>

      {/* Single-entry confirmation dialog */}
      <WaitlistInviteDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        onInvite={handleInviteMany}
      />

      {/* Single-entry confirmation dialog */}
      {singleAction && singleAction.entries.length === 1 && (
        <ConfirmationDialog
          open
          onOpenChange={(open) => {
            if (!open) setSingleAction(null);
          }}
          title={`${actionLabel(singleAction.action)} entry`}
          description={actionDescription(
            singleAction.action,
            singleAction.entries[0].email
          )}
          confirmLabel={actionLabel(singleAction.action)}
          destructive={singleAction.action === "delete"}
          pending={singlePending}
          onConfirm={handleSingleConfirm}
        />
      )}

      {/* Batch action dialog with progress */}
      {batchAction && batchAction.entries.length > 0 && (
        <WaitlistBatchDialog
          open
          onClose={handleBatchClose}
          onCancel={handleBatchCancel}
          title={`${actionLabel(batchAction.action)} ${batchAction.entries.length} entries`}
          description={batchDescriptionText(
            batchAction.action,
            batchAction.entries
          )}
          confirmLabel={`${actionLabel(batchAction.action)} all`}
          destructive={batchAction.action === "delete"}
          entries={batchApplicableEntries}
          action={batchExecutor}
          confirmDisabled={batchApplicableEntries.length === 0}
        />
      )}
    </WaitlistActionsProvider>
  );
}
