"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";
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
import type { AdminUser } from "@/lib/admin-api";
import { banUser, unbanUser, removeUser, setUserRole } from "@/lib/admin-api";
import { useUsers } from "@/hooks/use-users";
import { useAuthUser } from "@/components/auth/auth-guard";
import { createColumns } from "./columns";
import { FilterBar } from "./filter-bar";
import { ConfirmationDialog } from "./confirmation-dialog";
import { BanDialog } from "./ban-dialog";
import { UnbanDialog } from "./unban-dialog";
import { BatchActionDialog } from "./batch-action-dialog";
import { UserActionsProvider } from "./user-actions-context";
import { UserSessionsDialog } from "./user-sessions-dialog";

type UserAction =
  | "ban"
  | "unban"
  | "delete"
  | "makeAdmin"
  | "removeAdmin"
  | "sessions";

type PendingAction = {
  action: UserAction;
  users: AdminUser[];
};

/** Column sort IDs that differ from server field names. */
const SORT_FIELD_MAP: Record<string, string> = {
  status: "banned",
};

/** Columns that must be sorted client-side (server can't sort booleans via query params). */
const CLIENT_SORT_COLUMNS = new Set(["status"]);

/** Default column visibility — optional columns hidden by default. */
const DEFAULT_COLUMN_VISIBILITY: VisibilityState = {
  image: false,
  updatedAt: false,
  emailVerified: false,
  phoneNumber: false,
  phoneNumberVerified: false,
  twoFactorEnabled: false,
};

/** Debounce delay for name search (ms). */
const SEARCH_DEBOUNCE = 300;

