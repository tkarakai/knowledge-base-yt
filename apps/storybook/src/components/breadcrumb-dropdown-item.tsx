"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system";

interface BreadcrumbSibling {
  label: string;
  href: string;
}

interface BreadcrumbDropdownItemProps {
  /** Text displayed in the breadcrumb */
  label: string;
  /** URL this breadcrumb navigates to */
  href: string;
  /** Whether this is the final (current page) segment */
  isCurrentPage?: boolean;
  /** Sibling items shown in the dropdown */
  siblings: BreadcrumbSibling[];
  /** The href of the currently active sibling (highlighted in dropdown) */
  activeHref: string;
  /** Hide on smaller viewports (matches existing hidden md:block pattern) */
  hiddenOnMobile?: boolean;
  /** Show a separator after this breadcrumb item */
  showSeparator?: boolean;
}

export function BreadcrumbDropdownItem({
  label,
  href,
  isCurrentPage = false,
  siblings,
  activeHref,
  hiddenOnMobile = false,
  showSeparator = false,
}: BreadcrumbDropdownItemProps) {
  const hiddenClass = hiddenOnMobile ? "hidden md:flex" : "";

  // Defer DropdownMenu mount until after hydration to avoid Radix ID mismatches.
  // SSR renders a plain breadcrumb label; client upgrades it to a dropdown.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      <BreadcrumbItem className={hiddenClass || undefined}>
        {mounted ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              className={`flex items-center gap-1 outline-none transition-colors ${
                isCurrentPage
                  ? "font-normal text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
              <ChevronDown className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {siblings.map((sibling) => {
                const isActive = sibling.href === activeHref;
                return (
                  <DropdownMenuItem key={sibling.href} asChild>
                    <Link
                      href={sibling.href}
                      className={`pr-6 ${isActive ? "font-semibold" : ""}`}
                    >
                      {isActive ? (
                        <Check className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <span className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                      )}
                      {sibling.label}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : isCurrentPage ? (
          <BreadcrumbPage>{label}</BreadcrumbPage>
        ) : (
          <BreadcrumbLink asChild>
            <Link href={href}>{label}</Link>
          </BreadcrumbLink>
        )}
      </BreadcrumbItem>
      {showSeparator && (
        <BreadcrumbSeparator className={hiddenClass || undefined} />
      )}
    </>
  );
}
