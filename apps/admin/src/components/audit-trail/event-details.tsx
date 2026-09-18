"use client";

import { AlertTriangle, Eye } from "lucide-react";

import {
  Badge,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system";
import type { Doc } from "@repo/backend";

type AuditEvent = Doc<"auditTrail">;

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function JsonBlock({ label, value }: { label: string; value: string }) {
  const parsed = tryParseJson(value);
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      <pre className="rounded bg-muted p-2 text-xs overflow-auto max-h-40">
        {typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2)}
      </pre>
    </div>
  );
}

export function EventDetails({ event }: { event: AuditEvent }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <Eye className="h-3.5 w-3.5" />
          <span className="sr-only">View details</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 max-h-[500px] overflow-auto" side="left" align="start">
        <div className="space-y-3">
          <p className="text-sm font-semibold">Event Details</p>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">ID</span>
              <p className="font-mono break-all">{event._id}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Received At</span>
              <p>
                {new Date(event._creationTime).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </p>
            </div>
          </div>

          {event.authenticatedUserId && (
            <div className="text-xs">
              <span className="text-muted-foreground">Authenticated User ID</span>
              <p className="font-mono break-all">{event.authenticatedUserId}</p>
            </div>
          )}

          {event.truncatedFields && (
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs text-amber-600 dark:text-amber-400">
                Truncated fields: {event.truncatedFields.split(",").map((f) => (
                  <Badge key={f} variant="outline" className="ml-1 text-[10px] px-1 py-0">
                    {f}
                  </Badge>
                ))}
              </span>
            </div>
          )}

          {event.reason && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Reason</p>
              <p className="text-sm">{event.reason}</p>
            </div>
          )}

          {event.oldValue && <JsonBlock label="Old Value" value={event.oldValue} />}
          {event.newValue && <JsonBlock label="New Value" value={event.newValue} />}
          {event.meta && <JsonBlock label="Metadata" value={event.meta} />}
        </div>
      </PopoverContent>
    </Popover>
  );
}
