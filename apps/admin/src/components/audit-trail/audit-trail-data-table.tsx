"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { usePaginatedQuery } from "convex/react";
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
import { columns } from "./columns";
import { FilterBar } from "./filter-bar";

const INITIAL_NUM_ITEMS = 50;

export function AuditTrailDataTable() {
  const [filterAction, setFilterAction] = React.useState("all");
  const [filterSource, setFilterSource] = React.useState("all");
  const [filterStatus, setFilterStatus] = React.useState("all");

  const queryArgs = React.useMemo(() => {
    const args: Record<string, string | undefined> = {};
    if (filterAction !== "all") args.filterAction = filterAction;
    if (filterSource !== "all") args.filterSource = filterSource;
    if (filterStatus !== "all") args.filterStatus = filterStatus;
    return args;
  }, [filterAction, filterSource, filterStatus]);

  const { results, status, loadMore } = usePaginatedQuery(
    api.auditTrail.list,
    queryArgs,
    { initialNumItems: INITIAL_NUM_ITEMS },
  );

  const isLoadingFirst = status === "LoadingFirstPage";
  const isLoadingMore = status === "LoadingMore";
  const canLoadMore = status === "CanLoadMore";

  const table = useReactTable({
    data: results,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <FilterBar
          filterAction={filterAction}
          onFilterActionChange={setFilterAction}
          filterSource={filterSource}
          onFilterSourceChange={setFilterSource}
          filterStatus={filterStatus}
          onFilterStatusChange={setFilterStatus}
          total={results.length}
          loading={isLoadingFirst}
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
                            header.getContext(),
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoadingFirst ? (
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
                    No audit events found.
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

        {(canLoadMore || isLoadingMore) && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadMore(INITIAL_NUM_ITEMS)}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? "Loading..." : "Load more"}
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
