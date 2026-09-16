"use client";

import { X } from "lucide-react";
import { AUDIT_ACTIONS, AUDIT_STATUSES, AUDIT_SOURCE_TRANSPORTS } from "@repo/backend";

import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system";

type FilterBarProps = {
  filterAction: string;
  onFilterActionChange: (value: string) => void;
  filterSource: string;
  onFilterSourceChange: (value: string) => void;
  filterStatus: string;
  onFilterStatusChange: (value: string) => void;
  total: number | undefined;
  loading: boolean;
};

export function FilterBar({
  filterAction,
  onFilterActionChange,
  filterSource,
  onFilterSourceChange,
  filterStatus,
  onFilterStatusChange,
  total,
  loading,
}: FilterBarProps) {
  const hasActiveFilters =
    filterAction !== "all" ||
    filterSource !== "all" ||
    filterStatus !== "all";

  const clearFilters = () => {
    onFilterActionChange("all");
    onFilterSourceChange("all");
    onFilterStatusChange("all");
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-3">
        <Select value={filterAction} onValueChange={onFilterActionChange}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {AUDIT_ACTIONS.map((action) => (
              <SelectItem key={action} value={action}>
                {action}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterSource} onValueChange={onFilterSourceChange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {AUDIT_SOURCE_TRANSPORTS.map((transport) => (
              <SelectItem key={transport} value={transport}>
                {transport}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={onFilterStatusChange}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {AUDIT_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1.5 h-3.5 w-3.5" />
            Clear filters
          </Button>
        )}

        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {loading ? "Loading..." : total !== undefined ? `${total} events` : ""}
        </span>
      </div>
    </div>
  );
}