export function UsersDataTable() {
  const authUser = useAuthUser();
  const currentUserId = authUser?.id;
  const postAuditEvent = useMutation(api.auditTrail.postEvent);

  // Protected admin emails (from adminEmails table) — these users cannot be banned/deleted/demoted.
  const protectedEmailsList = useQuery(api.adminEmails.listProtected);
  const protectedEmails = React.useMemo(
    () => new Set(protectedEmailsList ?? []),
    [protectedEmailsList],
  );

  // Filter state
  const [searchInput, setSearchInput] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");

  // Table state
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(DEFAULT_COLUMN_VISIBILITY);

  // Debounce search input.
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), SEARCH_DEBOUNCE);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Build server-side sort/search params (status filtering + sorting done client-side).
  const filterParams = React.useMemo(() => {
    const params: Record<string, string | undefined> = {};

    if (debouncedSearch) {
      params.searchValue = debouncedSearch;
    }

    // Server-side sorting: map column IDs to DB field names (skip client-sorted columns).
    if (sorting.length > 0 && !CLIENT_SORT_COLUMNS.has(sorting[0].id)) {
      const columnId = sorting[0].id;
      params.sortBy = SORT_FIELD_MAP[columnId] ?? columnId;
      params.sortDirection = sorting[0].desc ? "desc" : "asc";
    }

    return params;
  }, [debouncedSearch, sorting]);

  const { users: allUsers, total, loading, loadingMore, hasMore, loadMore, refresh } =
    useUsers(filterParams);

  // Client-side status filtering (server-side boolean filter doesn't work with string query params).
  const filteredUsers = React.useMemo(() => {
    if (statusFilter === "active") return allUsers.filter((u) => u.banned !== true);
    if (statusFilter === "banned") return allUsers.filter((u) => u.banned === true);
    return allUsers;
  }, [allUsers, statusFilter]);

  // Client-side sorting for columns that can't be sorted server-side (e.g. boolean fields).
  const sortedUsers = React.useMemo(() => {
    if (sorting.length > 0 && sorting[0].id === "status") {
      const dir = sorting[0].desc ? -1 : 1;
      return [...filteredUsers].sort((a, b) => {
        const aVal = a.banned === true ? 1 : 0;
        const bVal = b.banned === true ? 1 : 0;
        return (aVal - bVal) * dir;
      });
    }
    return filteredUsers;
  }, [filteredUsers, sorting]);

  const filteredTotal = statusFilter === "all" ? total : filteredUsers.length;

  // Clear selection when filters or sorting change.
  React.useEffect(() => {
    setRowSelection({});
  }, [debouncedSearch, statusFilter, sorting]);

  const columns = React.useMemo(
    () => createColumns({ currentUserId, protectedEmails, searchTerm: debouncedSearch }),
    [currentUserId, protectedEmails, debouncedSearch],
  );

  const table = useReactTable({
    data: sortedUsers,
    columns,
    state: { sorting, rowSelection, columnVisibility },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    getRowId: (row) => row.id,
  });

  // ----- Dialog state -----

  // Ban dialog (single + batch)
  const [banTarget, setBanTarget] = React.useState<AdminUser[] | null>(null);
  const [banPending, setBanPending] = React.useState(false);

  // Unban dialog (single only)
  const [unbanTarget, setUnbanTarget] = React.useState<AdminUser | null>(null);
  const [unbanPending, setUnbanPending] = React.useState(false);

  // Simple confirmation dialog (delete, role change)
  const [singleAction, setSingleAction] = React.useState<PendingAction | null>(null);
  const [singlePending, setSinglePending] = React.useState(false);

  // Batch action dialog (unban batch, delete batch)
  const [batchAction, setBatchAction] = React.useState<PendingAction | null>(null);
  const [sessionsTarget, setSessionsTarget] = React.useState<AdminUser | null>(null);

  // Ban params ref for batch ban execution
  const batchBanParamsRef = React.useRef<{
    banReason: string;
    banExpiresIn?: number;
  } | null>(null);

  const selectedUsers = React.useMemo(() => {
    const ids = Object.keys(rowSelection).filter((id) => rowSelection[id]);
    return sortedUsers
      .filter((u) => ids.includes(u.id))
      // Exclude self and protected from batch operations
      .filter((u) => u.id !== currentUserId && !protectedEmails.has(u.email));
  }, [rowSelection, sortedUsers, currentUserId, protectedEmails]);

  // ----- Action routing -----

  const handleAction = React.useCallback(
    (action: UserAction, actionUsers: AdminUser[]) => {
      if (action === "sessions") {
        if (actionUsers.length === 1) {
          setSessionsTarget(actionUsers[0]);
        }
      } else if (action === "ban") {
        setBanTarget(actionUsers);
      } else if (action === "unban" && actionUsers.length === 1) {
        setUnbanTarget(actionUsers[0]);
      } else if (actionUsers.length === 1) {
        setSingleAction({ action, users: actionUsers });
      } else {
        setBatchAction({ action, users: actionUsers });
      }
    },
    [],
  );

  // ----- Ban confirm -----

  const handleBanConfirm = async (banReason: string, banExpiresIn?: number) => {
    if (!banTarget) return;

    if (banTarget.length === 1) {
      setBanPending(true);
      try {
        await banUser(banTarget[0].id, banReason, banExpiresIn, postAuditEvent);
        toast.success(`${banTarget[0].email} has been banned`);
        setBanTarget(null);
        setRowSelection({});
        refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to ban user");
      } finally {
        setBanPending(false);
      }
    } else {
      // Batch: close ban dialog, transfer to batch dialog with stored params.
      const usersToProcess = banTarget;
      batchBanParamsRef.current = { banReason, banExpiresIn };
      setBanTarget(null);
      setBatchAction({ action: "ban", users: usersToProcess });
    }
  };

  // ----- Unban confirm -----

  const handleUnbanConfirm = async () => {
    if (!unbanTarget) return;
    setUnbanPending(true);
    try {
      await unbanUser(unbanTarget.id, postAuditEvent);
      toast.success(`${unbanTarget.email} has been unbanned`);
      setUnbanTarget(null);
      setRowSelection({});
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to unban user");
    } finally {
      setUnbanPending(false);
    }
  };

  // ----- Single action confirm (delete, role change) -----

  const handleSingleConfirm = async () => {
    if (!singleAction) return;
    const { action, users: actionUsers } = singleAction;
    const user = actionUsers[0];

    setSinglePending(true);
    try {
      if (action === "delete") await removeUser(user.id, postAuditEvent);
      else if (action === "makeAdmin") await setUserRole(user.id, "admin", postAuditEvent);
      else if (action === "removeAdmin") await setUserRole(user.id, "user", postAuditEvent);

      const messages: Record<string, string> = {
        delete: `${user.email} has been deleted`,
        makeAdmin: `${user.email} is now an admin`,
        removeAdmin: `${user.email} is no longer an admin`,
      };
      toast.success(messages[action] ?? "Action completed");
      setSingleAction(null);
      setRowSelection({});
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setSinglePending(false);
    }
  };

  // ----- Batch action -----

  const handleBatchClose = () => {
    batchBanParamsRef.current = null;
    setBatchAction(null);
    setRowSelection({});
    refresh();
  };

  const handleBatchCancel = () => {
    batchBanParamsRef.current = null;
    setBatchAction(null);
  };

  const batchExecutor = React.useCallback(
    async (user: AdminUser) => {
      if (!batchAction) return;
      if (batchAction.action === "ban") {
        if (user.banned === true) return; // Already banned — skip (defense-in-depth)
        const params = batchBanParamsRef.current;
        await banUser(user.id, params?.banReason ?? "", params?.banExpiresIn, postAuditEvent);
      } else if (batchAction.action === "unban") {
        if (user.banned !== true) return; // Not banned — skip (defense-in-depth)
        await unbanUser(user.id, postAuditEvent);
      } else if (batchAction.action === "delete") {
        await removeUser(user.id, postAuditEvent);
      }
    },
    [batchAction, postAuditEvent],
  );

  // ----- Label helpers -----

  const actionLabel = (action: UserAction): string => {
    const labels: Record<UserAction, string> = {
      ban: "Ban",
      unban: "Unban",
      delete: "Delete",
      makeAdmin: "Make admin",
      removeAdmin: "Remove admin",
      sessions: "Sessions",
    };
    return labels[action];
  };

  const actionDescription = (action: UserAction, target: string): string => {
    if (action === "delete") {
      return `Are you sure you want to delete ${target}? This action cannot be undone.`;
    }
    if (action === "makeAdmin") {
      return `Are you sure you want to grant admin privileges to ${target}?`;
    }
    if (action === "removeAdmin") {
      return `Are you sure you want to remove admin privileges from ${target}?`;
    }
    return `Are you sure you want to ${action} ${target}?`;
  };

  // Batch description with applicable count info.
  const batchDescriptionText = React.useCallback(
    (action: UserAction, actionUsers: AdminUser[]): string => {
      const totalCount = actionUsers.length;

      if (action === "ban") {
        const applicable = actionUsers.filter((u) => u.banned !== true).length;
        if (applicable === 0) return "None of the selected users can be banned (all are already banned).";
        if (applicable < totalCount)
          return `${applicable} of ${totalCount} selected users will be banned (${totalCount - applicable} already banned).`;
        return `Are you sure you want to ban ${totalCount} selected users?`;
      }
      if (action === "unban") {
        const applicable = actionUsers.filter((u) => u.banned === true).length;
        if (applicable === 0) return "None of the selected users can be unbanned (none are banned).";
        if (applicable < totalCount)
          return `${applicable} of ${totalCount} selected users will be unbanned (${totalCount - applicable} not banned).`;
        return `Are you sure you want to unban ${totalCount} selected users?`;
      }
      if (action === "delete") {
        return `Are you sure you want to delete ${totalCount} selected users? This action cannot be undone.`;
      }
      return `Are you sure you want to ${action} ${totalCount} selected users?`;
    },
    [],
  );

  // Compute applicable users for batch operations.
  const batchApplicableUsers = React.useMemo(() => {
    if (!batchAction) return [];
    if (batchAction.action === "ban") return batchAction.users.filter((u) => u.banned !== true);
    if (batchAction.action === "unban") return batchAction.users.filter((u) => u.banned === true);
    return batchAction.users;
  }, [batchAction]);

  return (
    <UserActionsProvider onAction={handleAction}>
      <TooltipProvider>
        <div className="space-y-4">
          <FilterBar
            searchValue={searchInput}
            onSearchChange={setSearchInput}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            selectedCount={selectedUsers.length}
            onBatchBan={() => handleAction("ban", selectedUsers)}
            onBatchUnban={() => handleAction("unban", selectedUsers)}
            onBatchDelete={() => handleAction("delete", selectedUsers)}
            table={table}
            total={filteredTotal}
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
                          : flexRender(header.column.columnDef.header, header.getContext())}
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
                      No users found.
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() ? "selected" : undefined}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {hasMore && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading..." : "Load more"}
              </Button>
            </div>
          )}
        </div>
      </TooltipProvider>

      {/* Ban dialog (single + batch collection) */}
      {banTarget && (
        <BanDialog
          open
          onOpenChange={(open) => {
            if (!open) setBanTarget(null);
          }}
          users={banTarget}
          pending={banPending}
          onConfirm={handleBanConfirm}
        />
      )}

      {/* Unban dialog (single) */}
      {unbanTarget && (
        <UnbanDialog
          open
          onOpenChange={(open) => {
            if (!open) setUnbanTarget(null);
          }}
          user={unbanTarget}
          pending={unbanPending}
          onConfirm={handleUnbanConfirm}
        />
      )}

      {/* Single-user confirmation dialog (delete, role change) */}
      {singleAction && singleAction.users.length === 1 && (
        <ConfirmationDialog
          open
          onOpenChange={(open) => {
            if (!open) setSingleAction(null);
          }}
          title={`${actionLabel(singleAction.action)} user`}
          description={actionDescription(singleAction.action, singleAction.users[0].email)}
          confirmLabel={actionLabel(singleAction.action)}
          destructive={singleAction.action === "delete"}
          pending={singlePending}
          onConfirm={handleSingleConfirm}
        />
      )}

      {/* Batch action dialog with progress */}
      {batchAction && batchAction.users.length > 0 && (
        <BatchActionDialog
          open
          onClose={handleBatchClose}
          onCancel={handleBatchCancel}
          title={`${actionLabel(batchAction.action)} ${batchAction.users.length} users`}
          description={batchDescriptionText(batchAction.action, batchAction.users)}
          confirmLabel={`${actionLabel(batchAction.action)} all`}
          destructive={batchAction.action === "delete"}
          users={batchApplicableUsers}
          action={batchExecutor}
          confirmDisabled={batchApplicableUsers.length === 0}
        />
      )}

      <UserSessionsDialog
        open={sessionsTarget !== null}
        onOpenChange={(open) => {
          if (!open) setSessionsTarget(null);
        }}
        user={sessionsTarget}
      />
    </UserActionsProvider>
  );
}
