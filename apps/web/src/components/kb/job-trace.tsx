"use client";
import { useState } from "react";
import type { Job, RunTraceEvent } from "@repo/kb-shared";
import { api } from "./common";

export function JobTrace({ job }: { job: Job }) {
  const [events, setEvents] = useState<RunTraceEvent[]>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await api<{ events: RunTraceEvent[] }>(
        `jobs/${encodeURIComponent(job.id)}/trace`,
      );
      setEvents(result.events);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not load trace");
    } finally {
      setLoading(false);
    }
  }
  if (!job.traceId) return null;
  return (
    <details
      className="kb-trace"
      onToggle={(event) => {
        if (event.currentTarget.open && !events && !loading && !error)
          void load();
      }}
    >
      <summary>
        View communication trace{job.errorCode ? ` · ${job.errorCode}` : ""}
      </summary>
      <p className="kb-help">
        Local trace {job.traceId}. Contains prompts, source passages, responses
        and tool results. Credentials are redacted. The latest 100 traces are
        retained.
      </p>
      <button
        className="kb-text-button"
        disabled={loading}
        onClick={() => void load()}
      >
        {loading ? "Loading…" : "Refresh trace"}
      </button>
      {error && <p role="alert">{error}</p>}
      {events && (
        <>
          <button
            className="kb-text-button"
            onClick={() => {
              const blob = new Blob(
                [
                  events.map((event) => JSON.stringify(event)).join("\n") +
                    "\n",
                ],
                { type: "application/x-ndjson" },
              );
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = `commonplace-${job.traceId}.jsonl`;
              link.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            Download JSONL
          </button>
          {events.map((event, index) => (
            <details key={index}>
              <summary>
                {index + 1}. {event.type} ·{" "}
                {new Date(event.at).toLocaleTimeString()}
              </summary>
              <pre>{JSON.stringify(event.data, null, 2)}</pre>
            </details>
          ))}
        </>
      )}
    </details>
  );
}
