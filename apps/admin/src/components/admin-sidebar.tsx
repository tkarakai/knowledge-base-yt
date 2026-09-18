"use client";

import * as React from "react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronRight,
  ListChecks,
  LogOut,
  Megaphone,
  PlugZap,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  Users,
} from "lucide-react";

import { ThemeToggle } from "@repo/design-patterns";
import { api } from "@repo/backend";
import { authClient } from "@repo/auth/client";
import {
  Avatar,
  AvatarFallback,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@repo/design-system";

type AdminSidebarProps = React.ComponentProps<typeof Sidebar> & {
  displayName: string;
  displayEmail?: string;
};

const manageItems = [
  { label: "Announcements", href: "/manage/announcements", icon: Megaphone },
  { label: "Onboarding", href: "/manage/onboarding", icon: ListChecks },
  { label: "Users", href: "/manage/users", icon: Users },
];

const observabilityItems = [
  { label: "Audit Trail", href: "/monitor/audit-trail", icon: ScrollText },
];

const configureItems = [
  { label: "Features", href: "/configure/features", icon: SlidersHorizontal },
  { label: "Security", href: "/configure/security", icon: ShieldCheck },
  { label: "Integrations", href: "/configure/integrations", icon: PlugZap },
];

export function AdminSidebar({
  displayName,
  displayEmail,
  ...props
}: AdminSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const sectionItemsIndentClass = "ps-3 group-data-[collapsible=icon]:ps-0";
  const sectionLabelClass =
    "mb-1 h-7 cursor-pointer rounded-sm px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-sidebar-primary hover:text-sidebar-primary/80";
  const [manageOpen, setManageOpen] = React.useState(true);
  const [observabilityOpen, setObservabilityOpen] = React.useState(true);
  const [configureOpen, setConfigureOpen] = React.useState(true);
  const announcements = useQuery(api.announcements.list, {});
  const hasLiveAnnouncement = React.useMemo(
    () => Boolean(announcements?.some((announcement) => announcement.isLive)),
    [announcements]
  );

  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleSignOut = () => {
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => router.push("/sign-in"),
      },
    });
  };

  const isItemActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="Web App Starter Admin"
              className="font-semibold"
            >
              <Link href="/dashboard">
                <img src="/icon.svg" alt="App Icon" className="h-5 w-5 shrink-0" />
                <span>Web App Starter Admin</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <Collapsible
            open={configureOpen}
            onOpenChange={setConfigureOpen}
            className="group/configure"
          >
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className={sectionLabelClass}>
                <ChevronRight className="mr-1 h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]/configure:rotate-90" />
                Configure
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent className={sectionItemsIndentClass}>
                <SidebarMenu>
                  {configureItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isItemActive(item.href)}
                        tooltip={item.label}
                      >
                        <Link href={item.href}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        <SidebarGroup>
          <Collapsible open={manageOpen} onOpenChange={setManageOpen} className="group/manage">
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className={sectionLabelClass}>
                <ChevronRight className="mr-1 h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]/manage:rotate-90" />
                Manage
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent className={sectionItemsIndentClass}>
                <SidebarMenu>
                  {manageItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isItemActive(item.href)}
                        tooltip={item.label}
                      >
                        <Link href={item.href}>
                          <item.icon className="h-4 w-4" />
                          {item.href === "/manage/announcements" ? (
                            <div className="relative inline-block pe-3">
                              {item.label}
                              {hasLiveAnnouncement ? (
                                <span
                                  aria-hidden
                                  className="absolute right-0.5 top-0 inline-flex h-2 w-2 rounded-full ring-1 ring-border bg-emerald-500 animate-pulse"
                                />
                              ) : null}
                            </div>
                          ) : (
                            <span>{item.label}</span>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        <SidebarGroup>
          <Collapsible
            open={observabilityOpen}
            onOpenChange={setObservabilityOpen}
            className="group/observability"
          >
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className={sectionLabelClass}>
                <ChevronRight className="mr-1 h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]/observability:rotate-90" />
                Monitor
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent className={sectionItemsIndentClass}>
                <SidebarMenu>
                  {observabilityItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isItemActive(item.href)}
                        tooltip={item.label}
                      >
                        <Link href={item.href}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
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
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
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
              <DropdownMenuContent side="top" align="start" className="w-48">
                <ThemeToggle className="mx-1 my-1" />
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => router.push("/settings")}>
                  <UserCog className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleSignOut} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
        <p className="text-xs text-muted-foreground text-center py-1">v0.0.1</p>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
