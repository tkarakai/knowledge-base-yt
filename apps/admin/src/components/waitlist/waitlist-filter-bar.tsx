"use client";

import { Mail, Plus, Trash2 } from "lucide-react";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system";

type WaitlistFilterBarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  onInvite: () => void;
  selectedCount: number;
  onBatchInvite: () => void;
  onBatchDelete: () => void;
  total: number;
  loading: boolean;
};

export function WaitlistFilterBar({
  searchValue,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onInvite,
  selectedCount,
  onBatchInvite,
  onBatchDelete,
  total,
  loading,
}: WaitlistFilterBarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 items-center gap-3">
        <Input
          placeholder="Search by name or email..."
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="waiting">Waiting</SelectItem>
            <SelectItem value="invited">Invited</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="claimed">Claimed</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {loading ? "Loading..." : `${total} entries`}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {selectedCount > 0 && (
          <>
            <span className="text-sm text-muted-foreground">
              {selectedCount} selected
            </span>
            <Button variant="outline" size="sm" onClick={onBatchInvite}>
              <Mail className="mr-1.5 h-3.5 w-3.5" />
              Invite
            </Button>
            <Button variant="destructive" size="sm" onClick={onBatchDelete}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </Button>
            <div className="h-4 w-px bg-border" aria-hidden="true" />
          </>
        )}
        <Button size="sm" onClick={onInvite}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Invite
        </Button>
      </div>
    </div>
  );
}
