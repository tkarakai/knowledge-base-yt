"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, LogOut, Plus, UserCog } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";

import { ThemeToggle } from "@repo/design-patterns";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";

import { api } from "@repo/backend";
import { type Id } from "@repo/backend";
import { authClient } from "@repo/auth/client";
import {
  Avatar,
  AvatarFallback,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  Textarea,
  useSidebar,
} from "@repo/design-system";
import { normalizeText } from "@/lib/projects";
import { AppLogo } from "@/components/app-logo";

type Project = {
  _id: Id<"projects">;
  _creationTime: number;
  name: string;
  description: string;
  ownerId: string;
  createdAt: number;
};

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  displayName: string;
  displayEmail?: string;
  selectedProjectId: Id<"projects"> | null;
  onSelectProject: (id: Id<"projects"> | null) => void;
};

export function AppSidebar({
  displayName,
  displayEmail,
  selectedProjectId,
  onSelectProject,
  ...props
}: AppSidebarProps) {
  const router = useRouter();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const tc = useTranslations("common");
  const tp = useTranslations("projects");
  const td = useTranslations("dashboard");
  const tt = useTranslations("theme");

  const projects: Project[] = useQuery(api.projects.list) ?? [];
  const userProfile = useQuery(api.userProfiles.get) ?? null;
  const createProject = useMutation(api.projects.create);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [projectsOpen, setProjectsOpen] = React.useState(true);

  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const themeLabels = {
    light: tt("light"),
    system: tt("system"),
    dark: tt("dark"),
    aria: tt.raw("ariaLabel"),
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = normalizeText(name);
    if (!trimmedName) return;

    setSubmitting(true);
    try {
      const id = await createProject({
        name: trimmedName,
        description: normalizeText(description),
      });
      setName("");
      setDescription("");
      setDialogOpen(false);
      onSelectProject(id);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = () => {
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => router.push("/"),
      },
    });
  };

  return (
    <>
      <Sidebar collapsible="icon" {...props}>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip={tc("appName")} className="font-semibold">
                <AppLogo size={20} />
                <span>{tc("appName")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <Collapsible open={projectsOpen} onOpenChange={setProjectsOpen} className="group/projects">
              <div className="flex items-center">
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="mb-1 h-7 flex-1 cursor-pointer rounded-sm px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-sidebar-primary hover:text-sidebar-primary/80">
                    <ChevronRight className="me-1 h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]/projects:rotate-90 rtl:rotate-180 rtl:group-data-[state=open]/projects:rotate-90" />
                    {td("projects")}
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <SidebarGroupAction onClick={() => setDialogOpen(true)} title={tp("newProject")}>
                  <Plus className="h-4 w-4" />
                </SidebarGroupAction>
              </div>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {projects.length === 0 ? (
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          className="text-muted-foreground italic"
                          onClick={() => setDialogOpen(true)}
                          tooltip={tp("createFirst")}
                        >
                          <span>{tp("noProjects")}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ) : (
                      projects.map((project) => (
                        <SidebarMenuItem key={project._id}>
                          <SidebarMenuButton
                            isActive={project._id === selectedProjectId}
                            closeOnSelectMobile
                            onClick={() => onSelectProject(project._id)}
                            tooltip={project.name}
                          >
                            <span className="truncate">{project.name}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    tooltip={displayName}
                    className={
                      isCollapsed
                        ? "h-auto py-2 !size-8 !p-0 justify-center"
                        : "h-auto py-2"
                    }
                  >
                    <Avatar className="h-7 w-7 shrink-0 border border-border/60">
                      <AvatarFallback
                        className="text-xs"
                        style={userProfile?.avatarColor ? { backgroundColor: userProfile.avatarColor, color: "#fff" } : undefined}
                      >
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    {!isCollapsed && (
                      <div className="flex flex-col items-start overflow-hidden">
                        <span className="truncate text-sm font-medium">{displayName}</span>
                        {displayEmail && (
                          <span className="truncate text-xs text-muted-foreground">
                            {displayEmail}
                          </span>
                        )}
                      </div>
                    )}
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-56">
                  <ThemeToggle className="my-1 w-full" labels={themeLabels} />
                  <LocaleSwitcher variant="submenu" />
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => router.push("/dashboard/settings")}>
                    <UserCog className="me-2 h-4 w-4" />
                    {td("account")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleSignOut} className="text-destructive focus:text-destructive">
                    <LogOut className="me-2 h-4 w-4" />
                    {tc("signOut")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tp("newProject")}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCreate}>
            <div className="space-y-2">
              <Label htmlFor="new-project-name">{tp("fields.name")}</Label>
              <Input
                id="new-project-name"
                placeholder={tp("fields.namePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-project-description">{tp("fields.description")}</Label>
              <Textarea
                id="new-project-description"
                placeholder={tp("fields.descriptionPlaceholder")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? tc("creating") : tp("createProject")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
