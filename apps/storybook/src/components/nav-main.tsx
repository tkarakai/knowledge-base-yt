"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@repo/design-system";

interface NavItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  items?: { title: string; url: string }[];
}

/** Highlights portions of `text` that match `query` (case-insensitive). */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;

  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;

  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + query.length);
  const after = text.slice(idx + query.length);

  return (
    <>
      {before}
      <mark className="bg-primary/15 text-inherit rounded-sm">{match}</mark>
      {after}
    </>
  );
}

export function NavMain({
  items,
  query = "",
  label = "Components",
  labelHref,
}: {
  items: NavItem[];
  query?: string;
  label?: string;
  labelHref?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { state: sidebarState } = useSidebar();

  const isSearching = query.length > 0;

  // Determine which category should be forced open based on the current route
  const activeCategory = items.find(
    (item) =>
      item.url === pathname ||
      item.items?.some((sub) => sub.url === pathname),
  );

  const allCategoryTitles = useMemo(
    () => items.map((item) => item.title),
    [items],
  );
  const [openSet, setOpenSet] = useState<Set<string>>(
    () => new Set(allCategoryTitles),
  );

  const toggleCategory = useCallback((title: string) => {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  }, []);

  // Filter items based on search query
  const filteredItems = useMemo((): NavItem[] => {
    if (!isSearching) return items;

    const q = query.toLowerCase();
    const results: NavItem[] = [];
    for (const item of items) {
      const matchingChildren = item.items?.filter((sub) =>
        sub.title.toLowerCase().includes(q),
      );
      // Show category if its name matches or any child matches
      if (
        item.title.toLowerCase().includes(q) ||
        (matchingChildren && matchingChildren.length > 0)
      ) {
        results.push({ ...item, items: matchingChildren });
      }
    }
    return results;
  }, [items, query, isSearching]);

  const sectionTitleClass =
    "mb-1 h-7 rounded-sm px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-sidebar-primary";

  return (
    <SidebarGroup>
      {labelHref ? (
        <SidebarGroupLabel
          asChild
          className={`${sectionTitleClass} hover:text-sidebar-primary/80`}
        >
          <Link href={labelHref}>{label}</Link>
        </SidebarGroupLabel>
      ) : (
        <SidebarGroupLabel className={sectionTitleClass}>
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarMenu>
        {/* Navigation items */}
        {filteredItems.map((item) => {
          const isCategoryActive = item.title === activeCategory?.title;
          // When searching, force all matching categories open
          const isOpen = isSearching || openSet.has(item.title);

          return (
            <Collapsible
              key={item.title}
              asChild
              {...(isSearching
                ? { open: true }
                : { open: isOpen, onOpenChange: () => toggleCategory(item.title) })}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={isCategoryActive}
                    closeOnSelectMobile
                    className={
                      isCategoryActive
                        ? "bg-sidebar-primary/10 font-semibold text-sidebar-primary"
                        : undefined
                    }
                    onClick={() => router.push(item.url)}
                  >
                    {item.icon && <item.icon />}
                    <span className="truncate whitespace-nowrap">
                      <Highlight text={item.title} query={isSearching ? query : ""} />
                    </span>
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items?.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={subItem.url === pathname}
                          className={
                            subItem.url === pathname
                              ? "bg-sidebar-primary/10 font-semibold text-sidebar-primary"
                              : undefined
                          }
                        >
                          <Link href={subItem.url}>
                            <span>
                              <Highlight
                                text={subItem.title}
                                query={isSearching ? query : ""}
                              />
                            </span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          );
        })}

        {/* No results message (hidden when sidebar is collapsed — no room) */}
        {isSearching && filteredItems.length === 0 && sidebarState !== "collapsed" && (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">
            No {label.toLowerCase()} found
          </li>
        )}
      </SidebarMenu>
    </SidebarGroup>
  );
}
