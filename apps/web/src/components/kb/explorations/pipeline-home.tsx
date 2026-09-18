"use client";
import type { ReactElement } from "react";
import { ArrowRight, BookOpen, CheckCheck } from "lucide-react";
import Link from "../navigation";
import { date, LoadState, noteHref } from "../common";
import { SourceItem } from "./source-item";
import { Capture } from "./capture";
import { useOverview } from "./data";

export function PipelineHome(): ReactElement {
  const data = useOverview();
  const columns = [
    {
      title: "Capture",
      instruction: "Choose what deserves your attention.",
      count: data.inbox.data?.total,
      resource: data.inbox,
      href: "/kb/inbox",
      action: "Open inbox",
      content: data.inbox.data?.groups
        .flatMap((g) => g.videos)
        .slice(0, 4)
        .map((s) => <SourceItem key={s.id} source={s} compact />),
    },
    {
      title: "Reflect & connect",
      instruction: "Add your perspective. Propose connections.",
      count: data.kept.data?.total,
      resource: data.kept,
      href: "/kb/reflect",
      action: "Continue reflecting",
      content: data.kept.data?.groups
        .flatMap((g) => g.videos)
        .slice(0, 4)
        .map((s) => <SourceItem key={s.id} source={s} compact />),
    },
    {
      title: "Review",
      instruction: "Decide what becomes part of your vault.",
      count: data.proposals.data ? data.pending.length : undefined,
      resource: data.proposals,
      href: "/kb/proposals",
      action: "Open review desk",
      content: data.pending.slice(0, 4).map((p) => (
        <Link className="ux-pipeline-card" key={p.id} href="/kb/proposals">
          <span className="ux-card-label">PROPOSAL</span>
          <h3>{p.summary}</h3>
          <p>
            {p.changes.filter((c) => c.decision === "pending").length} changes
            to review
          </p>
          <span className="ux-inline-link">
            Review changes
            <ArrowRight size={14} />
          </span>
        </Link>
      )),
    },
    {
      title: "Knowledge",
      instruction: "Find, refine, and use your understanding.",
      count: data.notes.data?.length,
      resource: data.notes,
      href: "/kb/knowledge",
      action: "Browse knowledge",
      content: [...(data.notes.data ?? [])]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 4)
        .map((n) => (
          <Link className="ux-pipeline-card" key={n.id} href={noteHref(n.id)}>
            <BookOpen size={18} />
            <h3>{n.title}</h3>
            <p>{n.tags.join(" · ") || "Knowledge note"}</p>
            <span className="ux-card-label">UPDATED {date(n.updatedAt)}</span>
          </Link>
        )),
    },
  ];
  return (
    <>
      <header className="ux-page-heading">
        <div>
          <span className="ux-kicker">FROM WATCHING TO UNDERSTANDING</span>
          <h1>A clear path for every idea.</h1>
          <p>
            Follow the work from left to right. Open any stage to see everything
            in it.
          </p>
        </div>
        <span className="ux-board-label">WORKFLOW OVERVIEW</span>
      </header>
      <Capture />
      <div className="ux-pipeline-board">
        {columns.map((c, index) => (
          <section className={`ux-stage ux-stage-${index}`} key={c.title}>
            <header>
              <span className="ux-stage-number">0{index + 1}</span>
              <h2>{c.title}</h2>
              <span className="ux-stage-count">
                {c.resource.error ? "—" : (c.count ?? "…")}
              </span>
            </header>
            <p>{c.instruction}</p>
            <LoadState
              {...c.resource}
              loading={c.resource.loading && !c.resource.refreshing}
              retry={c.resource.reload}
            />
            {!c.resource.error &&
              (!c.resource.loading || c.resource.refreshing) && (
                <div className="ux-stage-items">
                  {c.content?.length ? (
                    c.content
                  ) : (
                    <div className="ux-stage-empty">
                      <span>0{index + 1}</span>
                      <h3>
                        {
                          [
                            "Start with one video",
                            "Make it personal",
                            "You stay in control",
                            "Build something lasting",
                          ][index]
                        }
                      </h3>
                      <p>
                        {
                          [
                            "Paste a link above, or import your YouTube history.",
                            "Keep a source and save why it matters to you.",
                            "Propose connections from a saved reflection to create a review.",
                            "Accepted changes become editable notes here.",
                          ][index]
                        }
                      </p>
                      {index === 0 && (
                        <Link href="/kb/settings#youtube-history">
                          Import history
                          <ArrowRight size={14} />
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              )}
            <Link className="ux-stage-link" href={c.href}>
              {c.action}
              <ArrowRight size={15} />
            </Link>
            {(c.count ?? 0) > 4 && <small>Showing 4 of {c.count}</small>}
          </section>
        ))}
      </div>
      <div className="ux-pipeline-bottom">
        <CheckCheck size={20} />
        <p>
          <strong>You decide what gets written.</strong> Suggested changes stay
          in review until you accept them.
        </p>
        <Link href="/kb/timeline">
          View activity
          <ArrowRight size={14} />
        </Link>
      </div>
    </>
  );
}
