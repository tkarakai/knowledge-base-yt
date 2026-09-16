"use client";

import * as React from "react";
import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";

import { api } from "@repo/backend";
import { type Id } from "@repo/backend";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Separator,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/design-system";
import { useAuthUser } from "@/components/auth/auth-guard";
import { useProfileSync } from "@/hooks/useProfileSync";
import { AppSidebar } from "@/components/projects/app-sidebar";
import { AnnouncementBannerHost } from "@/components/announcement-banner-host";
import { EmptyState } from "@/components/projects/empty-state";
import { ProjectHeader } from "@/components/projects/project-header";
import { ProjectSummary } from "@/components/projects/project-summary";
import { TaskList } from "@/components/projects/task-list";
import { UploadPanel } from "@/components/projects/upload-panel";

export function DashboardClient() {
  // Sync user profile (locale) between Convex and localStorage
  // This is safe here because we're in the authenticated dashboard area with proper context
  useProfileSync();

  const authUser = useAuthUser();

  const [selectedProjectId, setSelectedProjectId] = React.useState<Id<"projects"> | null>(null);

  const displayName = authUser?.name ?? "Anonymous";
  const displayEmail = authUser?.email;

  return (
    <SidebarProvider>
      <AppSidebar
        displayName={displayName}
        displayEmail={displayEmail ?? undefined}
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProjectId}
      />
      <SidebarInset className="flex flex-col h-dvh">
        <AnnouncementBannerHost className="shrink-0" />
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border/40 bg-background px-4">
          <SidebarTrigger className="-ms-1" />
          <Separator
            orientation="vertical"
            className="me-2 data-[orientation=vertical]:h-4"
          />
          <DashboardBreadcrumbs
            selectedProjectId={selectedProjectId}
            onNavigateToProjects={() => setSelectedProjectId(null)}
          />
        </header>

        <div className="flex flex-1 flex-col overflow-y-auto">
          {selectedProjectId ? (
            <ProjectContent
              projectId={selectedProjectId}
              onDeleted={() => setSelectedProjectId(null)}
            />
          ) : (
            <ProjectsOverview onSelectProject={setSelectedProjectId} />
          )}
        </div>
        <footer className="sticky bottom-0 shrink-0 h-5 border-t border-border/40 bg-background" />
      </SidebarInset>
    </SidebarProvider>
  );
}

function DashboardBreadcrumbs({
  selectedProjectId,
  onNavigateToProjects,
}: {
  selectedProjectId: Id<"projects"> | null;
  onNavigateToProjects: () => void;
}) {
  const td = useTranslations("dashboard");
  const project = useQuery(
    api.projects.get,
    selectedProjectId ? { id: selectedProjectId } : "skip"
  );

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {selectedProjectId ? (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink
                className="cursor-pointer"
                onClick={onNavigateToProjects}
              >
                {td("projects")}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{project?.name ?? "..."}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        ) : (
          <BreadcrumbItem>
            <BreadcrumbPage>{td("projects")}</BreadcrumbPage>
          </BreadcrumbItem>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function ProjectsOverview({
  onSelectProject,
}: {
  onSelectProject: (id: Id<"projects">) => void;
}) {
  const tc = useTranslations("common");
  const td = useTranslations("dashboard");
  const projects = useQuery(api.projects.list);

  if (projects === undefined || projects === null) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-sm text-muted-foreground">{tc("loading")}</div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <EmptyState
        title={td("noProjects")}
        description={td("noProjectsDescription")}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <ProjectSummary onSelectProject={onSelectProject} />
    </div>
  );
}

function ProjectContent({
  projectId,
  onDeleted,
}: {
  projectId: Id<"projects">;
  onDeleted: () => void;
}) {
  const tc = useTranslations("common");
  const td = useTranslations("dashboard");
  const project = useQuery(api.projects.get, { id: projectId });

  if (project === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-sm text-muted-foreground">{tc("loading")}</div>
      </div>
    );
  }

  if (project === null) {
    return (
      <EmptyState
        title={td("projectNotFound")}
        description={td("projectNotFoundDescription")}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <ProjectHeader project={project} onDeleted={onDeleted} />
      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">{td("tabs.tasks")}</TabsTrigger>
          <TabsTrigger value="attachments">{td("tabs.attachments")}</TabsTrigger>
        </TabsList>
        <TabsContent value="tasks" className="mt-4">
          <TaskList projectId={projectId} />
        </TabsContent>
        <TabsContent value="attachments" className="mt-4">
          <UploadPanel projectId={projectId} collapsible={false} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
