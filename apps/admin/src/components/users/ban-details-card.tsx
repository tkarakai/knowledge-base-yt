"use client";

import type { AdminUser } from "@/lib/admin-api";
import { useTimeAgo, useTimeUntil } from "@/hooks/use-relative-time";

function formatDateTime(date: Date): string {
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function BanDateRow({ label, date, relative }: {
  label: string;
  date: Date;
  relative: string;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <div className="text-right">
        <div className="font-medium">{formatDateTime(date)}</div>
        <div className="text-xs text-muted-foreground">{relative}</div>
      </div>
    </div>
  );
}

type BanDetailsCardProps = {
  user: AdminUser;
  className?: string;
};

export function BanDetailsCard({ user, className }: BanDetailsCardProps) {
  const bannedAt = user.updatedAt;
  const banExpires = user.banExpires ? new Date(user.banExpires) : null;
  const bannedAgo = useTimeAgo(bannedAt);
  const expiresIn = useTimeUntil(banExpires);

  return (
    <div className={`space-y-3 rounded-md border bg-muted/50 p-3 text-sm ${className ?? ""}`}>
      <BanDateRow label="Banned" date={bannedAt} relative={bannedAgo} />

      <div className="flex justify-between gap-4">
        <span className="shrink-0 text-muted-foreground">Expires</span>
        {banExpires ? (
          <div className="text-right">
            <div className="font-medium">{formatDateTime(banExpires)}</div>
            <div className="text-xs text-muted-foreground">{expiresIn}</div>
          </div>
        ) : (
          <span className="font-medium">Permanent</span>
        )}
      </div>

      <div className="flex justify-between gap-4">
        <span className="shrink-0 text-muted-foreground">Reason</span>
        <span className="text-right font-medium">
          {user.banReason || "No reason provided"}
        </span>
      </div>
    </div>
  );
}
