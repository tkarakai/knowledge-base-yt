"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import {
  Archive,
  ArrowDown,
  ArrowUpDown,
  ArrowUp,
  Eye,
  Info,
  MoreHorizontal,
  Pencil,
  Plus,
  Radio,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@repo/backend";
import type { Id } from "@repo/backend";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Checkbox,
  DateTimeWithTimezone,
  DateTimePicker,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  cn,
} from "@repo/design-system";

type AnnouncementFormState = {
  name: string;
  bannerText: string;
  callToActionName: string;
  callToActionUrl: string;
  learnMoreName: string;
  learnMoreContent: string;
  scheduleStart: number | undefined;
  scheduleEnd: number | undefined;
};

type AnnouncementMutationInput = {
  name: string;
  bannerText: string;
  callToActionName?: string;
  callToActionUrl?: string;
  learnMoreName?: string;
  learnMoreContent?: string;
  scheduleStart: number | undefined;
  scheduleEnd: number | undefined;
};

function emptyFormState(): AnnouncementFormState {
  return {
    name: "",
    bannerText: "",
    callToActionName: "",
    callToActionUrl: "",
    learnMoreName: "",
    learnMoreContent: "",
    scheduleStart: undefined,
    scheduleEnd: undefined,
  };
}

const PAGE_SIZE = 50;

type AnnouncementSortField = "scheduleStart" | "scheduleEnd" | "status" | "name";
type AnnouncementSortState = { id: AnnouncementSortField; desc: boolean } | null;
type ScheduleStartIndicatorStatus = "neutral" | "active" | "cancelled" | "live";
type ScheduleEndIndicatorStatus = "neutral" | "active" | "cancelled";

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

