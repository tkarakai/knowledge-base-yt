"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/design-system";
import type { AdminUser } from "@/lib/admin-api";
import { BanDetailsCard } from "./ban-details-card";

type UnbanDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AdminUser;
  pending?: boolean;
  onConfirm: () => void;
};

export function UnbanDialog({
  open,
  onOpenChange,
  user,
  pending = false,
  onConfirm,
}: UnbanDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unban {user.email}</AlertDialogTitle>
          <AlertDialogDescription>
            Review the ban details below before lifting the ban.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <BanDetailsCard user={user} />

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={pending}>
            {pending ? "Processing..." : "Unban user"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
