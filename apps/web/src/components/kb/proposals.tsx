"use client";

import { useMemo, useState } from "react";
import Link from "./navigation";
import {
  ArrowRight,
  Check,
  CheckCheck,
  GitPullRequest,
  Pencil,
  RefreshCw,
  X,
} from "lucide-react";
import type { ProposedChange, SynthesisProposal } from "@repo/kb-shared";
import { markdownDiff } from "@/lib/kb/diff";
import {
  api,
  useResource,
  useAction,
  Feedback,
  LoadState,
  Empty,
  PageTitle,
  Badge,
  date,
  stamp,
  sourceHref,
} from "./common";

type Choice = { action: "accept" | "reject" | "pending"; markdown: string };

export function ProposalsView() {
  const proposals = useResource<SynthesisProposal[]>("proposals");
  const [filter, setFilter] = useState("pending");
  const pending =
    proposals.data?.filter(
      (proposal) =>
        proposal.status === "pending" ||
        proposal.changes.some((change) => change.decision === "pending"),
    ) ?? [];
  const visible = filter === "pending" ? pending : (proposals.data ?? []);
  return (
    <>
      <PageTitle
        eyebrow="03 / REVIEW & INTEGRATE"
        title="The review desk"
        description="New ideas deserve a considered place. Read the changes, make them yours, then decide what belongs."
      />
      <div className="kb-principle">
        <GitPullRequest size={21} strokeWidth={1.4} />
        <p>
          <strong>Your knowledge. Your final word.</strong> Proposals stay
          separate from your vault until you accept them.
        </p>
      </div>
      <div className="kb-list-toolbar">
        <div className="kb-tabs" role="group" aria-label="Filter proposals">
          <button
            className={filter === "pending" ? "is-active" : ""}
            aria-pressed={filter === "pending"}
            onClick={() => setFilter("pending")}
          >
            Awaiting review<span>{pending.length}</span>
          </button>
          <button
            className={filter === "all" ? "is-active" : ""}
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            All proposals<span>{proposals.data?.length ?? 0}</span>
          </button>
        </div>
        <button
          className="kb-icon-button"
          aria-label="Refresh proposals"
          onClick={proposals.reload}
        >
          <RefreshCw size={16} />
        </button>
      </div>
      <LoadState {...proposals} retry={proposals.reload} />
      {!proposals.loading &&
        !proposals.error &&
        (visible.length ? (
          visible.map((proposal) => (
            <ProposalReview
              key={`${proposal.id}-${proposal.status}-${proposal.changes.map((change) => change.decision).join("-")}`}
              proposal={proposal}
              onReviewed={proposals.reload}
            />
          ))
        ) : (
          <Empty
            icon={<GitPullRequest size={30} strokeWidth={1.2} />}
            title="Nothing waiting for your red pen."
          >
            <p>
              Keep a source, write a reflection, and propose connections to
              start a review.
            </p>
            <Link className="kb-text-link" href="/kb">
              Visit your inbox <ArrowRight size={14} />
            </Link>
          </Empty>
        ))}
    </>
  );
}