function formatRelativeDuration(diffSeconds: number): string {
  if (diffSeconds < HOUR) {
    const minutes = Math.floor(diffSeconds / MINUTE);
    return `${Math.max(1, minutes)}m`;
  }

  if (diffSeconds < DAY) {
    const hours = Math.floor(diffSeconds / HOUR);
    const minutes = Math.floor((diffSeconds % HOUR) / MINUTE);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  if (diffSeconds < MONTH) {
    const days = Math.floor(diffSeconds / DAY);
    const hours = Math.floor((diffSeconds % DAY) / HOUR);
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }

  if (diffSeconds < YEAR) {
    const months = Math.floor(diffSeconds / MONTH);
    return `${months}mo`;
  }

  const years = Math.floor(diffSeconds / YEAR);
  const remainingMonths = Math.floor((diffSeconds % YEAR) / MONTH);
  return remainingMonths > 0 ? `${years}y ${remainingMonths}mo` : `${years}y`;
}

function getScheduleBoundaryTooltipLabel(
  value: number | undefined,
  boundary: "start" | "end",
  now: number
): string {
  if (value === undefined) {
    return boundary === "start"
      ? "No scheduled start time"
      : "No scheduled end time";
  }

  const diffSeconds = Math.floor((value - now) / 1000);
  const absDiff = Math.abs(diffSeconds);

  if (absDiff < MINUTE) {
    if (diffSeconds >= 0) {
      return boundary === "start"
        ? "Starts in less than a minute"
        : "Ends in less than a minute";
    }
    return boundary === "start"
      ? "Started less than a minute ago"
      : "Ended less than a minute ago";
  }

  const relative = formatRelativeDuration(absDiff);
  if (diffSeconds > 0) {
    return boundary === "start" ? `Starts in ${relative}` : `Ends in ${relative}`;
  }
  return boundary === "start"
    ? `Started ${relative} ago`
    : `Ended ${relative} ago`;
}

function toAnnouncementMutationErrorMessage(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : "";

  const errorMessages: Array<[string, string]> = [
    ["NAME_REQUIRED", "Name is required."],
    ["BANNER_TEXT_REQUIRED", "Banner text is required."],
    ["INVALID_SCHEDULE_WINDOW", "Schedule start must be before schedule end."],
    ["INVALID_SCHEDULESTART", "Schedule start must be a valid date/time."],
    ["INVALID_SCHEDULEEND", "Schedule end must be a valid date/time."],
    ["CTA_URL_REQUIRED", "CTA URL is required when CTA label is set."],
    ["CTA_URL_INVALID", "CTA URL must be a valid http/https URL."],
    ["CTA_NAME_REQUIRED", "CTA label is required when CTA URL is set."],
    [
      "LEARN_MORE_CONTENT_REQUIRED",
      "Learn More HTML is required when Learn More label is set.",
    ],
    ["ANNOUNCEMENT_NAME_TOO_LONG", "Name is too long."],
    ["BANNER_TEXT_TOO_LONG", "Banner text is too long."],
    ["CTA_NAME_TOO_LONG", "CTA label is too long."],
    ["CTA_URL_TOO_LONG", "CTA URL is too long."],
    ["LEARN_MORE_NAME_TOO_LONG", "Learn More label is too long."],
    ["LEARN_MORE_CONTENT_TOO_LONG", "Learn More HTML is too long."],
    ["PUBLISH_NOW_NOT_ALLOWED", "This announcement cannot be published right now."],
    ["ANNOUNCEMENT_ARCHIVED", "Archived announcements cannot be published."],
    ["ANNOUNCEMENT_NOT_LIVE", "This announcement is not currently live."],
    ["ANNOUNCEMENT_NOT_FOUND", "Announcement no longer exists."],
    ["NOT_AUTHENTICATED", "Your session has expired. Please sign in again."],
    ["NOT_ADMIN", "You do not have permission to perform this action."],
  ];

  for (const [code, message] of errorMessages) {
    if (raw.includes(code)) return message;
  }

  if (raw.includes("Server Error")) {
    return fallback;
  }

  return raw || fallback;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function validateAnnouncementMutationInput(
  input: AnnouncementMutationInput
): string | null {
  if (!input.name.trim()) return "Name is required.";
  if (!input.bannerText.trim()) return "Banner text is required.";

  if (
    input.scheduleStart !== undefined &&
    input.scheduleEnd !== undefined &&
    input.scheduleStart >= input.scheduleEnd
  ) {
    return "Schedule start must be before schedule end.";
  }

  if (input.callToActionName && !input.callToActionUrl) {
    return "CTA URL is required when CTA label is set.";
  }
  if (input.callToActionUrl && !isValidHttpUrl(input.callToActionUrl)) {
    return "CTA URL must be a valid http/https URL.";
  }
  if (input.callToActionUrl && !input.callToActionName) {
    return "CTA label is required when CTA URL is set.";
  }
  if (input.learnMoreName && !input.learnMoreContent) {
    return "Learn More HTML is required when Learn More label is set.";
  }

  return null;
}

export function AnnouncementsFeatureCard() {
  const previewCloseButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const [sorting, setSorting] = React.useState<AnnouncementSortState>(null);
  const [showArchived, setShowArchived] = React.useState(false);
  const listArgs = React.useMemo(() => {
    return {
      includeArchived: showArchived,
      ...(sorting
        ? {
            sortBy: sorting.id,
            sortDirection: sorting.desc ? "desc" : "asc",
          }
        : {}),
    };
  }, [showArchived, sorting]);

  const announcements = useQuery(api.announcements.list, listArgs);
  const createAnnouncement = useMutation(api.announcements.create);
  const updateAnnouncement = useMutation(api.announcements.update);
  const archiveAnnouncement = useMutation(api.announcements.archive);
  const publishNow = useMutation(api.announcements.publishNow);
  const unpublishNow = useMutation(api.announcements.unpublishNow);
  const removeAnnouncement = useMutation(api.announcements.remove);

  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editorMode, setEditorMode] = React.useState<"create" | "edit">("create");
  const [editingId, setEditingId] = React.useState<Id<"announcements"> | null>(
    null
  );
  const [form, setForm] = React.useState<AnnouncementFormState>(emptyFormState);
  const [submitting, setSubmitting] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<{
    id: Id<"announcements">;
    name: string;
  } | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);
  const [previewTarget, setPreviewTarget] = React.useState<{
    name: string;
    learnMoreName?: string;
    learnMoreContent?: string;
  } | null>(null);
  const [actionPendingId, setActionPendingId] = React.useState<Id<"announcements"> | null>(
    null
  );

  const localTimeZone = React.useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
    []
  );
  const [relativeNow, setRelativeNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const interval = window.setInterval(() => setRelativeNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const rows = React.useMemo(() => announcements ?? [], [announcements]);
  const loading = announcements === undefined;
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);
  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [showArchived, sorting]);

  const visibleRows = React.useMemo(
    () => rows.slice(0, visibleCount),
    [rows, visibleCount]
  );
  const hasMore = visibleRows.length < rows.length;

  const highlightedLiveId = React.useMemo(
    () => rows.find((row) => row.isLive)?._id ?? null,
    [rows]
  );

  const canPublishNow = React.useCallback(
    (row: (typeof rows)[number]): boolean => {
      if (row.isArchived === true) return false;
      if (typeof row.isPublishNowEligible === "boolean") {
        return row.isPublishNowEligible;
      }
      const now = Date.now();
      const startEligible = row.scheduleStart === undefined || row.scheduleStart <= now;
      const endEligible = row.scheduleEnd === undefined || row.scheduleEnd > now;
      return startEligible && endEligible;
    },
    []
  );

  const handleSort = React.useCallback((field: AnnouncementSortField) => {
    setSorting((current) => {
      if (current?.id === field) {
        return { id: field, desc: !current.desc };
      }
      return { id: field, desc: false };
    });
  }, []);

  const renderSortIcon = React.useCallback(
    (field: AnnouncementSortField) => {
      if (sorting?.id !== field) {
        return <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />;
      }
      return sorting.desc ? (
        <ArrowDown className="ml-2 h-4 w-4" />
      ) : (
        <ArrowUp className="ml-2 h-4 w-4" />
      );
    },
    [sorting]
  );

  const openCreate = () => {
    setEditorMode("create");
    setEditingId(null);
    setForm(emptyFormState());
    setEditorOpen(true);
  };

  const openEdit = (row: (typeof rows)[number]) => {
    setEditorMode("edit");
    setEditingId(row._id);
    setForm({
      name: row.name,
      bannerText: row.bannerText,
      callToActionName: row.callToActionName ?? "",
      callToActionUrl: row.callToActionUrl ?? "",
      learnMoreName: row.learnMoreName ?? "",
      learnMoreContent: row.learnMoreContent ?? "",
      scheduleStart: row.scheduleStart,
      scheduleEnd: row.scheduleEnd,
    });
    setEditorOpen(true);
  };

  const mutationInput = React.useMemo<AnnouncementMutationInput>(
    () => ({
      name: form.name,
      bannerText: form.bannerText,
      callToActionName: form.callToActionName || undefined,
      callToActionUrl: form.callToActionUrl || undefined,
      learnMoreName: form.learnMoreName || undefined,
      learnMoreContent: form.learnMoreContent || undefined,
      scheduleStart: form.scheduleStart,
      scheduleEnd: form.scheduleEnd,
    }),
    [form]
  );

  const submitForm = React.useCallback(async () => {
    const validationError = validateAnnouncementMutationInput(mutationInput);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSubmitting(true);
    try {
      if (editorMode === "create") {
        await createAnnouncement(mutationInput);
        toast.success("Announcement created");
      } else {
        if (!editingId) return;
        const updatePatch = {
          ...mutationInput,
          scheduleStart: mutationInput.scheduleStart ?? null,
          scheduleEnd: mutationInput.scheduleEnd ?? null,
        };
        await updateAnnouncement({
          announcementId: editingId,
          patch: updatePatch,
        } as Parameters<typeof updateAnnouncement>[0]);
        toast.success("Announcement updated");
      }
      setEditorOpen(false);
    } catch (err) {
      toast.error(toAnnouncementMutationErrorMessage(err, "Failed to save"));
    } finally {
      setSubmitting(false);
    }
  }, [createAnnouncement, editorMode, editingId, mutationInput, updateAnnouncement]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeletePending(true);
    try {
      await removeAnnouncement({ announcementId: deleteTarget.id });
      toast.success("Announcement deleted");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(toAnnouncementMutationErrorMessage(err, "Failed to delete"));
    } finally {
      setDeletePending(false);
    }
  };

  const handlePublishNow = async (announcementId: Id<"announcements">) => {
    setActionPendingId(announcementId);
    try {
      await publishNow({ announcementId });
      toast.success("Announcement published");
    } catch (err) {
      toast.error(toAnnouncementMutationErrorMessage(err, "Failed to publish"));
    } finally {
      setActionPendingId(null);
    }
  };

  const handleUnpublishNow = async (announcementId: Id<"announcements">) => {
    setActionPendingId(announcementId);
    try {
      await unpublishNow({ announcementId });
      toast.success("Announcement unpublished");
    } catch (err) {
      toast.error(toAnnouncementMutationErrorMessage(err, "Failed to unpublish"));
    } finally {
      setActionPendingId(null);
    }
  };

  const handleArchive = async (announcementId: Id<"announcements">) => {
    setActionPendingId(announcementId);
    try {
      await archiveAnnouncement({ announcementId });
      toast.success("Announcement archived");
    } catch (err) {
      toast.error(toAnnouncementMutationErrorMessage(err, "Failed to archive"));
    } finally {
      setActionPendingId(null);
    }
  };

  const statusBadge = (row: (typeof rows)[number]) => {
    if (row.isArchived === true || row.status === "archived") {
      return (
        <Badge variant="outline" className="whitespace-nowrap">
          Archived
        </Badge>
      );
    }

    switch (row.status) {
      case "live_now":
        return <Badge className="whitespace-nowrap">Live Now</Badge>;
      case "scheduled":
        return (
          <Badge variant="secondary" className="whitespace-nowrap">
            Scheduled
          </Badge>
        );
      case "scheduled_cancelled":
        return (
          <Badge variant="outline" className="whitespace-nowrap">
            Scheduled (Cancelled)
          </Badge>
        );
      case "ready":
        return (
          <Badge variant="secondary" className="whitespace-nowrap">
            Ready
          </Badge>
        );
      case "ended":
        return (
          <Badge variant="outline" className="whitespace-nowrap">
            Ended
          </Badge>
        );
      case "draft":
      default:
        return (
          <Badge variant="outline" className="whitespace-nowrap">
            Draft
          </Badge>
        );
    }
  };

  const getScheduleStartSchedulerStatus = (
    row: (typeof rows)[number]
  ): ScheduleStartIndicatorStatus => {
    if (row.isLive) {
      return "live";
    }
    const now = Date.now();
    if (row.scheduleStart === undefined || row.scheduleStart <= now) {
      return "neutral";
    }
    return row.publishJobId ? "active" : "cancelled";
  };

  const getScheduleEndSchedulerStatus = (
    row: (typeof rows)[number]
  ): ScheduleEndIndicatorStatus => {
    const now = Date.now();
    if (row.scheduleEnd === undefined || row.scheduleEnd <= now) {
      return "neutral";
    }
    return row.unpublishJobId ? "active" : "cancelled";
  };

  const renderScheduleStatusIndicator = (
    status: ScheduleStartIndicatorStatus | ScheduleEndIndicatorStatus,
    boundary: "start" | "end"
  ) => {
    const slotClassName =
      "inline-flex h-5 w-2 shrink-0 items-center justify-center";

    if (status === "neutral") {
      return (
        <span aria-hidden className={slotClassName}>
          <span className="h-2 w-2" />
        </span>
      );
    }

    const label =
      boundary === "start"
        ? status === "live"
          ? "Announcement is live"
          : status === "active"
          ? "Start scheduler is active"
          : "Start scheduler is cancelled by other announcement"
        : status === "active"
          ? "End scheduler is active"
          : "End scheduler is cancelled";

    return (
      <span className={slotClassName}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              aria-label={label}
              className={cn(
                "inline-flex h-2 w-2 shrink-0 rounded-full ring-1 ring-border",
                status === "active" && "bg-emerald-500",
                status === "cancelled" && "bg-red-500",
                status === "live" && "bg-emerald-500 animate-pulse"
              )}
            />
          </TooltipTrigger>
          <TooltipContent>
            <p>{label}</p>
          </TooltipContent>
        </Tooltip>
      </span>
    );
  };

  const renderScheduleCell = (
    value: number | undefined,
    status: ScheduleStartIndicatorStatus | ScheduleEndIndicatorStatus,
    boundary: "start" | "end"
  ) => {
    const indicator = renderScheduleStatusIndicator(status, boundary);
    const scheduleTooltip = getScheduleBoundaryTooltipLabel(
      value,
      boundary,
      relativeNow
    );
    const isPastDateTime = value !== undefined && value <= relativeNow;

    return (
      <div className="flex items-start gap-2">
        {indicator}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="min-w-0 cursor-default">
              <DateTimeWithTimezone
                value={value}
                locale="en-US"
                timeZone={localTimeZone}
                mode="datetime"
                timezoneLineMode="one-line"
                timezonePlacement="below"
                placeholder="Never"
                className={cn(
                  "min-w-0",
                  isPastDateTime && "[&>span:first-child]:text-muted-foreground"
                )}
              />
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{scheduleTooltip}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    );
  };

  const renderScheduleStartCell = (row: (typeof rows)[number]) =>
    renderScheduleCell(
      row.scheduleStart,
      getScheduleStartSchedulerStatus(row),
      "start"
    );

  const renderScheduleEndCell = (row: (typeof rows)[number]) =>
    renderScheduleCell(row.scheduleEnd, getScheduleEndSchedulerStatus(row), "end");

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="show-archived"
              checked={showArchived}
              onCheckedChange={(checked) => setShowArchived(checked === true)}
              aria-label="Show Archived"
            />
            <Label
              htmlFor="show-archived"
              className="cursor-pointer text-sm font-normal text-muted-foreground"
            >
              Show Archived
            </Label>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New announcement
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button
                    variant="ghost"
                    className={cn("-ml-3", sorting?.id === "scheduleStart" && "text-foreground")}
                    onClick={() => handleSort("scheduleStart")}
                  >
                    Start
                    {renderSortIcon("scheduleStart")}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    className={cn("-ml-3", sorting?.id === "scheduleEnd" && "text-foreground")}
                    onClick={() => handleSort("scheduleEnd")}
                  >
                    End
                    {renderSortIcon("scheduleEnd")}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    className={cn("-ml-3", sorting?.id === "status" && "text-foreground")}
                    onClick={() => handleSort("status")}
                  >
                    Status
                    {renderSortIcon("status")}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    className={cn("-ml-3", sorting?.id === "name" && "text-foreground")}
                    onClick={() => handleSort("name")}
                  >
                    Name
                    {renderSortIcon("name")}
                  </Button>
                </TableHead>
                <TableHead>Banner Text</TableHead>
                <TableHead className="w-[56px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <TableRow key={`announcement-skeleton-${idx}`}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No announcements yet.
                  </TableCell>
                </TableRow>
              ) : (
                visibleRows.map((row) => (
                  <TableRow
                    key={row._id}
                    className={cn(
                      highlightedLiveId === row._id &&
                        "bg-emerald-50/70 hover:bg-emerald-50 dark:bg-emerald-950/25 dark:hover:bg-emerald-950/35"
                    )}
                  >
                    <TableCell>{renderScheduleStartCell(row)}</TableCell>
                    <TableCell>{renderScheduleEndCell(row)}</TableCell>
                    <TableCell>{statusBadge(row)}</TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="max-w-[340px] truncate">
                      {row.bannerText}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => openEdit(row)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!row.learnMoreContent}
                            onSelect={() =>
                              setPreviewTarget({
                                name: row.name,
                                learnMoreName: row.learnMoreName,
                                learnMoreContent: row.learnMoreContent,
                              })
                            }
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Preview HTML
                          </DropdownMenuItem>
                          {row.isLive ? (
                            <DropdownMenuItem
                              disabled={actionPendingId === row._id}
                              onSelect={() => void handleUnpublishNow(row._id)}
                            >
                              <Radio className="mr-2 h-4 w-4" />
                              Unpublish now
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              disabled={actionPendingId === row._id || !canPublishNow(row)}
                              onSelect={() => void handlePublishNow(row._id)}
                            >
                              <Radio className="mr-2 h-4 w-4" />
                              Publish Now
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={actionPendingId === row._id || row.isArchived === true}
                            onSelect={() => void handleArchive(row._id)}
                          >
                            <Archive className="mr-2 h-4 w-4" />
                            {row.isArchived === true ? "Archived" : "Archive"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() =>
                              setDeleteTarget({ id: row._id, name: row.name })
                            }
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
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
              onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
            >
              Load more
            </Button>
          </div>
        )}
      </div>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editorMode === "create" ? "New Announcement" : "Edit Announcement"}
            </DialogTitle>
            <DialogDescription>
              Configure text and scheduling.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="announcement-name">Name</Label>
              <Input
                id="announcement-name"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="announcement-banner-text">Banner Text</Label>
            <Textarea
              id="announcement-banner-text"
              rows={3}
              value={form.bannerText}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, bannerText: e.target.value }))
              }
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="announcement-cta-name">CTA Button Label (optional)</Label>
              <Input
                id="announcement-cta-name"
                value={form.callToActionName}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    callToActionName: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="announcement-cta-url">CTA URL (optional)</Label>
              <Input
                id="announcement-cta-url"
                value={form.callToActionUrl}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    callToActionUrl: e.target.value,
                  }))
                }
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="announcement-learn-more-name">
                Learn More Label (optional)
              </Label>
              <Input
                id="announcement-learn-more-name"
                value={form.learnMoreName}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    learnMoreName: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="announcement-learn-more-content">
              Learn More HTML (optional)
            </Label>
            <p className="text-xs text-muted-foreground">
              Available Learn More variables:{" "}
              <code className="rounded bg-muted px-1 py-0.5">{`{{landingPageUrl}}`}</code>{" "}
              and{" "}
              <code className="rounded bg-muted px-1 py-0.5">{`{{webAppUrl}}`}</code>
            </p>
            <Textarea
              id="announcement-learn-more-content"
              rows={8}
              value={form.learnMoreContent}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  learnMoreContent: e.target.value,
                }))
              }
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Schedule Start (optional)</Label>
              <DateTimePicker
                value={form.scheduleStart}
                timeZone={localTimeZone}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, scheduleStart: value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Schedule End (optional)</Label>
              <DateTimePicker
                value={form.scheduleEnd}
                timeZone={localTimeZone}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, scheduleEnd: value }))
                }
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button disabled={submitting} onClick={() => void submitForm()}>
              {editorMode === "create" ? "Create" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={previewTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewTarget(null);
        }}
      >
        <DialogContent
          className="max-w-3xl"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            previewCloseButtonRef.current?.focus();
          }}
        >
          <DialogTitle className="flex items-center text-foreground">
            <Info className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">Announcement details</span>
          </DialogTitle>
          <iframe
            title={previewTarget?.learnMoreName ?? "Announcement details"}
            srcDoc={previewTarget?.learnMoreContent ?? ""}
            sandbox=""
            className="h-[420px] w-full rounded-md border bg-white"
          />
          <div className="mt-1 flex justify-end">
            <Button
              ref={previewCloseButtonRef}
              type="button"
              onClick={() => setPreviewTarget(null)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete announcement?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `This will permanently delete "${deleteTarget.name}".`
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={deletePending} onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
