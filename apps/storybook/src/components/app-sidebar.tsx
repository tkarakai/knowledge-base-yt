"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import {
  Layers,
  MousePointerClick,
  Navigation,
  Palette,
  PanelsTopLeft,
  Ruler,
  ScanEye,
  Search,
  SquareMousePointer,
  SwatchBook,
  TextCursorInput,
  X,
} from "lucide-react";

import {
  Input,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@repo/design-system";
import { ThemeToggle } from "@repo/design-patterns";

import { NavMain } from "@/components/nav-main";
import { SidebarTitle } from "@/components/team-switcher";
import {
  type ComponentCategory,
  categoryOrder,
  categoryToSlug,
  getComponentsByCategory,
} from "@/lib/registry";
import {
  type PatternCategory,
  patternCategoryOrder,
  patternCategoryToSlug,
  getPatternsByCategory,
} from "@/lib/pattern-registry";
import {
  type FoundationCategory,
  foundationCategoryOrder,
  foundationCategoryToSlug,
  getFoundationsByCategory,
} from "@/lib/foundation-registry";

const categoryIcons: Record<ComponentCategory, LucideIcon> = {
  Actions: MousePointerClick,
  "Data Display": ScanEye,
  Feedback: SquareMousePointer,
  Form: TextCursorInput,
  Layout: PanelsTopLeft,
  Overlay: Layers,
};

const patternCategoryIcons: Record<PatternCategory, LucideIcon> = {
  Navigation: Navigation,
  Theme: SwatchBook,
  Form: TextCursorInput,
};

const foundationCategoryIcons: Record<FoundationCategory, LucideIcon> = {
  Visual: Palette,
  Layout: Ruler,
};

const componentsByCategory = getComponentsByCategory();

const navItems = categoryOrder.map((category) => ({
  title: category,
  url: `/components/category/${categoryToSlug(category)}`,
  icon: categoryIcons[category],
  items: componentsByCategory[category].map((entry) => ({
    title: entry.name,
    url: `/components/${entry.slug}`,
  })),
}));

const patternsByCategory = getPatternsByCategory();

const patternNavItems = patternCategoryOrder.map((category) => ({
  title: category,
  url: `/patterns/category/${patternCategoryToSlug(category)}`,
  icon: patternCategoryIcons[category],
  items: patternsByCategory[category].map((entry) => ({
    title: entry.name,
    url: `/patterns/${entry.slug}`,
  })),
}));

const foundationsByCategory = getFoundationsByCategory();

const foundationNavItems = foundationCategoryOrder.map((category) => ({
  title: category,
  url: `/foundations/category/${foundationCategoryToSlug(category)}`,
  icon: foundationCategoryIcons[category],
  items: foundationsByCategory[category].map((entry) => ({
    title: entry.name,
    url: `/foundations/${entry.slug}`,
  })),
}));

function SidebarSearch({
  query,
  onQueryChange,
}: {
  query: string;
  onQueryChange: (query: string) => void;
}) {
  const { state: sidebarState, setOpen } = useSidebar();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const isSearching = query.length > 0;

  const handleSearchIconClick = () => {
    if (sidebarState === "collapsed") {
      setOpen(true);
      setTimeout(() => inputRef.current?.focus(), 200);
    } else {
      inputRef.current?.focus();
    }
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild={sidebarState !== "collapsed"}
          tooltip="Search components"
          className={sidebarState === "collapsed" ? "cursor-pointer" : "overflow-visible hover:bg-transparent active:bg-transparent p-0"}
          onClick={sidebarState === "collapsed" ? handleSearchIconClick : undefined}
        >
          {sidebarState === "collapsed" ? (
            <Search />
          ) : (
            <div className="relative flex w-full items-center">
              <Search className="pointer-events-none absolute left-2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                placeholder="Search..."
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                inputSize="sm"
                className={`pl-8 pr-7 ${isSearching ? "ring-2 ring-ring" : ""}`}
              />
              {isSearching && (
                <button
                  type="button"
                  onClick={() => onQueryChange("")}
                  className="absolute right-1.5 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { state: sidebarState } = useSidebar();
  const [query, setQuery] = React.useState("");
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // Only use collapsed after mount to avoid hydration mismatch
  // (collapsed renders a different element tree, shifting Radix IDs)
  const isCollapsed = mounted && sidebarState === "collapsed";

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="gap-3">
        <SidebarTitle />
        <ThemeToggle className={isCollapsed ? undefined : "w-full"} collapsed={isCollapsed} />
        <SidebarSearch query={query} onQueryChange={setQuery} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          items={foundationNavItems}
          query={query}
          label="Foundations"
          labelHref="/foundations"
        />
        <NavMain
          items={navItems}
          query={query}
          label="Components"
          labelHref="/components"
        />
        <NavMain
          items={patternNavItems}
          query={query}
          label="Patterns"
          labelHref="/patterns"
        />
      </SidebarContent>
      <SidebarFooter>
        <p className="text-xs text-muted-foreground text-center py-1">v0.0.1</p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