export function ProposalReview({
  proposal,
  onReviewed,
}: {
  proposal: SynthesisProposal;
  onReviewed: () => void;
}) {
  const action = useAction();
  const [choices, setChoices] = useState<Record<string, Choice>>(() =>
    Object.fromEntries(
      proposal.changes
        .filter((change) => change.decision === "pending")
        .map((change) => [
          change.id,
          { action: "pending", markdown: change.after },
        ]),
    ),
  );
  const selected = Object.entries(choices).filter(
    ([, choice]) => choice.action !== "pending",
  );
  const accepted = selected.filter(
    ([, choice]) => choice.action === "accept",
  ).length;
  const pending = proposal.changes.filter(
    (change) => change.decision === "pending",
  );
  function update(id: string, next: Partial<Choice>) {
    setChoices((previous) => ({
      ...previous,
      [id]: { ...previous[id], ...next },
    }));
  }
  return (
    <article className="kb-proposal">
      <header className="kb-proposal-header">
        <div>
          <span className="kb-eyebrow">
            PROPOSAL · {date(proposal.createdAt)}
          </span>
          <h2>{proposal.summary}</h2>
          <p>{proposal.whyItMatters}</p>
          <div className="kb-item-meta">
            <Link href={sourceHref(proposal.sourceId)}>
              Return to source <ArrowRight size={12} />
            </Link>
            <span>·</span>
            <span>{proposal.model}</span>
          </div>
        </div>
        <Badge value={proposal.status} />
      </header>
      <Feedback {...action} />
      {pending.length > 0 && (
        <div className="kb-bulk-decisions">
          <span className="kb-help">
            Set all pending decisions, then apply below.
          </span>
          <button
            className="kb-button kb-small"
            disabled={action.busy}
            onClick={() =>
              setChoices((previous) =>
                Object.fromEntries(
                  Object.entries(previous).map(([id, choice]) => [
                    id,
                    { ...choice, action: "accept" as const },
                  ]),
                ),
              )
            }
          >
            <CheckCheck size={14} />
            Accept all
          </button>
          <button
            className="kb-button kb-small"
            disabled={action.busy}
            onClick={() =>
              setChoices((previous) =>
                Object.fromEntries(
                  Object.entries(previous).map(([id, choice]) => [
                    id,
                    { ...choice, action: "reject" as const },
                  ]),
                ),
              )
            }
          >
            <X size={14} />
            Reject all
          </button>
        </div>
      )}
      {proposal.outcome === "no_change" ? (
        <div className="kb-no-change">
          <CheckCheck size={25} />
          <div>
            <h3>No durable change needed.</h3>
            <p>This source can be useful without adding another note.</p>
          </div>
          {proposal.status === "pending" && (
            <button
              className="kb-button"
              disabled={action.busy}
              onClick={() =>
                void action.run(async () => {
                  await api(
                    `proposals/${encodeURIComponent(proposal.id)}/review`,
                    "POST",
                    { decisions: [], acceptNoChange: true },
                  );
                  onReviewed();
                }, "Review recorded. No knowledge files changed.")
              }
            >
              Acknowledge review
            </button>
          )}
          {proposal.status === "pending" && (
            <button
              className="kb-button"
              disabled={action.busy}
              onClick={() =>
                void action.run(async () => {
                  await api(
                    `proposals/${encodeURIComponent(proposal.id)}/review`,
                    "POST",
                    { decisions: [], rejectNoChange: true },
                  );
                  onReviewed();
                }, "Proposal rejected. No knowledge files changed.")
              }
            >
              Reject proposal
            </button>
          )}
        </div>
      ) : (
        <>
          {proposal.changes.map((change, index) => (
            <ChangeReview
              key={change.id}
              change={change}
              index={index}
              choice={choices[change.id]}
              disabled={action.busy}
              update={(next) => update(change.id, next)}
            />
          ))}
          {pending.length > 0 && (
            <div className="kb-review-footer">
              <div>
                <strong>
                  {selected.length} of {pending.length} pending changes decided
                </strong>
                <p>
                  {accepted} to accept · {selected.length - accepted} to reject
                  · {pending.length - selected.length} left for later
                </p>
              </div>
              <button
                className="kb-button kb-primary"
                disabled={action.busy || selected.length === 0}
                onClick={() =>
                  void action.run(async () => {
                    const decisions = selected.map(([changeId, choice]) => ({
                      changeId,
                      action: choice.action,
                      ...(choice.action === "accept"
                        ? { markdown: choice.markdown }
                        : {}),
                    }));
                    await api(
                      `proposals/${encodeURIComponent(proposal.id)}/review`,
                      "POST",
                      { decisions },
                    );
                    onReviewed();
                  }, "Review applied. Accepted changes are now in your vault.")
                }
              >
                {action.busy ? "Applying…" : "Apply selected decisions"}
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
      {proposal.questions.length > 0 && (
        <div className="kb-open-questions">
          <span className="kb-eyebrow">QUESTIONS TO CARRY FORWARD</span>
          <ul>
            {proposal.questions.map((question, index) => (
              <li key={index}>{question}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function ChangeReview({
  change,
  index,
  choice,
  update,
  disabled,
}: {
  change: ProposedChange;
  index: number;
  choice?: Choice;
  update: (next: Partial<Choice>) => void;
  disabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const markdown = choice?.markdown ?? change.after;
  const lines = useMemo(
    () => markdownDiff(change.before, markdown),
    [change.before, markdown],
  );
  return (
    <section
      className="kb-change"
      aria-label={`Change ${index + 1}: ${change.title}`}
    >
      <div className="kb-change-heading">
        <div>
          <span className="kb-eyebrow">
            {String(index + 1).padStart(2, "0")} /{" "}
            {change.operation === "create_note" ? "NEW NOTE" : "NOTE UPDATE"}
          </span>
          <h3>{change.title}</h3>
        </div>
        {choice ? (
          <button
            className="kb-button kb-small"
            aria-expanded={editing}
            onClick={() => setEditing(!editing)}
          >
            <Pencil size={14} />
            {editing ? "Show diff" : "Edit Markdown"}
          </button>
        ) : (
          <Badge value={change.decision} />
        )}
      </div>
      <p className="kb-change-rationale">{change.rationale}</p>
      {editing && choice ? (
        <div className="kb-edit-comparison">
          <div>
            <label>Current Markdown</label>
            <pre>{change.before || "This is a new note."}</pre>
          </div>
          <div>
            <label htmlFor={`change-${change.id}`}>
              Proposed Markdown · editable
            </label>
            <textarea
              id={`change-${change.id}`}
              className="kb-code-input"
              value={markdown}
              onChange={(event) => update({ markdown: event.target.value })}
              rows={Math.min(24, Math.max(8, markdown.split("\n").length + 2))}
              disabled={disabled}
            />
            <p className="kb-help">
              Preserve the source references when editing. Your exact text is
              submitted on acceptance.
            </p>
          </div>
        </div>
      ) : (
        <div
          className="kb-diff"
          aria-label={`Markdown diff for ${change.title}`}
        >
          <div className="kb-diff-legend">
            <span>− Removed</span>
            <span>+ Added</span>
            {markdown !== change.after && <span>Includes your edits</span>}
          </div>
          <pre>
            {lines.map((line, lineIndex) => (
              <span className={`kb-diff-${line.kind}`} key={lineIndex}>
                <span aria-hidden="true">
                  {line.kind === "added"
                    ? "+"
                    : line.kind === "removed"
                      ? "−"
                      : " "}
                </span>
                {line.text || " "}
                {"\n"}
              </span>
            ))}
          </pre>
        </div>
      )}
      <div className="kb-evidence">
        <span className="kb-eyebrow">SOURCE EVIDENCE</span>
        {change.evidence.length ? (
          change.evidence.map((evidence, evidenceIndex) => (
            <div key={evidenceIndex}>
              <Link href={sourceHref(evidence.sourceId, evidence.start)}>
                {evidence.sourceId}
                {evidence.start !== undefined
                  ? ` · ${stamp(evidence.start)}${evidence.end !== undefined ? `–${stamp(evidence.end)}` : ""}`
                  : ""}
                <ArrowRight size={12} />
              </Link>
              {evidence.quote && <blockquote>{evidence.quote}</blockquote>}
            </div>
          ))
        ) : (
          <p className="kb-help">
            No source reference supplied. Review carefully before accepting.
          </p>
        )}
      </div>
      {choice && (
        <fieldset className="kb-change-decisions">
          <legend>Decision for {change.title}</legend>
          {(
            [
              { value: "accept", text: "Accept change", icon: Check },
              { value: "reject", text: "Reject change", icon: X },
              { value: "pending", text: "Decide later", icon: null },
            ] as const
          ).map(({ value, text, icon: Icon }) => (
            <label
              className={
                choice.action === value ? `is-selected kb-choice-${value}` : ""
              }
              key={value}
            >
              <input
                type="radio"
                name={`decision-${change.id}`}
                value={value}
                checked={choice.action === value}
                onChange={() => update({ action: value })}
                disabled={disabled}
              />
              {Icon && <Icon size={14} />}
              {text}
            </label>
          ))}
        </fieldset>
      )}
    </section>
  );
}
