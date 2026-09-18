"use client";

import * as React from "react";
import { Circle, CircleCheck, CircleDashed, Clock, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { api } from "@repo/backend";
import { type Id } from "@repo/backend";
import {
  Badge,
  Button,
  DateTimeWithTimezone,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@repo/design-system";
import { useMutationWithToast } from "@/hooks/use-mutation-with-toast";
import { getDeadlineUrgency, type DeadlineUrgency } from "@/lib/format";
import { normalizeText, type TaskStatus } from "@/lib/projects";
import { DeadlineInput } from "./deadline-input";

type Task = {
  _id: Id<"tasks">;
  title: string;
  description: string;
  status: TaskStatus;
  deadline?: number;
  projectId: Id<"projects">;
  createdAt: number;
};

const statusVariant: Record<TaskStatus, "secondary" | "default" | "outline"> = {
  todo: "outline",
  in_progress: "secondary",
  done: "default",
};

const statusCycle: Record<TaskStatus, TaskStatus> = {
  todo: "in_progress",
  in_progress: "done",
  done: "todo",
};

const statusTranslationKey: Record<TaskStatus, string> = {
  todo: "status.todo",
  in_progress: "status.inProgress",
  done: "status.done",
};

const urgencyStyles: Record<DeadlineUrgency, string> = {
  overdue: "text-destructive",
  urgent: "text-amber-600 dark:text-amber-500",
  normal: "text-muted-foreground",
  done: "text-muted-foreground line-through",
};

function StatusIcon({ status, className }: { status: TaskStatus; className?: string }) {
  switch (status) {
    case "todo":
      return <Circle className={className} />;
    case "in_progress":
      return <CircleDashed className={`${className} text-primary`} />;
    case "done":
      return <CircleCheck className={`${className} text-primary`} />;
  }
}

type TaskRowProps = {
  task: Task;
  locale?: string;
  timeZone?: string;
};

export function TaskRow({ task, locale, timeZone }: TaskRowProps) {
  const updateTask = useMutationWithToast(api.tasks.update);
  const removeTask = useMutationWithToast(api.tasks.remove);
  const t = useTranslations("tasks");
  const tc = useTranslations("common");

  const [editOpen, setEditOpen] = React.useState(false);
  const [title, setTitle] = React.useState(task.title);
  const [description, setDescription] = React.useState(task.description);
  const [status, setStatus] = React.useState<TaskStatus>(task.status);
  const [deadline, setDeadline] = React.useState<number | undefined>(task.deadline);
  const [submitting, setSubmitting] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  React.useEffect(() => {
    setTitle(task.title);
    setDescription(task.description);
    setStatus(task.status);
    setDeadline(task.deadline);
  }, [task.title, task.description, task.status, task.deadline]);

  // Auto-revert the confirm state after 2 seconds
  React.useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 2000);
    return () => clearTimeout(timer);
  }, [confirming]);

  const handleToggleStatus = async () => {
    await updateTask({ id: task._id, status: statusCycle[task.status] });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = normalizeText(title);
    if (!trimmedTitle) return;

    setSubmitting(true);
    try {
      await updateTask({
        id: task._id,
        title: trimmedTitle,
        description: normalizeText(description),
        status,
        deadline: deadline === task.deadline ? undefined : (deadline ?? null),
      });
      setEditOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    await removeTask({ id: task._id });
  };

  const isDone = task.status === "done";
  const statusLabel = t(statusTranslationKey[task.status]);

  const deadlineUrgency = task.deadline
    ? getDeadlineUrgency(task.deadline, task.status)
    : null;

  return (
    <>
      <div className="group flex items-start gap-3 rounded-lg border border-border/60 bg-card/50 px-4 py-3 transition-colors hover:bg-card/80">
        <button
          type="button"
          onClick={handleToggleStatus}
          className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={t("aria.changeStatus", { status: statusLabel })}
        >
          <StatusIcon status={task.status} className="h-5 w-5" />
        </button>

        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
            {task.title}
          </div>
          {task.description && (
            <div className="mt-0.5 text-xs text-muted-foreground truncate">
              {task.description}
            </div>
          )}
          {task.deadline && deadlineUrgency && (
            <div className={`mt-1 flex items-start gap-1 ${urgencyStyles[deadlineUrgency]}`}>
              <Clock className="mt-0.5 h-3 w-3 shrink-0" />
              <div className="min-w-0 space-y-0.5 text-xs">
                {deadlineUrgency === "overdue" && (
                  <div>{t("deadline.overdue")}</div>
                )}
                {deadlineUrgency === "urgent" && (
                  <div>{t("deadline.dueToday")}</div>
                )}
                <DateTimeWithTimezone
                  value={task.deadline}
                  locale={locale}
                  timeZone={timeZone}
                  mode="datetime"
                  timezoneLineMode="one-line"
                  className="min-w-0"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={statusVariant[task.status]} className="text-xs">
            {statusLabel}
          </Badge>
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
              <span className="sr-only">{t("editTask")}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 w-7 p-0 ${confirming ? "text-destructive opacity-100" : "text-muted-foreground hover:text-destructive"}`}
              onClick={handleDeleteClick}
            >
              {confirming ? (
                <CircleCheck className="h-4.5 w-4.5 fill-destructive text-destructive-foreground" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              <span className="sr-only">{confirming ? t("confirmDelete") : t("deleteTask")}</span>
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editTask")}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleUpdate}>
            <div className="space-y-2">
              <Label htmlFor="edit-task-title">{t("fields.title")}</Label>
              <Input
                id="edit-task-title"
                placeholder={t("fields.titlePlaceholder")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-task-description">{t("fields.description")}</Label>
              <Textarea
                id="edit-task-description"
                placeholder={t("fields.descriptionPlaceholder")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-task-status">{t("status.label")}</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger id="edit-task-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">{t("status.todo")}</SelectItem>
                  <SelectItem value="in_progress">{t("status.inProgress")}</SelectItem>
                  <SelectItem value="done">{t("status.done")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DeadlineInput value={deadline} onChange={setDeadline} timeZone={timeZone} />
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? tc("saving") : tc("save")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
