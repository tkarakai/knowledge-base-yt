"use client";

import { useState } from "react";
import { Link2, RefreshCw } from "lucide-react";
import type { HistoryConnection } from "@repo/kb-shared";
import {
  api,
  date,
  Feedback,
  LoadState,
  useAction,
  useResource,
} from "./common";

export function HistoryConnectionSettings() {
  const connection = useResource<HistoryConnection>("history/connection");
  const action = useAction();
  const [pairing, setPairing] = useState<{
    code: string;
    expiresAt: string;
  } | null>(null);
  return (
    <section className="kb-settings-section" id="youtube-history">
      <div className="kb-settings-description">
        <Link2 size={22} strokeWidth={1.4} />
        <h2>YouTube history</h2>
        <p>
          Bring the past 12 months into your inbox. Your browser keeps your
          YouTube sign-in; Commonplace receives the videos you import.
        </p>
      </div>
      <div>
        <LoadState {...connection} retry={connection.reload} />
        <Feedback {...action} />
        <p>
          <strong>
            {connection.data?.connected
              ? "History extension connected"
              : "Connect the Commonplace history extension"}
          </strong>
        </p>
        <p className="kb-help">
          Load the Commonplace extension in Chrome or Edge, then open it from
          your browser toolbar. Generate a code here and paste it into the
          extension to pair this workspace.
        </p>
        <p className="kb-help">
          In the extension, open YouTube history, sign in, and select{" "}
          <strong>Import last 12 months</strong>. It loads older pages
          automatically and can resume a partial import. Existing decisions are
          preserved.
        </p>
        <div className="kb-form-actions">
          <button
            className="kb-button"
            disabled={action.busy}
            onClick={() =>
              void action.run(async () => {
                setPairing(await api("history/pair-code", "POST", {}));
              })
            }
          >
            {pairing ? "Generate a new code" : "Generate pairing code"}
          </button>
          <button
            className="kb-button kb-small"
            disabled={action.busy}
            onClick={connection.reload}
          >
            <RefreshCw size={14} />
            Check connection
          </button>
          {connection.data?.connected && (
            <button
              className="kb-button kb-small"
              disabled={action.busy}
              onClick={() =>
                void action.run(async () => {
                  await api("history/disconnect", "POST", {});
                  setPairing(null);
                  connection.reload();
                }, "Extension disconnected. Imported videos remain in your vault.")
              }
            >
              Disconnect
            </button>
          )}
        </div>
        {pairing && (
          <div className="kb-history-pairing">
            <label htmlFor="history-pairing-code">One-time pairing code</label>
            <input
              id="history-pairing-code"
              readOnly
              value={pairing.code}
              onFocus={(event) => event.target.select()}
            />
            <p className="kb-help">
              Expires at{" "}
              {new Date(pairing.expiresAt).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
              . In the extension, use companion address{" "}
              <code>http://127.0.0.1:4317</code> unless you configured another
              port.
            </p>
          </div>
        )}
        {connection.data?.lastImportAt && (
          <p className="kb-help">
            Last batch received {date(connection.data.lastImportAt)}. Open the
            extension for full import progress.
          </p>
        )}
        <p className="kb-help">
          Captions are available on demand from each source. Disconnecting
          revokes the extension’s import access.
        </p>
      </div>
    </section>
  );
}
