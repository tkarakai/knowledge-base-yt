"use client";

import * as React from "react";
import { fetchUsers, type AdminUser, type FetchUsersParams } from "@/lib/admin-api";

const PAGE_SIZE = 50;

type FilterParams = {
  searchValue?: string;
  filterField?: string;
  filterValue?: string;
  filterOperator?: "eq" | "ne";
  sortBy?: string;
  sortDirection?: "asc" | "desc";
};

type UseUsersReturn = {
  users: AdminUser[];
  total: number;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
};

export function useUsers(filters: FilterParams): UseUsersReturn {
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [offset, setOffset] = React.useState(0);

  // Track the current filter identity to detect changes.
  const filterKey = JSON.stringify(filters);
  const prevFilterKey = React.useRef(filterKey);

  const fetchPage = React.useCallback(
    async (pageOffset: number, append: boolean) => {
      const baseParams: FetchUsersParams = {
        limit: PAGE_SIZE,
        offset: pageOffset,
      };

      if (filters.filterField) {
        baseParams.filterField = filters.filterField;
        baseParams.filterValue = filters.filterValue;
        baseParams.filterOperator = filters.filterOperator ?? "eq";
      }

      if (filters.sortBy) {
        baseParams.sortBy = filters.sortBy;
        baseParams.sortDirection = filters.sortDirection ?? "asc";
      }

      if (filters.searchValue) {
        // Search both name and email in parallel, then merge & dedupe.
        const [byName, byEmail] = await Promise.all([
          fetchUsers({ ...baseParams, searchValue: filters.searchValue, searchField: "name", searchOperator: "contains" }),
          fetchUsers({ ...baseParams, searchValue: filters.searchValue, searchField: "email", searchOperator: "contains" }),
        ]);
        const seen = new Set<string>();
        const merged: AdminUser[] = [];
        for (const u of [...byName.users, ...byEmail.users]) {
          if (!seen.has(u.id)) {
            seen.add(u.id);
            merged.push(u);
          }
        }
        setUsers((prev) => (append ? [...prev, ...merged] : merged));
        // Upper-bound total (may include overlap — acceptable for admin panel).
        setTotal(Math.max(byName.total, byEmail.total, merged.length));
        setOffset(pageOffset + PAGE_SIZE);
      } else {
        const result = await fetchUsers(baseParams);
        setUsers((prev) => (append ? [...prev, ...result.users] : result.users));
        setTotal(result.total);
        setOffset(pageOffset + result.users.length);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterKey],
  );

  // Initial load or filter change: reset and fetch from offset 0.
  React.useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        await fetchPage(0, false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    prevFilterKey.current = filterKey;
    load();

    return () => {
      cancelled = true;
    };
  }, [fetchPage, filterKey]);

  const loadMore = React.useCallback(async () => {
    setLoadingMore(true);
    try {
      await fetchPage(offset, true);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, offset]);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      await fetchPage(0, false);
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  const hasMore = users.length < total;

  return { users, total, loading, loadingMore, hasMore, loadMore, refresh };
}
