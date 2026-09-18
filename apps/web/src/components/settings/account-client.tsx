"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { UserCog } from "lucide-react";
import { useTranslations } from "next-intl";

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
import { AppSidebar } from "@/components/projects/app-sidebar";
import { AnnouncementBannerHost } from "@/components/announcement-banner-host";
import { ProfileSection } from "@/components/settings/profile-section";
import { SecuritySection } from "@/components/settings/security-section";

export function AccountClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authUser = useAuthUser();
  const td = useTranslations("dashboard");
  const [tab, setTab] = React.useState<"profile" | "security">(
    searchParams.get("tab") === "security" ? "security" : "profile",
  );

  React.useEffect(() => {
    setTab(searchParams.get("tab") === "security" ? "security" : "profile");
  }, [searchParams]);

  const displayName = authUser?.name ?? "Anonymous";
  const displayEmail = authUser?.email;

  return (
    <SidebarProvider>
      <AppSidebar
        displayName={displayName}
        displayEmail={displayEmail ?? undefined}
        selectedProjectId={null}
        onSelectProject={() => router.push("/dashboard")}
      />
      <SidebarInset className="flex flex-col h-dvh">
        <AnnouncementBannerHost className="shrink-0" />
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border/40 bg-background px-4">
          <SidebarTrigger className="-ms-1" />
          <Separator
            orientation="vertical"
            className="me-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink
                  className="cursor-pointer"
                  onClick={() => router.push("/dashboard")}
                >
                  {td("projects")}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{td("account")}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <UserCog className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold">{td("account")}</h1>
                  <p className="text-sm text-muted-foreground">
                    {td("profile.description")}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            <Tabs value={tab} onValueChange={(value) => setTab(value === "security" ? "security" : "profile")}>
              <TabsList>
                <TabsTrigger value="profile">{td("profile.title")}</TabsTrigger>
                <TabsTrigger value="security">{td("security")}</TabsTrigger>
              </TabsList>
              <TabsContent value="profile" className="mt-4">
                <ProfileSection />
              </TabsContent>
              <TabsContent value="security" className="mt-4">
                <SecuritySection />
              </TabsContent>
            </Tabs>
          </div>
        </div>
        <footer className="sticky bottom-0 shrink-0 h-5 border-t border-border/40 bg-background" />
      </SidebarInset>
    </SidebarProvider>
  );
}
