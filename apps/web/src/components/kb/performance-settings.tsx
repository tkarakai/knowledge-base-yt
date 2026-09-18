"use client";
import { useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { useResource, LoadState } from "./common";

interface Metrics {
  memory: { rssBytes: number };
  eventLoopLag: { p95Ms: number };
  pendingWrites: number;
  vault: {
    catalogSize: number;
    scans: number;
    filesRead: number;
    catalogHits: number;
    lastScanMs: number;
  };
  operations: Record<
    string,
    { count: number; errors: number; p50Ms: number; p95Ms: number }
  >;
}
export function PerformanceSettings() {
  const [open, setOpen] = useState(false);
  const metrics = useResource<Metrics>(open ? "metrics" : null);
  return (
    <section className="kb-settings-section">
      <div className="kb-settings-description">
        <Activity size={22} strokeWidth={1.4} />
        <h2>Performance</h2>
        <p>
          Local diagnostics for request latency, background work and vault
          reads. No video titles or search queries are recorded.
        </p>
      </div>
      <details onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary>Show performance metrics</summary>
        {open && (
          <>
            <LoadState {...metrics} retry={metrics.reload} />
            {metrics.data && (
              <>
                <p className="kb-help">
                  {metrics.data.vault.catalogSize.toLocaleString()} indexed
                  records · {metrics.data.pendingWrites} pending writes ·{" "}
                  {Math.round(metrics.data.memory.rssBytes / 1024 / 1024)} MB
                  process memory
                </p>
                <p className="kb-help">
                  Event-loop delay p95: {metrics.data.eventLoopLag.p95Ms} ms ·
                  Last vault scan: {Math.round(metrics.data.vault.lastScanMs)}{" "}
                  ms · {metrics.data.vault.scans} scans /{" "}
                  {metrics.data.vault.catalogHits.toLocaleString()} catalog hits
                </p>
                <div className="kb-performance-table">
                  <table>
                    <caption>
                      Recent companion requests (up to 200 samples per
                      operation)
                    </caption>
                    <thead>
                      <tr>
                        <th>Operation</th>
                        <th>Requests</th>
                        <th>p50</th>
                        <th>p95</th>
                        <th>Errors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(metrics.data.operations).map(
                        ([name, entry]) => (
                          <tr key={name}>
                            <td>{name}</td>
                            <td>{entry.count}</td>
                            <td>{entry.p50Ms} ms</td>
                            <td>{entry.p95Ms} ms</td>
                            <td>{entry.errors}</td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <button
              className="kb-button kb-small"
              disabled={metrics.loading}
              onClick={metrics.reload}
            >
              <RefreshCw size={14} />
              Refresh metrics
            </button>
            <p className="kb-help">
              p95 means 95% of measured requests finished within that time.
              Measurements reset when the companion restarts.
            </p>
          </>
        )}
      </details>
    </section>
  );
}
