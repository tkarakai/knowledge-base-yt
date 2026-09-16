"use client";

import type { Table } from "@tanstack/react-table";
import { Settings2 } from "lucide-react";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@repo/design-system";
import type { AdminUser } from "@/lib/admin-api";

const COLUMN_LABELS: Record<string, string> = {
  image: "Avatar",
  name: "Name",
  email: "Email",
  role: "Role",
  status: "Status",
  createdAt: "Created",
  updatedAt: "Updated",
  emailVerified: "Email Verified",
  phoneNumber: "Phone",
  phoneNumberVerified: "Phone Verified",
  twoFactorEnabled: "2FA",
};

type ColumnSelectorProps = {
  table: Table<AdminUser>;
};

export function ColumnSelector({ table }: ColumnSelectorProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-1.5">
          <Settings2 className="h-3.5 w-3.5" />
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[180px]">
        {table
          .getAllColumns()
          .filter((column) => column.getCanHide())
          .map((column) => (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={column.getIsVisible()}
              onCheckedChange={(value) => column.toggleVisibility(!!value)}
              onSelect={(e) => e.preventDefault()}
            >
              {COLUMN_LABELS[column.id] ?? column.id}
            </DropdownMenuCheckboxItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
