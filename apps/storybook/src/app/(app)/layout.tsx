"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { BreadcrumbDropdownItem } from "@/components/breadcrumb-dropdown-item";
import {
  Breadcrumb,
  BreadcrumbList,
  Separator,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@repo/design-system";
import {
  categoryOrder,
  categoryToSlug,
  componentRegistry,
  slugToCategory,
} from "@/lib/registry";
import {
  patternCategoryOrder,
  patternCategoryToSlug,
  patternRegistry,
  slugToPatternCategory,
} from "@/lib/pattern-registry";
import {
  foundationCategoryOrder,
  foundationCategoryToSlug,
  foundationRegistry,
  slugToFoundationCategory,
} from "@/lib/foundation-registry";

// ── Shared sibling data ────────────────────────────────────────────

const sectionSiblings = [
  { label: "Foundations", href: "/foundations" },
  { label: "Components", href: "/components" },
  { label: "Patterns", href: "/patterns" },
];

const componentCategorySiblings = categoryOrder.map((cat) => ({
  label: cat,
  href: `/components/category/${categoryToSlug(cat)}`,
}));

const patternCategorySiblings = patternCategoryOrder.map((cat) => ({
  label: cat,
  href: `/patterns/category/${patternCategoryToSlug(cat)}`,
}));

const foundationCategorySiblings = foundationCategoryOrder.map((cat) => ({
  label: cat,
  href: `/foundations/category/${foundationCategoryToSlug(cat)}`,
}));

function getComponentItemSiblings(category: string) {
  return componentRegistry
    .filter((c) => c.category === category)
    .map((c) => ({ label: c.name, href: `/components/${c.slug}` }));
}

function getPatternItemSiblings(category: string) {
  return patternRegistry
    .filter((p) => p.category === category)
    .map((p) => ({ label: p.name, href: `/patterns/${p.slug}` }));
}

function getFoundationItemSiblings(category: string) {
  return foundationRegistry
    .filter((f) => f.category === category)
    .map((f) => ({ label: f.name, href: `/foundations/${f.slug}` }));
}

// ── Layout ─────────────────────────────────────────────────────────

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // ── Route resolution ───────────────────────────────────────────

  // Index pages
  const isComponentsIndex = pathname === "/components";
  const isPatternsIndex = pathname === "/patterns";
  const isFoundationsIndex = pathname === "/foundations";

  // Component page: /components/<slug>
  const componentSlug =
    pathname.startsWith("/components/") &&
    !pathname.startsWith("/components/category/")
      ? pathname.replace("/components/", "")
      : null;
  const componentEntry = componentSlug
    ? componentRegistry.find((c) => c.slug === componentSlug)
    : null;

  // Component category: /components/category/<slug>
  const categorySlugMatch = pathname.startsWith("/components/category/")
    ? pathname.replace("/components/category/", "")
    : null;
  const categoryName = categorySlugMatch
    ? slugToCategory(categorySlugMatch)
    : null;

  // Pattern page: /patterns/<slug>
  const patternSlug =
    pathname.startsWith("/patterns/") &&
    !pathname.startsWith("/patterns/category/")
      ? pathname.replace("/patterns/", "")
      : null;
  const patternEntry = patternSlug
    ? patternRegistry.find((p) => p.slug === patternSlug)
    : null;

  // Pattern category: /patterns/category/<slug>
  const patternCategorySlugMatch = pathname.startsWith("/patterns/category/")
    ? pathname.replace("/patterns/category/", "")
    : null;
  const patternCategoryName = patternCategorySlugMatch
    ? slugToPatternCategory(patternCategorySlugMatch)
    : null;

  // Foundation page: /foundations/<slug>
  const foundationSlug =
    pathname.startsWith("/foundations/") &&
    !pathname.startsWith("/foundations/category/")
      ? pathname.replace("/foundations/", "")
      : null;
  const foundationEntry = foundationSlug
    ? foundationRegistry.find((f) => f.slug === foundationSlug)
    : null;

  // Foundation category: /foundations/category/<slug>
  const foundationCategorySlugMatch = pathname.startsWith(
    "/foundations/category/",
  )
    ? pathname.replace("/foundations/category/", "")
    : null;
  const foundationCategoryName = foundationCategorySlugMatch
    ? slugToFoundationCategory(foundationCategorySlugMatch)
    : null;

  // ── Breadcrumb rendering ───────────────────────────────────────

  const renderBreadcrumbs = () => {
    // Component detail page: Components > Category > Item
    if (componentEntry) {
      const catHref = `/components/category/${categoryToSlug(componentEntry.category)}`;
      return (
        <>
          <BreadcrumbDropdownItem
            label="Components"
            href="/components"
            siblings={sectionSiblings}
            activeHref="/components"
            hiddenOnMobile
            showSeparator
          />
          <BreadcrumbDropdownItem
            label={componentEntry.category}
            href={catHref}
            siblings={componentCategorySiblings}
            activeHref={catHref}
            hiddenOnMobile
            showSeparator
          />
          <BreadcrumbDropdownItem
            label={componentEntry.name}
            href={`/components/${componentEntry.slug}`}
            isCurrentPage
            siblings={getComponentItemSiblings(componentEntry.category)}
            activeHref={`/components/${componentEntry.slug}`}
          />
        </>
      );
    }

    // Component category page: Components > Category
    if (categoryName) {
      const catHref = `/components/category/${categoryToSlug(categoryName)}`;
      return (
        <>
          <BreadcrumbDropdownItem
            label="Components"
            href="/components"
            siblings={sectionSiblings}
            activeHref="/components"
            hiddenOnMobile
            showSeparator
          />
          <BreadcrumbDropdownItem
            label={categoryName}
            href={catHref}
            isCurrentPage
            siblings={componentCategorySiblings}
            activeHref={catHref}
          />
        </>
      );
    }

    // Pattern detail page: Patterns > Category > Item
    if (patternEntry) {
      const catHref = `/patterns/category/${patternCategoryToSlug(patternEntry.category)}`;
      return (
        <>
          <BreadcrumbDropdownItem
            label="Patterns"
            href="/patterns"
            siblings={sectionSiblings}
            activeHref="/patterns"
            hiddenOnMobile
            showSeparator
          />
          <BreadcrumbDropdownItem
            label={patternEntry.category}
            href={catHref}
            siblings={patternCategorySiblings}
            activeHref={catHref}
            hiddenOnMobile
            showSeparator
          />
          <BreadcrumbDropdownItem
            label={patternEntry.name}
            href={`/patterns/${patternEntry.slug}`}
            isCurrentPage
            siblings={getPatternItemSiblings(patternEntry.category)}
            activeHref={`/patterns/${patternEntry.slug}`}
          />
        </>
      );
    }

    // Pattern category page: Patterns > Category
    if (patternCategoryName) {
      const catHref = `/patterns/category/${patternCategoryToSlug(patternCategoryName)}`;
      return (
        <>
          <BreadcrumbDropdownItem
            label="Patterns"
            href="/patterns"
            siblings={sectionSiblings}
            activeHref="/patterns"
            hiddenOnMobile
            showSeparator
          />
          <BreadcrumbDropdownItem
            label={patternCategoryName}
            href={catHref}
            isCurrentPage
            siblings={patternCategorySiblings}
            activeHref={catHref}
          />
        </>
      );
    }

    // Foundation detail page: Foundations > Category > Item
    if (foundationEntry) {
      const catHref = `/foundations/category/${foundationCategoryToSlug(foundationEntry.category)}`;
      return (
        <>
          <BreadcrumbDropdownItem
            label="Foundations"
            href="/foundations"
            siblings={sectionSiblings}
            activeHref="/foundations"
            hiddenOnMobile
            showSeparator
          />
          <BreadcrumbDropdownItem
            label={foundationEntry.category}
            href={catHref}
            siblings={foundationCategorySiblings}
            activeHref={catHref}
            hiddenOnMobile
            showSeparator
          />
          <BreadcrumbDropdownItem
            label={foundationEntry.name}
            href={`/foundations/${foundationEntry.slug}`}
            isCurrentPage
            siblings={getFoundationItemSiblings(foundationEntry.category)}
            activeHref={`/foundations/${foundationEntry.slug}`}
          />
        </>
      );
    }

    // Foundation category page: Foundations > Category
    if (foundationCategoryName) {
      const catHref = `/foundations/category/${foundationCategoryToSlug(foundationCategoryName)}`;
      return (
        <>
          <BreadcrumbDropdownItem
            label="Foundations"
            href="/foundations"
            siblings={sectionSiblings}
            activeHref="/foundations"
            hiddenOnMobile
            showSeparator
          />
          <BreadcrumbDropdownItem
            label={foundationCategoryName}
            href={catHref}
            isCurrentPage
            siblings={foundationCategorySiblings}
            activeHref={catHref}
          />
        </>
      );
    }

    // Index pages: single breadcrumb with section switcher
    if (isFoundationsIndex) {
      return (
        <BreadcrumbDropdownItem
          label="Foundations"
          href="/foundations"
          isCurrentPage
          siblings={sectionSiblings}
          activeHref="/foundations"
        />
      );
    }

    if (isPatternsIndex) {
      return (
        <BreadcrumbDropdownItem
          label="Patterns"
          href="/patterns"
          isCurrentPage
          siblings={sectionSiblings}
          activeHref="/patterns"
        />
      );
    }

    if (isComponentsIndex) {
      return (
        <BreadcrumbDropdownItem
          label="Components"
          href="/components"
          isCurrentPage
          siblings={sectionSiblings}
          activeHref="/components"
        />
      );
    }

    // Default fallback
    return (
      <BreadcrumbDropdownItem
        label="Components"
        href="/components"
        isCurrentPage
        siblings={sectionSiblings}
        activeHref="/components"
      />
    );
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col h-dvh min-w-0">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b border-border/40 bg-background transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>{renderBreadcrumbs()}</BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex-1 min-w-0 overflow-y-auto p-6">
          <div className="mx-auto w-full max-w-[58rem]">{children}</div>
        </div>
        <footer className="sticky bottom-0 shrink-0 h-5 border-t border-border/40 bg-background" />
      </SidebarInset>
    </SidebarProvider>
  );
}
