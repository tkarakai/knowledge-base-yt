"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";

import { api } from "@repo/backend";
import { type Id } from "@repo/backend";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@repo/design-system";
import { useMutationWithToast } from "@/hooks/use-mutation-with-toast";
import { normalizeText, type TaskStatus } from "@/lib/projects";
import { DeadlineInput } from "./deadline-input";
import { TaskRow } from "./task-row";

type Task = {
  _id: Id<"tasks">;
  _creationTime: number;
  title: string;
  description: string;
  status: TaskStatus;
  deadline?: number;
  projectId: Id<"projects">;
  ownerId: string;
  createdAt: number;
};

type TaskListProps = {
  projectId: Id<"projects">;
};

export function TaskList({ projectId }: TaskListProps) {
  const tasks: Task[] = useQuery(api.tasks.listByProject, { projectId }) ?? [];
  const profile = useQuery(api.userProfiles.get);
  const createTask = useMutationWithToast(api.tasks.create);
  const t = useTranslations("tasks");
  const tc = useTranslations("common");
  const locale = useLocale();

  const timeZone = profile?.timezone ?? undefined;

  const [tab, setTab] = React.useState<"all" | TaskStatus>("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [status, setStatus] = React.useState<TaskStatus>("todo");
  const [deadline, setDeadline] = React.useState<number | undefined>(undefined);
  const [submitting, setSubmitting] = React.useState(false);

  const filteredTasks = tasks.filter((task) => tab === "all" || task.status === tab);
  const doneCount = tasks.filter((task) => task.status === "done").length;
  const progress = tasks.length === 0 ? 0 : Math.round((doneCount / tasks.length) * 100);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = normalizeText(title);
    if (!trimmedTitle) return;

    setSubmitting(true);
    try {
      await createTask({
        title: trimmedTitle,
        description: normalizeText(description),
        status,
        projectId,
        deadline,
      });
      setTitle("");
      setDescription("");
      setStatus("todo");
      setDeadline(undefined);
      setDialogOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {t("title")}{tasks.length > 0 && ` (${tasks.length})`}
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4" />
                {t("addTask")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("newTask")}</DialogTitle>
              </DialogHeader>
              <form className="space-y-4" onSubmit={handleCreate}>
                <div className="space-y-2">
                  <Label htmlFor="new-task-title">{t("fields.title")}</Label>
                  <Input
                    id="new-task-title"
                    placeholder={t("fields.titlePlaceholder")}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-task-description">{t("fields.description")}</Label>
                  <Textarea
                    id="new-task-description"
                    placeholder={t("fields.descriptionPlaceholder")}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-task-status">{t("status.label")}</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                    <SelectTrigger id="new-task-status">
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
                  {submitting ? tc("creating") : t("createTask")}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="all">{t("status.all")}</TabsTrigger>
            <TabsTrigger value="todo">{t("status.todo")}</TabsTrigger>
            <TabsTrigger value="in_progress">{t("status.inProgress")}</TabsTrigger>
            <TabsTrigger value="done">{t("status.done")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent className="space-y-4">
        {tasks.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {t("progress", { doneCount, totalCount: tasks.length })}
              </span>
              <span>{t("progressPercent", { percent: progress })}</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {filteredTasks.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/70 bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
            {t("noTasks")}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTasks.map((task) => (
              <TaskRow key={task._id} task={task} locale={locale} timeZone={timeZone} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
