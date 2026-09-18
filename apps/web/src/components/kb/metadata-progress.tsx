"use client";

import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, RefreshCw } from "lucide-react";
import type { MetadataProgress } from "@repo/kb-shared";
import { api } from "./common";

function remainingTime(seconds: number) {
  if (seconds < 60) return "About a minute remaining";
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `About ${minutes} minutes remaining`;
  const hours = Math.floor(minutes / 60);
  return `About ${hours}h ${minutes % 60}m remaining`;
}

export function MetadataProgressPanel({
  onUpdated,
}: {
  onUpdated: () => void;
}) {
  const [status, setStatus] = useState<MetadataProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const lastCompleted = useRef<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        if (!document.hidden) {
          const next = await api<MetadataProgress>(
            "metadata/status",
            "GET",
            undefined,
            controller.signal,
          );
          if (controller.signal.aborted) return;
          setStatus(next);
          setError(null);
          if (
            lastCompleted.current !== null &&
            lastCompleted.current !== next.completed &&
            next.completed === next.total
          )
            onUpdated();
          lastCompleted.current = next.completed;
        }
      } catch (reason) {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to read progress.",
          );
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(poll, 2000);
      }
    }
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [onUpdated]);
  const running = !!status && status.active + status.queued > 0;
  const paused = status && !status.enabled;
  const percent = status?.total
    ? Math.floor((status.completed / status.total) * 100)
    : 0;
  return (
    <section
      className="kb-metadata-progress"
      aria-label="Video details progress"
    >
      <div className="kb-metadata-heading">
        <div role="status" aria-live="polite">
          {running && !paused ? (
            <LoaderCircle size={17} className="kb-spin" aria-hidden="true" />
          ) : (
            <Check size={17} aria-hidden="true" />
          )}
          <strong>
            {paused
              ? "Video details paused"
              : running
                ? "Getting video details"
                : status?.total
                  ? "Video detail checks finished"
                  : "Video details"}
          </strong>
          {status && status.total > 0 && (
            <span>
              {status.completed.toLocaleString()} of{" "}
              {status.total.toLocaleString()} checked · {percent}%
            </span>
          )}
        </div>
        <button
          className="kb-button kb-small"
          disabled={!status || !!paused || running || retrying}
          title="Only retries missing release dates, channel names and thumbnail details. Complete videos are skipped."
          onClick={async () => {
            setRetrying(true);
            try {
              const next = await api<MetadataProgress>(
                "metadata/refresh",
                "POST",
                {},
              );
              setStatus(next);
              setError(null);
              onUpdated();
            } catch (reason) {
              setError(
                reason instanceof Error
                  ? reason.message
                  : "Unable to retry missing details.",
              );
            } finally {
              setRetrying(false);
            }
          }}
        >
          {retrying ? (
            <LoaderCircle size={14} className="kb-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          {retrying ? "Queueing…" : "Retry missing details"}
        </button>
      </div>
      {!!status?.total && (
        <progress
          aria-label="Video detail checks"
          max={status.total}
          value={status.completed}
        />
      )}
      <p>
        {paused
          ? "Enable YouTube access in Settings to continue. "
          : running
            ? `${status.active} loading · ${status.queued.toLocaleString()} queued · ${status.estimatedRemainingSeconds === null ? "Estimating time remaining…" : remainingTime(status.estimatedRemainingSeconds)}. `
            : "Complete videos are skipped when you retry. "}
        {!!status?.incomplete &&
          `${status.incomplete.toLocaleString()} checked videos still have missing details. `}
        Thumbnails and channel icons are saved as videos come into view.
      </p>
      {error && (
        <p className="kb-error" role="alert">
          Progress unavailable: {error}
        </p>
      )}
    </section>
  );
}
