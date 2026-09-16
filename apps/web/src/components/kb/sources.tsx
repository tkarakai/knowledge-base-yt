"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Clock3,
  FileText,
  Inbox,
  Plus,
  RefreshCw,
  Sparkles,
  X,
  Youtube,
} from "lucide-react";
import type {
  Source,
  SourceDetail,
  Reflection,
  SelectedPassage,
  SynthesisProposal,
} from "@repo/kb-shared";
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
  noteHref,
  documentHref,
  ExternalLink,
  BackLink,
} from "./common";

const blankReflection = {
  why: "",
  reaction: "",
  questions: "",
  selectedPassages: [] as SelectedPassage[],
};

export function InboxView() {
  const sources = useResource<Source[]>("sources");
  const action = useAction();
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [filter, setFilter] = useState("inbox");
  const counts = {
    inbox:
      sources.data?.filter((source) => source.status === "ready_for_reflection")
        .length ?? 0,
    later:
      sources.data?.filter((source) => source.status === "deferred").length ??
      0,
    all: sources.data?.length ?? 0,
  };
  const visible =
    sources.data?.filter(
      (source) =>
        filter === "all" ||
        (filter === "later"
          ? source.status === "deferred"
          : source.status === "ready_for_reflection"),
    ) ?? [];
  async function decide(source: Source, decision: Reflection["decision"]) {
    await action.run(
      async () => {
        const current = await api<SourceDetail>(
          `sources/${encodeURIComponent(source.id)}`,
        );
        await api(
          `sources/${encodeURIComponent(source.id)}/reflection`,
          "PUT",
          { ...(current.reflection ?? blankReflection), decision },
        );
        if (decision === "keep") router.push(sourceHref(source.id));
        else sources.reload();
      },
      decision === "ignore"
        ? "Source ignored. You can find it in All sources."
        : decision === "later"
          ? "Saved for later."
          : undefined,
    );
  }
  return (
    <>
      <PageTitle
        eyebrow="01 / COLLECT & CONSIDER"
        title="The reflection inbox"
        description="Not everything you encounter needs to become knowledge. Start with what stayed with you."
      />
      <form
        className="kb-capture"
        onSubmit={(event) => {
          event.preventDefault();
          void action.run(async () => {
            const result = await api<SourceDetail>("sources", "POST", { url });
            setUrl("");
            router.push(sourceHref(result.source.id));
          });
        }}
      >
        <label htmlFor="kb-url">
          <span className="kb-eyebrow">A NEW THREAD</span>
          <span>What have you been watching?</span>
        </label>
        <div className="kb-capture-input">
          <Youtube size={21} />
          <input
            id="kb-url"
            type="url"
            required
            placeholder="Paste a YouTube URL…"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
          <button
            className="kb-button kb-primary"
            disabled={action.busy || !url.trim()}
          >
            <Plus size={16} />
            {action.busy ? "Working…" : "Add to inbox"}
          </button>
        </div>
        <p>Capture the source. Keep the context. Decide what matters.</p>
      </form>
      <Feedback {...action} />
      <div className="kb-list-toolbar">
        <div className="kb-tabs" role="group" aria-label="Filter sources">
          {(
            [
              ["inbox", "To reflect on"],
              ["later", "For later"],
              ["all", "All sources"],
            ] as const
          ).map(([key, title]) => (
            <button
              key={key}
              aria-pressed={filter === key}
              className={filter === key ? "is-active" : ""}
              onClick={() => setFilter(key)}
            >
              {title}
              <span>{counts[key]}</span>
            </button>
          ))}
        </div>
        <button
          className="kb-icon-button"
          aria-label="Refresh sources"
          onClick={sources.reload}
        >
          <RefreshCw size={16} />
        </button>
      </div>
      <LoadState {...sources} retry={sources.reload} />
      {!sources.loading &&
        !sources.error &&
        (visible.length ? (
          <div className="kb-source-list">
            {visible.map((source, index) => (
              <article className="kb-source-row" key={source.id}>
                <span className="kb-row-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="kb-source-symbol">
                  <Youtube size={25} strokeWidth={1.25} />
                </div>
                <div className="kb-source-summary">
                  <div className="kb-item-meta">
                    <span>{source.channel || "YouTube source"}</span>
                    <span>·</span>
                    <span>{date(source.lastSeenAt)}</span>
                  </div>
                  <h2>
                    <Link href={sourceHref(source.id)}>{source.title}</Link>
                  </h2>
                  <div className="kb-source-status">
                    <Badge value={source.status} />
                    <span>
                      {source.transcriptStatus === "available" ||
                      source.transcriptStatus === "partial"
                        ? "Timestamped transcript"
                        : "Transcript needs attention"}
                    </span>
                  </div>
                </div>
                <div className="kb-row-actions">
                  <button
                    className="kb-button kb-small kb-keep"
                    onClick={() => void decide(source, "keep")}
                    disabled={action.busy}
                  >
                    <Check size={15} />
                    Keep
                  </button>
                  <button
                    className="kb-icon-button"
                    aria-label={`Save ${source.title} for later`}
                    title="For later"
                    onClick={() => void decide(source, "later")}
                    disabled={action.busy}
                  >
                    <Clock3 size={17} />
                  </button>
                  <button
                    className="kb-icon-button"
                    aria-label={`Ignore ${source.title}`}
                    title="Ignore"
                    onClick={() => void decide(source, "ignore")}
                    disabled={action.busy}
                  >
                    <X size={17} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty
            icon={<Inbox size={30} strokeWidth={1.2} />}
            title={
              filter === "later"
                ? "A little space for later."
                : filter === "all"
                  ? "Your commonplace starts here."
                  : "A clear desk. An open mind."
            }
          >
            <p>
              {filter === "later"
                ? "Sources you set aside will be waiting here when you’re ready."
                : "Add a video above, then tell your future self why it mattered."}
            </p>
            <span className="kb-empty-footnote">
              Encounter → reflect → understand
            </span>
          </Empty>
        ))}
      <div className="kb-editorial-note">
        <span>ON KEEPING</span>
        <p>
          “The value is not in how much you save.
          <br />
          It’s in what you make of it.”
        </p>
        <span className="kb-editorial-rule" />
      </div>
    </>
  );
}

export function SourceView({ id }: { id: string }) {
  const detail = useResource<SourceDetail>(`sources/${encodeURIComponent(id)}`);
  return (
    <>
      <BackLink href="/kb">Back to inbox</BackLink>
      <LoadState {...detail} retry={detail.reload} />
      {detail.data && !detail.error && (
        <SourceContent
          key={`${id}-${detail.data.reflection?.updatedAt ?? "new"}`}
          detail={detail.data}
          reload={detail.reload}
        />
      )}
    </>
  );
}

function SourceContent({
  detail,
  reload,
}: {
  detail: SourceDetail;
  reload: () => void;
}) {
  const { source, transcript, reflection } = detail;
  const [decision, setDecision] = useState<Reflection["decision"]>(
    reflection?.decision ?? "keep",
  );
  const [why, setWhy] = useState(reflection?.why ?? "");
  const [reaction, setReaction] = useState(reflection?.reaction ?? "");
  const [questions, setQuestions] = useState(reflection?.questions ?? "");
  const [selected, setSelected] = useState<SelectedPassage[]>(
    reflection?.selectedPassages ?? [],
  );
  const [importText, setImportText] = useState("");
  const [language, setLanguage] = useState("en");
  const [importOpen, setImportOpen] = useState(false);
  const [tab, setTab] = useState("transcript");
  const action = useAction();
  const router = useRouter();
  const path = `sources/${encodeURIComponent(source.id)}`;
  const currentReflection = {
    decision,
    why,
    reaction,
    questions,
    selectedPassages: selected,
  };
  const dirty =
    decision !== (reflection?.decision ?? "keep") ||
    why !== (reflection?.why ?? "") ||
    reaction !== (reflection?.reaction ?? "") ||
    questions !== (reflection?.questions ?? "") ||
    JSON.stringify(selected) !==
      JSON.stringify(reflection?.selectedPassages ?? []);
  const canSynthesize =
    reflection?.decision === "keep" && !!reflection.why.trim() && !dirty;

  function togglePassage(passage: SelectedPassage) {
    setSelected((previous) =>
      previous.some(
        (item) => item.start === passage.start && item.end === passage.end,
      )
        ? previous.filter(
            (item) => item.start !== passage.start || item.end !== passage.end,
          )
        : [...previous, passage].sort((a, b) => a.start - b.start),
    );
  }
  return (
    <>
      <PageTitle
        eyebrow="SOURCE / YOUTUBE"
        title={source.title}
        description={source.channel || "YouTube source"}
      >
        <ExternalLink href={source.url}>Open original</ExternalLink>
      </PageTitle>
      <div className="kb-source-facts">
        <Badge value={source.status} />
        <span>First encountered {date(source.firstSeenAt)}</span>
        <span>
          {source.encounters.length}{" "}
          {source.encounters.length === 1 ? "encounter" : "encounters"}
        </span>
        {source.publishedAt && (
          <span>Published {date(source.publishedAt)}</span>
        )}
      </div>
      <Feedback {...action} />
      <div className="kb-reading-layout">
        <section className="kb-transcript-panel">
          <div className="kb-section-heading">
            <div className="kb-tabs" role="group" aria-label="Source content">
              <button
                className={tab === "transcript" ? "is-active" : ""}
                aria-pressed={tab === "transcript"}
                onClick={() => setTab("transcript")}
              >
                Transcript
              </button>
              <button
                className={tab === "related" ? "is-active" : ""}
                aria-pressed={tab === "related"}
                onClick={() => setTab("related")}
              >
                Related knowledge<span>{detail.related.length}</span>
              </button>
            </div>
            <Badge value={transcript?.status ?? source.transcriptStatus} />
          </div>
          {tab === "transcript" ? (
            <>
              <p className="kb-help">
                Select the passages that mattered. Timestamps open the original
                moment.
              </p>
              {transcript?.error && (
                <div className="kb-notice">{transcript.error}</div>
              )}
              {transcript?.segments.length ? (
                <div className="kb-transcript">
                  {transcript.segments.map((segment, index) => (
                    <div
                      id={`t-${segment.start}`}
                      className={`kb-segment ${selected.some((item) => item.start === segment.start && item.end === segment.end) ? "is-selected" : ""}`}
                      key={`${segment.start}-${index}`}
                    >
                      <input
                        type="checkbox"
                        aria-label={`Select passage at ${stamp(segment.start)}`}
                        checked={selected.some(
                          (item) =>
                            item.start === segment.start &&
                            item.end === segment.end,
                        )}
                        onChange={() => togglePassage(segment)}
                      />
                      <ExternalLink
                        href={`${source.url}${source.url.includes("?") ? "&" : "?"}t=${Math.floor(segment.start)}`}
                      >
                        {stamp(segment.start)}
                      </ExternalLink>
                      <p>{segment.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  icon={<FileText size={26} />}
                  title="The transcript is still missing."
                >
                  <p>
                    Captions aren’t always available. Import a timestamped
                    transcript to continue with your own copy.
                  </p>
                </Empty>
              )}
              <div className="kb-transcript-tools">
                <button
                  className="kb-button kb-small"
                  disabled={action.busy}
                  onClick={() =>
                    void action.run(async () => {
                      await api(`${path}/transcript/retry`, "POST", {});
                      reload();
                    }, "Transcript acquisition finished. Check its status above.")
                  }
                >
                  <RefreshCw size={14} />
                  Retry captions
                </button>
                <button
                  className="kb-button kb-small"
                  aria-expanded={importOpen}
                  onClick={() => setImportOpen(!importOpen)}
                >
                  <FileText size={14} />
                  Import transcript
                </button>
                {transcript && (
                  <span className="kb-help">
                    {transcript.provider} · {transcript.language}
                  </span>
                )}
              </div>
              {importOpen && (
                <form
                  className="kb-import-panel"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void action.run(async () => {
                      await api(`${path}/transcript`, "PUT", {
                        text: importText,
                        language,
                      });
                      setImportText("");
                      setImportOpen(false);
                      reload();
                    }, "Transcript imported.");
                  }}
                >
                  <h3>Bring your own transcript</h3>
                  <label htmlFor="kb-transcript-file">
                    Upload a VTT, SRT, or text file
                  </label>
                  <input
                    id="kb-transcript-file"
                    type="file"
                    accept=".vtt,.srt,.txt"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file)
                        void action.run(async () => {
                          if (file.size > 1_800_000)
                            throw new Error(
                              "Choose a transcript smaller than 1.8 MB.",
                            );
                          setImportText(await file.text());
                        });
                    }}
                  />
                  <label htmlFor="kb-transcript-text">
                    Timestamped transcript
                  </label>
                  <textarea
                    id="kb-transcript-text"
                    required
                    rows={9}
                    className="kb-code-input"
                    placeholder={
                      "00:00 Opening thought\n00:24 The part worth remembering…"
                    }
                    value={importText}
                    onChange={(event) => setImportText(event.target.value)}
                  />
                  <label htmlFor="kb-transcript-language">Language code</label>
                  <input
                    id="kb-transcript-language"
                    value={language}
                    maxLength={20}
                    onChange={(event) => setLanguage(event.target.value)}
                  />
                  <p className="kb-help">
                    Accepts WebVTT, SRT, and timestamped lines. Importing
                    replaces the source transcript.
                  </p>
                  <button
                    className="kb-button kb-primary"
                    disabled={action.busy || !importText.trim()}
                  >
                    Import transcript
                  </button>
                </form>
              )}
            </>
          ) : (
            <div className="kb-related">
              {detail.related.length ? (
                detail.related.map((item) => (
                  <article key={item.chunkId}>
                    <span className="kb-eyebrow">{item.type}</span>
                    <h3>
                      <Link
                        href={
                          item.type === "document"
                            ? documentHref(item.id)
                            : item.sourceId
                              ? sourceHref(item.sourceId, item.start)
                              : noteHref(item.id)
                        }
                      >
                        {item.title}
                      </Link>
                    </h3>
                    <p>{item.excerpt}</p>
                    {item.start !== undefined && (
                      <span className="kb-help">
                        {stamp(item.start)}
                        {item.end !== undefined && `–${stamp(item.end)}`}
                      </span>
                    )}
                  </article>
                ))
              ) : (
                <Empty icon={<BookIcon />} title="Connections will grow.">
                  <p>As your vault fills, related ideas will appear here.</p>
                </Empty>
              )}
            </div>
          )}
        </section>
        <aside className="kb-reflection-panel">
          <span className="kb-eyebrow">YOUR SIDE OF THE STORY</span>
          <h2>Why did this matter?</h2>
          <p className="kb-help">
            A source says one thing. Your reflection gives it a place in your
            thinking.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void action.run(async () => {
                await api(`${path}/reflection`, "PUT", currentReflection);
                reload();
              }, "Reflection saved.");
            }}
          >
            <fieldset className="kb-decision">
              <legend>What would you like to do with this source?</legend>
              {(
                [
                  { value: "keep", text: "Keep", icon: Check },
                  { value: "later", text: "Later", icon: Clock3 },
                  { value: "ignore", text: "Ignore", icon: X },
                ] as const
              ).map(({ value, text, icon: Icon }) => (
                <label
                  key={value}
                  className={decision === value ? "is-selected" : ""}
                >
                  <input
                    type="radio"
                    name="decision"
                    value={value}
                    checked={decision === value}
                    onChange={() => setDecision(value)}
                  />
                  <Icon size={15} />
                  {text}
                </label>
              ))}
            </fieldset>
            <label htmlFor="kb-why">Why is it worth keeping?</label>
            <textarea
              id="kb-why"
              value={why}
              onChange={(event) => setWhy(event.target.value)}
              rows={5}
              placeholder="What clicked, challenged you, or deserves another look?"
            />
            <label htmlFor="kb-reaction">
              Your reaction <span>optional</span>
            </label>
            <textarea
              id="kb-reaction"
              value={reaction}
              onChange={(event) => setReaction(event.target.value)}
              rows={3}
              placeholder="Surprised, convinced, uncertain…"
            />
            <label htmlFor="kb-questions">
              Questions to carry forward <span>optional</span>
            </label>
            <textarea
              id="kb-questions"
              value={questions}
              onChange={(event) => setQuestions(event.target.value)}
              rows={3}
              placeholder="What would you like to understand next?"
            />
            <div className="kb-selection-summary">
              <span>
                {selected.length}{" "}
                {selected.length === 1 ? "passage" : "passages"} selected
              </span>
              {selected.length > 0 && (
                <button
                  className="kb-text-button"
                  type="button"
                  onClick={() => setSelected([])}
                >
                  Clear
                </button>
              )}
            </div>
            {selected.length > 0 && (
              <div className="kb-passage-chips">
                {selected.map((passage) => (
                  <button
                    key={`${passage.start}-${passage.end}`}
                    type="button"
                    onClick={() => togglePassage(passage)}
                    aria-label={`Remove passage ${stamp(passage.start)} to ${stamp(passage.end)}`}
                  >
                    {stamp(passage.start)}–{stamp(passage.end)}
                    <X size={11} />
                  </button>
                ))}
              </div>
            )}
            <button
              className="kb-button kb-primary kb-full"
              disabled={action.busy}
            >
              {action.busy ? "Saving…" : "Save reflection"}
              <Check size={15} />
            </button>
            {dirty && (
              <p className="kb-help" role="status">
                You have unsaved reflection changes.
              </p>
            )}
          </form>
          <div className="kb-synthesis">
            <span className="kb-eyebrow">THE NEXT CONNECTION</span>
            <h3>Bring it into your knowledge.</h3>
            <p>
              Compare this source with your vault and review the proposed
              changes.
            </p>
            <button
              className="kb-button kb-full"
              disabled={action.busy || !canSynthesize}
              onClick={() =>
                void action.run(async () => {
                  await api<SynthesisProposal>(
                    `${path}/synthesize`,
                    "POST",
                    {},
                  );
                  router.push("/kb/proposals");
                })
              }
            >
              <Sparkles size={16} />
              {action.busy ? "Working…" : "Propose connections"}
              <ArrowRight size={15} />
            </button>
            {!canSynthesize && (
              <p className="kb-help">
                Save a Keep reflection with your reason before requesting a
                proposal.
              </p>
            )}
            <p className="kb-help">
              Your review comes before any knowledge changes.
            </p>
          </div>
          {detail.proposals.length > 0 && (
            <Link className="kb-text-link" href="/kb/proposals">
              View {detail.proposals.length} source{" "}
              {detail.proposals.length === 1 ? "proposal" : "proposals"}{" "}
              <ArrowRight size={14} />
            </Link>
          )}
        </aside>
      </div>
    </>
  );
}
function BookIcon() {
  return <FileText size={26} />;
}
