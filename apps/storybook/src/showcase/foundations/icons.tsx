"use client";

import { useMemo, useState } from "react";
import { DynamicIcon, iconNames, type IconName } from "lucide-react/dynamic";
import { DemoSection } from "@/components/demo-section";

/** Convert kebab-case icon name to a readable title: "arrow-down-left" → "Arrow Down Left" */
function formatIconName(name: string): string {
  return name
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Total available in the library */
const totalIcons = iconNames.length;

/** Number of icons to display per page */
const PAGE_SIZE = 120;

function SearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Search ${totalIcons.toLocaleString()} icons…`}
        className="h-9 w-full rounded-md border border-border bg-background px-3 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <span className="sr-only">Clear</span>
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}

function IconCell({ name }: { name: IconName }) {
  const [copied, setCopied] = useState(false);

  const importName = formatIconName(name).replace(/\s/g, "");

  const handleCopy = async () => {
    try {
      await window.navigator.clipboard.writeText(importName);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may not be available
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`${importName} — click to copy`}
      className="group flex flex-col items-center gap-2 rounded-md p-3 text-center transition-colors hover:bg-accent/50"
    >
      <div className="flex h-8 w-8 items-center justify-center text-foreground">
        <DynamicIcon
          name={name}
          size={20}
          fallback={() => (
            <div className="h-5 w-5 animate-pulse rounded bg-muted" />
          )}
        />
      </div>
      <span
        className={`w-full text-[10px] leading-tight transition-colors ${
          copied
            ? "font-medium text-primary"
            : "text-muted-foreground group-hover:text-foreground"
        }`}
      >
        {copied ? "Copied!" : name}
      </span>
    </button>
  );
}

export default function IconsShowcase() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!search.trim()) return iconNames;
    const q = search.toLowerCase().trim();
    return iconNames.filter((name) => name.includes(q));
  }, [search]);

  // Reset to first page when search changes
  const currentPage = search !== "" ? 0 : page;
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE
  );
  const hasMore = currentPage + 1 < totalPages;

  return (
    <>
      <DemoSection
        title="App Icon"
        description="The shared brand icon used across all applications. Managed in @repo/design-system/assets/ and automatically copied to each app's public directory during build."
      >
        <div className="space-y-6">
          {/* SVG icon at different sizes */}
          <div>
            <p className="mb-3 text-xs font-medium text-foreground">SVG (primary)</p>
            <div className="flex flex-wrap items-end gap-8">
              <div className="flex flex-col items-center gap-2">
                <img src="/icon.svg" alt="App Icon SVG" className="h-16 w-16" />
                <span className="text-xs text-muted-foreground">64×64</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <img src="/icon.svg" alt="App Icon SVG" className="h-8 w-8" />
                <span className="text-xs text-muted-foreground">32×32</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <img src="/icon.svg" alt="App Icon SVG" className="h-4 w-4" />
                <span className="text-xs text-muted-foreground">16×16</span>
              </div>
            </div>
          </div>

          {/* Raster fallbacks */}
          <div>
            <p className="mb-3 text-xs font-medium text-foreground">Raster fallbacks</p>
            <div className="flex flex-wrap items-end gap-8">
              <div className="flex flex-col items-center gap-2">
                <img src="/apple-touch-icon.png" alt="Apple Touch Icon" className="h-[180px] w-[180px] rounded-[40px]" />
                <span className="text-xs text-muted-foreground">apple-touch-icon (180×180)</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <img src="/favicon.ico" alt="Favicon" className="h-8 w-8" />
                <span className="text-xs text-muted-foreground">favicon.ico (32×32)</span>
              </div>
            </div>
          </div>

          {/* Usage information */}
          <div className="space-y-2 rounded-md border border-border bg-muted/30 p-4">
            <p className="text-sm font-medium">Usage</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>
                <strong className="text-foreground">Source:</strong>{" "}
                <code className="rounded bg-background px-1 py-0.5">
                  packages/design-system/assets/
                </code>
              </p>
              <p>
                <strong className="text-foreground">Deployed to:</strong>{" "}
                <code className="rounded bg-background px-1 py-0.5">
                  apps/*/public/
                </code>
              </p>
              <p>
                <strong className="text-foreground">Build script:</strong>{" "}
                <code className="rounded bg-background px-1 py-0.5">
                  scripts/copy-shared-assets.sh
                </code>
              </p>
              <p className="pt-1">
                All icon assets are automatically copied to every app before
                development and production builds. To update, edit the source
                files in the design-system package.
              </p>
            </div>
          </div>
        </div>
      </DemoSection>

      <DemoSection
        title="Icon Library"
        description={`${totalIcons.toLocaleString()} icons available from Lucide. Click any icon to copy its import name.`}
        toolbar={<SearchInput value={search} onChange={setSearch} />}
      >
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No icons match &ldquo;{search}&rdquo;
            </p>
          ) : (
            <>
              {search.trim() && (
                <p className="text-xs text-muted-foreground">
                  {filtered.length.toLocaleString()} result
                  {filtered.length !== 1 ? "s" : ""}
                </p>
              )}
              <div className="grid grid-cols-4 gap-1 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
                {paged.map((name) => (
                  <IconCell key={name} name={name} />
                ))}
              </div>
              {/* Pagination */}
              {totalPages > 1 && !search.trim() && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-muted-foreground">
                    Showing {currentPage * PAGE_SIZE + 1}–
                    {Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)}{" "}
                    of {filtered.length.toLocaleString()}
                  </p>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={currentPage === 0}
                      className="rounded-md border border-border px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPage((p) => Math.min(totalPages - 1, p + 1))
                      }
                      disabled={!hasMore}
                      className="rounded-md border border-border px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DemoSection>
    </>
  );
}
