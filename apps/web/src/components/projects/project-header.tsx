"use client";

import * as React from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";

import { api } from "@repo/backend";
import { type Id } from "@repo/backend";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Textarea,
} from "@repo/design-system";
import { normalizeText } from "@/lib/projects";

type ProjectHeaderProps = {
  project: {
    _id: Id<"projects">;
    name: string;
    description: string;
  };
  onDeleted: () => void;
};

export function ProjectHeader({ project, onDeleted }: ProjectHeaderProps) {
  const updateProject = useMutation(api.projects.update);
  const removeProject = useMutation(api.projects.remove);
  const tp = useTranslations("projects");
  const tc = useTranslations("common");

  const [editOpen, setEditOpen] = React.useState(false);
  const [name, setName] = React.useState(project.name);
  const [description, setDescription] = React.useState(project.description);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    setName(project.name);
    setDescription(project.description);
  }, [project.name, project.description]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = normalizeText(name);
    if (!trimmedName) return;

    setSubmitting(true);
    try {
      await updateProject({
        id: project._id,
        name: trimmedName,
        description: normalizeText(description),
      });
      setEditOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    await removeProject({ id: project._id });
    onDeleted();
  };

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">{project.name}</h1>
        {project.description && (
          <p className="text-sm text-muted-foreground">{project.description}</p>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Pencil className="h-4 w-4" />
              <span className="sr-only">{tp("editProject")}</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{tp("editProject")}</DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={handleUpdate}>
              <div className="space-y-2">
                <Label htmlFor="edit-project-name">{tp("fields.name")}</Label>
                <Input
                  id="edit-project-name"
                  placeholder={tp("fields.namePlaceholder")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-project-description">{tp("fields.description")}</Label>
                <Textarea
                  id="edit-project-description"
                  placeholder={tp("fields.descriptionPlaceholder")}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? tc("saving") : tc("save")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">{tp("deleteProject")}</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{tp("deleteConfirmTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {tp("deleteConfirmDescription", { name: project.name })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {tc("delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
