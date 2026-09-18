"use client";
import type { ReactElement } from "react";
import { ArrowRight, BookOpen } from "lucide-react";
import Link from "../navigation";
import { date, LoadState, noteHref } from "../common";
import { SourceQueue } from "./source-queue";
import { Capture } from "./capture";
import { useOverview } from "./data";
import { Metrics } from "./metrics";

export function WorkbenchHome(): ReactElement {
  const data = useOverview();
  const latest = [...(data.notes.data ?? [])]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 4);
  return (
    <>
      <header className="ux-page-heading">
        <div>
          <span className="ux-kicker">YOUR DAILY WORKSPACE</span>
          <h1>Make something of what you save.</h1>
          <p>
            Pick a source, capture your thinking, then connect it to your
            knowledge.
          </p>
        </div>
        <Link className="kb-button" href="/kb/search">
          Search the vault
          <ArrowRight size={15} />
        </Link>
      </header>
      <Metrics data={data} />
      <Capture />
      <div className="ux-workbench-home">
        <SourceQueue />
        <aside className="ux-context-column">
          <section className="ux-next-action">
            <span className="ux-kicker">NEXT UP</span>
            <h2>
              {data.pending.length
                ? "Give your ideas the final word."
                : "Turn a source into understanding."}
            </h2>
            <p>
              {data.pending.length
                ? `${data.pending.length} proposals are waiting for you. Review the wording and evidence before accepting.`
                : "Open a source from the queue. Select a passage and write why it’s worth keeping."}
            </p>
            <Link href={data.pending.length ? "/kb/proposals" : "/kb/inbox"}>
              {data.pending.length ? "Review proposals" : "Open capture inbox"}
              <ArrowRight size={16} />
            </Link>
          </section>
          <section className="ux-recent-notes">
            <div className="ux-panel-heading">
              <h2>Recently developed</h2>
              <BookOpen size={17} />
            </div>
            <LoadState
              {...data.notes}
              loading={data.notes.loading && !data.notes.refreshing}
              retry={data.notes.reload}
            />
            {(!data.notes.loading || data.notes.refreshing) &&
              !data.notes.error &&
              (latest.length ? (
                latest.map((note) => (
                  <Link key={note.id} href={noteHref(note.id)}>
                    <strong>{note.title}</strong>
                    <span>Updated {date(note.updatedAt)}</span>
                  </Link>
                ))
              ) : (
                <p>Your accepted knowledge notes will appear here.</p>
              ))}
            <Link className="ux-inline-link" href="/kb/knowledge">
              All knowledge
              <ArrowRight size={14} />
            </Link>
          </section>
          <div className="ux-method">
            <span>THE WORKFLOW</span>
            <ol>
              <li>
                <b>Capture</b> a source worth considering.
              </li>
              <li>
                <b>Reflect</b> in your own words.
              </li>
              <li>
                <b>Review</b> suggested connections.
              </li>
              <li>
                <b>Keep</b> knowledge you can use.
              </li>
            </ol>
          </div>
        </aside>
      </div>
    </>
  );
}
