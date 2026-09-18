"use client";

import { useEffect, useState, type ReactElement } from "react";
import { ChevronLeft, ChevronRight, RefreshCw, Search } from "lucide-react";
import type { SourcePage } from "@repo/kb-shared";
import { LoadState, useResource } from "../common";
import { SourceItem } from "./source-item";

export function SourceQueue({
  selected,
  compact = false,
  initialTab = "inbox",
}: {
  selected?: string;
  compact?: boolean;
  initialTab?: string;
}): ReactElement {
  const [filter, setFilter] = useState(initialTab);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query);
      setPage(1);
    }, 180);
    return () => clearTimeout(timer);
  }, [query]);
  const params = new URLSearchParams({
    tab: filter,
    q: search,
    page: String(page),
  });
  const sources = useResource<SourcePage>(`sources/page?${params}`);
  const reload = sources.reload;
  useEffect(() => {
    const refresh = () => {
      if (!document.hidden) reload();
    };
    const timer = setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [reload]);
  return (
    <section
      className={`ux-queue ${compact ? "ux-queue-compact" : ""}`}
      aria-label="Source queue"
    >
      <div className="ux-panel-heading">
        <h2>{compact ? "Source queue" : "Your sources"}</h2>
        <button
          className="kb-icon-button"
          aria-label="Refresh source queue"
          onClick={reload}
        >
          <RefreshCw size={14} />
        </button>
      </div>
      <div className="ux-queue-tools">
        <label className="ux-search-input">
          <Search size={15} />
          <input
            aria-label="Find a source"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Title or channel…"
          />
        </label>
        <select
          aria-label="Source queue filter"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="inbox">To reflect on</option>
          <option value="kept">In progress</option>
          <option value="later">For later</option>
          <option value="all">All sources</option>
        </select>
      </div>
      <LoadState
        loading={sources.loading && !sources.refreshing}
        error={sources.error}
        retry={reload}
      />
      {!sources.error && (!sources.loading || sources.refreshing) && (
        <>
          <div className="ux-queue-count">
            {sources.data?.total ?? 0} sources · Newest release first
          </div>
          <div
            className="ux-queue-list"
            tabIndex={0}
            role="region"
            aria-label="Sources on this page"
          >
            {sources.data?.groups
              .flatMap((g) => g.videos)
              .map((source) => (
                <SourceItem
                  key={source.id}
                  source={source}
                  selected={source.id === selected}
                  compact={compact}
                />
              ))}
            {!sources.data?.total && (
              <div className="ux-empty-inline">
                <h3>{search ? "No matching sources" : "You’re up to date"}</h3>
                <p>
                  {search
                    ? "Try a different title or channel, or change the filter."
                    : "Add a video above or choose All sources to revisit earlier work."}
                </p>
              </div>
            )}
          </div>
        </>
      )}
      <div className="ux-pagination">
        <button
          className="kb-icon-button"
          aria-label="Previous source page"
          disabled={sources.loading || (sources.data?.page ?? 1) <= 1}
          onClick={() => setPage(Math.max(1, (sources.data?.page ?? 1) - 1))}
        >
          <ChevronLeft size={16} />
        </button>
        <span>
          Page {sources.data?.page ?? 1} of {sources.data?.pages ?? 1}
        </span>
        <button
          className="kb-icon-button"
          aria-label="Next source page"
          disabled={
            sources.loading ||
            !sources.data ||
            sources.data.page >= sources.data.pages
          }
          onClick={() => setPage((sources.data?.page ?? 1) + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </section>
  );
}
