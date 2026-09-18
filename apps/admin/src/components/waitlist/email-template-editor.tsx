"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import {
  Check,
  ChevronRight,
  ClipboardCopy,
  Code2,
  Eye,
  FileText,
  Pencil,
  RotateCcw,
  Save,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@repo/backend";
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
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  cn,
  Input,
  Label,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/design-system";

import { EmailHtmlPreview } from "./email-html-preview";
import {
  TEMPLATE_VARIABLES,
  renderPreview,
} from "@/lib/email-template-constants";

function VariableBadge({ name, description }: { name: string; description: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    void window.navigator.clipboard.writeText(`{{${name}}}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="h-auto gap-1.5 border-dashed px-2.5 py-1 font-mono text-xs"
          >
            {copied ? (
              <Check className="h-3 w-3 text-emerald-500" />
            ) : (
              <ClipboardCopy className="h-3 w-3 text-muted-foreground" />
            )}
            {`{{${name}}}`}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-56">
          <p className="text-xs">{description}</p>
          <p className="mt-0.5 text-xs">Click to copy</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

type EmailTemplateEditorProps = {
  onDirtyChange?: (dirty: boolean) => void;
  disabled?: boolean;
  embedded?: boolean;
};

export function EmailTemplateEditor({
  onDirtyChange,
  disabled = false,
  embedded = false,
}: EmailTemplateEditorProps) {
  const router = useRouter();
  const templateData = useQuery(api.appSettings.getEmailTemplate);
  const setSetting = useMutation(api.appSettings.set);
  const removeSetting = useMutation(api.appSettings.remove);

  const [mode, setMode] = React.useState<"view" | "edit">("view");
  const [draftSubject, setDraftSubject] = React.useState("");
  const [draftHtml, setDraftHtml] = React.useState("");
  const [draftText, setDraftText] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [confirmReset, setConfirmReset] = React.useState(false);
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const [pendingNavigation, setPendingNavigation] = React.useState<string | null>(null);
  const [viewPreviewTab, setViewPreviewTab] = React.useState<"html" | "text">("html");
  const [activeBodyTab, setActiveBodyTab] = React.useState<"html" | "text">("html");
  const [htmlMode, setHtmlMode] = React.useState<"edit" | "preview">("edit");
  const [isExpanded, setIsExpanded] = React.useState(!embedded);
  const previousDisabledRef = React.useRef(disabled);
  const cardClassName = embedded ? "mt-4 border-dashed bg-muted/20" : "mt-4";

  // Track whether the draft has diverged from the saved template
  const isDirty =
    mode === "edit" &&
    templateData != null &&
    (draftSubject !== templateData.subject ||
      draftHtml !== templateData.html ||
      draftText !== templateData.text);

  // Notify parent of dirty state changes
  React.useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  React.useEffect(() => {
    const becameDisabled = disabled && !previousDisabledRef.current;
    previousDisabledRef.current = disabled;
    if (!becameDisabled || mode !== "edit") return;
    if (isDirty) {
      setConfirmCancel(true);
      return;
    }
    setMode("view");
  }, [disabled, isDirty, mode]);

  // Warn on browser navigation (refresh, close tab, external URL)
  React.useEffect(() => {
    if (!isDirty) return;
    const handler = (e: Event) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Intercept client-side link clicks (sidebar, etc.) when dirty
  React.useEffect(() => {
    if (!isDirty) return;

    const handler = (e: globalThis.MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a[href]");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      // Only intercept same-origin navigation away from this page
      try {
        const url = new URL(href, window.location.origin);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname) return;
      } catch {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      setPendingNavigation(href);
    };

    // Capture phase so we intercept before Next.js handles the click
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [isDirty]);

  // Loading state
  if (templateData === undefined) {
    return (
      <Card className={cardClassName}>
        <CardHeader className="pb-4">
          <Skeleton className="h-5 w-52" />
          <Skeleton className="mt-2 h-4 w-80" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-[400px] w-full rounded-md" />
        </CardContent>
      </Card>
    );
  }

  if (templateData === null) return null;

  const enterEdit = () => {
    if (disabled) return;
    setDraftSubject(templateData.subject);
    setDraftHtml(templateData.html);
    setDraftText(templateData.text);
    setMode("edit");
  };

  const cancelEdit = () => {
    if (isDirty) {
      setConfirmCancel(true);
      return;
    }
    setMode("view");
  };

  const confirmCancelEdit = () => {
    setConfirmCancel(false);
    setMode("view");
  };

  const confirmNavigateAway = () => {
    if (pendingNavigation) {
      const href = pendingNavigation;
      setPendingNavigation(null);
      router.push(href);
    }
  };

  const handleSave = async () => {
    if (disabled) return;
    if (!draftSubject.trim()) {
      toast.error("Subject line cannot be empty");
      return;
    }
    if (!draftHtml.includes("{{invitation_link}}")) {
      toast.error("HTML template must include {{invitation_link}}");
      return;
    }
    if (!draftText.includes("{{invitation_link}}")) {
      toast.error("Plain text template must include {{invitation_link}}");
      return;
    }

    setSaving(true);
    try {
      await setSetting({
        key: "invitationEmailTemplate",
        value: JSON.stringify({
          subject: draftSubject.trim(),
          html: draftHtml,
          text: draftText,
        }),
      });
      toast.success("Email template saved");
      setMode("view");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save template"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (disabled) return;
    setConfirmReset(false);
    setSaving(true);
    try {
      await removeSetting({ key: "invitationEmailTemplate" });
      toast.success("Email template reset to default");
      setMode("view");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to reset template"
      );
    } finally {
      setSaving(false);
    }
  };

  // ── VIEW MODE ──────────────────────────────────────────────────────────

  if (mode === "view") {
    return (
      <Card className={cardClassName}>
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-semibold leading-none tracking-tight">
                  Invitation Email
                </h3>
                <Badge
                  variant={templateData.isCustom ? "default" : "secondary"}
                  className="text-[11px]"
                >
                  {templateData.isCustom ? "Custom" : "Default"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                This email is sent when you invite someone from the waitlist.
              </p>
              {disabled && (
                <p className="text-xs text-muted-foreground">
                  Enable Waitlist to edit this template.
                </p>
              )}
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 -ml-2 w-fit px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ChevronRight
                    className={cn(
                      "mr-1 h-3.5 w-3.5 transition-transform",
                      isExpanded && "rotate-90"
                    )}
                  />
                  {isExpanded ? "Hide template" : "Show template"}
                </Button>
              </CollapsibleTrigger>
            </div>
            <div className="flex shrink-0 gap-2">
              {templateData.isCustom && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmReset(true)}
                  disabled={saving || disabled}
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Reset
                </Button>
              )}
              <Button size="sm" onClick={enterEdit} disabled={disabled}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Edit
              </Button>
            </div>
          </CardHeader>

          <CollapsibleContent>
            <CardContent className="space-y-5">
              {/* Subject */}
              <div className="space-y-1">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Subject
                </Label>
                <p className="text-sm font-medium">
                  {renderPreview(templateData.subject)}
                </p>
              </div>

              {/* Email Body — HTML / Plain Text tabs */}
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Email Body
                </Label>
                <Tabs
                  value={viewPreviewTab}
                  onValueChange={(value) =>
                    setViewPreviewTab(value as "html" | "text")
                  }
                >
                  <TabsList>
                    <TabsTrigger value="html" className="gap-1.5">
                      <Code2 className="h-3.5 w-3.5" />
                      HTML
                    </TabsTrigger>
                    <TabsTrigger value="text" className="gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      Plain Text
                    </TabsTrigger>
                  </TabsList>

                  <div className="relative mt-2 h-[500px] overflow-hidden rounded-md">
                    <div
                      className={cn(
                        "absolute inset-0 transition-opacity duration-200",
                        viewPreviewTab === "html"
                          ? "opacity-100"
                          : "pointer-events-none opacity-0"
                      )}
                    >
                      <EmailHtmlPreview html={templateData.html} className="h-full" />
                    </div>
                    <div
                      className={cn(
                        "absolute inset-0 transition-opacity duration-200",
                        viewPreviewTab === "text"
                          ? "opacity-100"
                          : "pointer-events-none opacity-0"
                      )}
                    >
                      <div className="h-full overflow-y-auto rounded-md border bg-muted/30 p-4">
                        <pre className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/80">
                          {renderPreview(templateData.text)}
                        </pre>
                      </div>
                    </div>
                  </div>
                </Tabs>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>

        {/* Reset confirmation */}
        <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset to default template?</AlertDialogTitle>
              <AlertDialogDescription>
                This will discard your custom email template and restore the
                built-in default. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleReset}>
                Reset to Default
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
    );
  }

  // ── EDIT MODE ──────────────────────────────────────────────────────────

  return (
    <Card className={cardClassName}>
      <CardHeader className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-semibold leading-none tracking-tight">
              Edit Email Template
            </h3>
            <p className="text-sm text-muted-foreground">
              Customize the invitation email. Use variables to insert dynamic
              content.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={cancelEdit}
            disabled={saving}
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Variable reference */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Available variables
          </p>
          <div className="flex flex-wrap gap-2">
            {TEMPLATE_VARIABLES.map((v) => (
              <VariableBadge
                key={v.name}
                name={v.name}
                description={v.description}
              />
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Subject */}
        <div className="space-y-1.5">
          <Label htmlFor="tpl-subject" className="text-sm font-medium">
            Subject line
          </Label>
          <Input
            id="tpl-subject"
            value={draftSubject}
            onChange={(e) => setDraftSubject(e.target.value)}
            placeholder="Email subject..."
            maxLength={200}
          />
        </div>

        {/* Editor tabs */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Email Body</Label>
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
              <button
                type="button"
                onClick={() => setActiveBodyTab("html")}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  activeBodyTab === "html"
                    ? "bg-background text-foreground shadow"
                    : "hover:bg-background/50 hover:text-foreground"
                )}
              >
                <Code2 className="h-3.5 w-3.5" />
                HTML
              </button>
              <button
                type="button"
                onClick={() => setActiveBodyTab("text")}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  activeBodyTab === "text"
                    ? "bg-background text-foreground shadow"
                    : "hover:bg-background/50 hover:text-foreground"
                )}
              >
                <FileText className="h-3.5 w-3.5" />
                Plain Text
              </button>
            </div>
            {activeBodyTab === "html" && (
              <>
                <div className="h-4 w-px bg-border" aria-hidden="true" />
                <div className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => setHtmlMode("edit")}
                    className={cn(
                      "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      htmlMode === "edit"
                        ? "bg-background text-foreground shadow"
                        : "hover:bg-background/50 hover:text-foreground"
                    )}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setHtmlMode("preview")}
                    className={cn(
                      "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      htmlMode === "preview"
                        ? "bg-background text-foreground shadow"
                        : "hover:bg-background/50 hover:text-foreground"
                    )}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Preview
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="mt-2 h-[500px] overflow-hidden rounded-md">
            {activeBodyTab === "html" &&
              (htmlMode === "edit" ? (
                <Textarea
                  value={draftHtml}
                  onChange={(e) => setDraftHtml(e.target.value)}
                  className="h-full resize-none font-mono text-xs leading-relaxed"
                  placeholder="HTML email template..."
                  spellCheck={false}
                />
              ) : draftHtml ? (
                <EmailHtmlPreview html={draftHtml} className="h-full" />
              ) : (
                <div className="flex h-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                  No HTML content to preview
                </div>
              ))}
            {activeBodyTab === "text" && (
              <Textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                className="h-full resize-none font-mono text-xs leading-relaxed"
                placeholder="Plain text email template..."
                spellCheck={false}
              />
            )}
          </div>
          {activeBodyTab === "html" &&
            draftHtml &&
            !draftHtml.includes("{{invitation_link}}") && (
              <p className="text-xs text-destructive">
                Template must contain {"{{invitation_link}}"}
              </p>
          )}
          {activeBodyTab === "text" &&
            draftText &&
            !draftText.includes("{{invitation_link}}") && (
              <p className="text-xs text-destructive">
                Template must contain {"{{invitation_link}}"}
              </p>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex flex-wrap justify-between gap-3 pt-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirmReset(true)}
          disabled={saving}
          className="text-muted-foreground"
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Reset to Default
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={cancelEdit}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {saving ? "Saving..." : "Save Template"}
          </Button>
        </div>
      </CardFooter>

      {/* Reset confirmation */}
      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset to default template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will discard your changes and restore the built-in default
              template. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset}>
              Reset to Default
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel editing confirmation */}
      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to the email template. Are you sure you
              want to discard them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancelEdit}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Navigate away confirmation */}
      <AlertDialog
        open={pendingNavigation !== null}
        onOpenChange={(open) => {
          if (!open) setPendingNavigation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to the email template. Leaving this page
              will discard them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction onClick={confirmNavigateAway}>
              Leave Page
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
