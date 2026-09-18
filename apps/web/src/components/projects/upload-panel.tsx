"use client";

import * as React from "react";
import { ChevronRight, Trash2, UploadCloud } from "lucide-react";
import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";

import { api } from "@repo/backend";
import { type Id } from "@repo/backend";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/design-system";
import { useMutationWithToast } from "@/hooks/use-mutation-with-toast";
import { formatBytes } from "@/lib/format";

const MAX_FILE_SIZE = 1_048_576; // 1MB

type UploadPanelProps = {
  projectId: Id<"projects">;
  collapsible?: boolean;
};

export function UploadPanel({ projectId, collapsible = true }: UploadPanelProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(!collapsible);
  const t = useTranslations("uploads");

  const generateUploadUrl = useMutationWithToast(api.files.generateUploadUrl);
  const saveUpload = useMutationWithToast(api.files.saveUpload);
  const deleteUpload = useMutationWithToast(api.files.deleteUpload);
  const uploads = useQuery(api.files.listUploads, { projectId }) ?? [];

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setError(t("errors.tooLarge"));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!result.ok) {
        throw new Error(t("errors.uploadFailed"));
      }

      const { storageId } = await result.json();

      await saveUpload({
        storageId,
        name: file.name,
        projectId,
      });

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : t("errors.generic")
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: Id<"uploads">) => {
    await deleteUpload({ id });
  };

  const content = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleUpload}
      />
      {error && (
        <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm">
          {error}
        </div>
      )}
      {uploads.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/70 bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
          {t("emptyState")}
        </div>
      ) : (
        <div className="space-y-2">
          {uploads.map((upload) => (
            <div
              key={upload._id}
              className="group flex items-center justify-between rounded-md border border-border/70 bg-card px-3 py-2 text-sm"
            >
              <div>
                <div className="font-medium text-foreground">{upload.name}</div>
                <div className="text-xs text-muted-foreground">
                  {formatBytes(upload.size)} &middot; {upload.contentType}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {upload.url ? (
                  <a
                    href={upload.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-primary underline"
                  >
                    {t("view")}
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">{t("processing")}</span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  onClick={() => handleDelete(upload._id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="sr-only">{t("deleteFile")}</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  if (!collapsible) {
    return (
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between p-4">
          <CardTitle className="text-sm font-medium">
            {t("title")}{uploads.length > 0 && ` (${uploads.length})`}
          </CardTitle>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <UploadCloud className="h-4 w-4" />
            {uploading ? t("uploading") : t("addFile")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {content}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="flex flex-row items-center justify-between p-4">
          <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-80">
            <ChevronRight
              className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
            />
            <CardTitle className="text-sm font-medium">
              {t("title")}{uploads.length > 0 && ` (${uploads.length})`}
            </CardTitle>
          </CollapsibleTrigger>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <UploadCloud className="h-4 w-4" />
            {uploading ? t("uploading") : t("addFile")}
          </Button>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0">
            {content}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
