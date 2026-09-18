"use client";

import { useEffect, useState } from "react";
import Link from "./navigation";
import {
  ArrowRight,
  BookOpen,
  Check,
  FileText,
  History,
  Search,
  Upload,
} from "lucide-react";
import type {
  DocumentDetail,
  KnowledgeNote,
  SearchResult,
  TimelineEvent,
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
  noteHref,
  sourceHref,
  documentHref,
  BackLink,
  Markdown,
} from "./common";

export function KnowledgeView({
  initialImportOpen = false,
}: { initialImportOpen?: boolean } = {}) {
  const notes = useResource<KnowledgeNote[]>("knowledge");
  const action = useAction();
  const [filter, setFilter] = useState("");
  const [importOpen, setImportOpen] = useState(initialImportOpen);
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [filename, setFilename] = useState("");
  const visible =
    notes.data?.filter((note) =>
      `${note.title} ${note.tags.join(" ")}`
        .toLowerCase()
        .includes(filter.toLowerCase()),
    ) ?? [];
  return (
    <>
      <PageTitle
        eyebrow="02 / A GROWING UNDERSTANDING"
        title="Your knowledge, in writing"
        description="Ideas you have made your own. Plain Markdown, with a thread back to where they began."
      >
        <button
          className="kb-button"
          aria-expanded={importOpen}
          onClick={() => setImportOpen(!importOpen)}
        >
          <Upload size={16} />
          Import Markdown
        </button>
      </PageTitle>
      <Feedback {...action} />
      {importOpen && (
        <form
          className="kb-import-panel"
          onSubmit={(event) => {
            event.preventDefault();
            void action.run(async () => {
              await api("documents", "POST", {
                title,
                markdown,
                ...(filename ? { filename } : {}),
              });
              setTitle("");
              setMarkdown("");
              setFilename("");
              setImportOpen(false);
              notes.reload();
            }, "Document imported and available in search. Imported sources remain separate from accepted knowledge.");
          }}
        >
          <div className="kb-section-heading">
            <h2>Bring a document into the conversation.</h2>
            <FileText size={23} />
          </div>
          <p className="kb-help">
            Markdown imports become source documents in your vault and can be
            retrieved in search.
          </p>
          <label htmlFor="kb-document-file">Choose a Markdown file</label>
          <input
            id="kb-document-file"
            type="file"
            accept=".md,.markdown,text/markdown,text/plain"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file)
                void action.run(async () => {
                  if (file.size > 1_800_000)
                    throw new Error("Choose a document smaller than 1.8 MB.");
                  setMarkdown(await file.text());
                  setFilename(file.name);
                  if (!title)
                    setTitle(file.name.replace(/\.(md|markdown)$/i, ""));
                });
            }}
          />
          <label htmlFor="kb-document-title">Document title</label>
          <input
            id="kb-document-title"
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <label htmlFor="kb-document-content">Markdown content</label>
          <textarea
            id="kb-document-content"
            required
            className="kb-code-input"
            rows={12}
            value={markdown}
            onChange={(event) => setMarkdown(event.target.value)}
            placeholder="# A thought worth keeping"
          />
          <div className="kb-form-actions">
            <button
              type="button"
              className="kb-button"
              onClick={() => setImportOpen(false)}
            >
              Cancel
            </button>
            <button
              className="kb-button kb-primary"
              disabled={action.busy || !title.trim() || !markdown.trim()}
            >
              Import document
              <ArrowRight size={15} />
            </button>
          </div>
        </form>
      )}
      <div className="kb-list-toolbar">
        <span className="kb-eyebrow">
          {notes.data?.length ?? 0} KNOWLEDGE NOTES
        </span>
        <div className="kb-filter-input">
          <Search size={15} />
          <input
            aria-label="Filter knowledge notes"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Find a note…"
          />
        </div>
      </div>
      <LoadState {...notes} retry={notes.reload} />
      {!notes.loading &&
        !notes.error &&
        (visible.length ? (
          <div className="kb-note-grid">
            {visible.map((note) => (
              <Link
                className="kb-note-card"
                href={noteHref(note.id)}
                key={note.id}
              >
                <div className="kb-note-card-top">
                  <BookOpen size={21} strokeWidth={1.3} />
                  <span>{date(note.updatedAt)}</span>
                </div>
                <h2>{note.title}</h2>
                <p>
                  {note.markdown.replace(/[#*`>[\]]/g, "").slice(0, 210)}
                  {note.markdown.length > 210 ? "…" : ""}
                </p>
                <div className="kb-note-card-bottom">
                  <span>
                    {note.tags.length
                      ? note.tags.slice(0, 3).join(" · ")
                      : "Knowledge note"}
                  </span>
                  <ArrowRight size={18} />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <Empty
            icon={<BookOpen size={30} strokeWidth={1.2} />}
            title={
              filter
                ? "No notes on that thread yet."
                : "A place for ideas to take root."
            }
          >
            <p>
              {filter
                ? "Try another title or tag."
                : "Accepted proposals become knowledge notes here. You can also import existing Markdown to make it searchable."}
            </p>
            <Link href="/kb/proposals" className="kb-text-link">
              Open the review desk
              <ArrowRight size={14} />
            </Link>
          </Empty>
        ))}
    </>
  );
}

export function NoteView({ id }: { id: string }) {
  const note = useResource<KnowledgeNote>(
    `knowledge/${encodeURIComponent(id)}`,
  );
  return (
    <>
      <BackLink href="/kb/knowledge">All knowledge</BackLink>
      <LoadState {...note} retry={note.reload} />
      {note.data && !note.error && <NoteEditor note={note.data} />}
    </>
  );
}

export function DocumentView({ id }: { id: string }) {
  const document = useResource<DocumentDetail>(
    `documents/${encodeURIComponent(id)}`,
  );
  return (
    <>
      <BackLink href="/kb/search">Back to search</BackLink>
      <LoadState {...document} retry={document.reload} />
      {document.data && !document.error && (
        <>
          <PageTitle
            eyebrow="IMPORTED DOCUMENT / MARKDOWN"
            title={document.data.title}
            description="An original source document, preserved separately from your knowledge notes."
          />
          <div className="kb-note-toolbar">
            <Badge value="document" />
            <span className="kb-help">{document.data.path}</span>
          </div>
          <article className="kb-reading-note">
            <Markdown text={document.data.markdown} />
          </article>
        </>
      )}
    </>
  );
}

export function NoteEditor({ note }: { note: KnowledgeNote }) {
  const [markdown, setMarkdown] = useState(note.markdown);
  const [title, setTitle] = useState(note.title);
  const [saved, setSaved] = useState({
    markdown: note.markdown,
    title: note.title,
  });
  const [view, setView] = useState("read");
  const action = useAction();
  const dirty = markdown !== saved.markdown || title !== saved.title;
  return (
    <>
      <PageTitle
        eyebrow="KNOWLEDGE / MARKDOWN"
        title={title}
        description={`Created ${date(note.createdAt)} · Updated ${date(note.updatedAt)}`}
      />
      <div className="kb-note-toolbar">
        <div className="kb-tabs" role="group" aria-label="Note view">
          <button
            onClick={() => setView("read")}
            className={view === "read" ? "is-active" : ""}
            aria-pressed={view === "read"}
          >
            Reading view
          </button>
          <button
            onClick={() => setView("edit")}
            className={view === "edit" ? "is-active" : ""}
            aria-pressed={view === "edit"}
          >
            Edit Markdown
          </button>
        </div>
        <span className="kb-help">{note.path}</span>
      </div>
      <Feedback {...action} />
      {view === "read" ? (
        <article className="kb-reading-note">
          <Markdown text={markdown} />
        </article>
      ) : (
        <form
          className="kb-note-editor"
          onSubmit={(event) => {
            event.preventDefault();
            void action.run(async () => {
              const updated = await api<KnowledgeNote>(
                `knowledge/${encodeURIComponent(note.id)}`,
                "PUT",
                { markdown, title },
              );
              setSaved({ markdown: updated.markdown, title: updated.title });
              setMarkdown(updated.markdown);
              setTitle(updated.title);
            }, "Note saved to your Markdown vault.");
          }}
        >
          <label htmlFor="kb-note-title">Note title</label>
          <input
            id="kb-note-title"
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <label htmlFor="kb-note-markdown">Markdown</label>
          <textarea
            id="kb-note-markdown"
            className="kb-code-input"
            rows={24}
            value={markdown}
            onChange={(event) => setMarkdown(event.target.value)}
          />
          <div className="kb-form-actions">
            <span className="kb-help">
              {dirty
                ? "Unsaved changes. Saving writes directly to your note."
                : "All changes saved."}
            </span>
            <button
              type="button"
              className="kb-button"
              disabled={!dirty || action.busy}
              onClick={() => {
                setMarkdown(saved.markdown);
                setTitle(saved.title);
              }}
            >
              Discard edits
            </button>
            <button
              className="kb-button kb-primary"
              disabled={!dirty || action.busy || !title.trim()}
            >
              <Check size={15} />
              {action.busy ? "Saving…" : "Save note"}
            </button>
          </div>
        </form>
      )}
    </>
  );
}

export function SearchView() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [revision, setRevision] = useState(0);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState("");
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (!submitted) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setMode("");
    setReason("");
    api<SearchResult[]>(
      `search?q=${encodeURIComponent(submitted)}`,
      "GET",
      undefined,
      controller.signal,
      (response) => {
        if (!controller.signal.aborted) {
          setMode(response.headers.get("X-KB-Retrieval-Mode") ?? "");
          setReason(response.headers.get("X-KB-Retrieval-Reason") ?? "");
        }
      },
    )
      .then((data) => {
        if (!controller.signal.aborted) setResults(data);
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted)
          setError(
            failure instanceof Error ? failure.message : "Search failed.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [submitted, revision]);
  return (
    <>
      <PageTitle
        eyebrow="04 / FOLLOW A THREAD"
        title="Find what you almost remember"
        description="Search your sources, reflections, and knowledge together. Follow an idea back to its exact moment."
      />
      <form
        className="kb-search-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (query.trim()) {
            setSubmitted(query.trim());
            setRevision((value) => value + 1);
          }
        }}
      >
        <Search size={22} strokeWidth={1.4} />
        <label htmlFor="kb-search" className="kb-sr-only">
          Search your knowledge
        </label>
        <input
          id="kb-search"
          type="search"
          value={query}
          required
          onChange={(event) => setQuery(event.target.value)}
          placeholder="An idea, a question, a half-remembered phrase…"
        />
        <button
          className="kb-button kb-primary"
          disabled={!query.trim() || loading}
        >
          Search
          <ArrowRight size={15} />
        </button>
      </form>
      <div className="kb-search-method">
        <span className="kb-eyebrow">
          {mode
            ? `${mode.toUpperCase()} RETRIEVAL`
            : "LEXICAL + SEMANTIC RETRIEVAL"}
        </span>
        <p>
          {reason ||
            "Exact words meet related meaning when an embedding model is configured. Otherwise, search uses your local text index."}
        </p>
      </div>
      <LoadState
        loading={loading}
        error={error}
        retry={() => setRevision((value) => value + 1)}
      />
      {!loading &&
        !error &&
        (results === null ? (
          <Empty
            icon={<Search size={30} strokeWidth={1.2} />}
            title="Start with a thread."
          >
            <p>
              Something you read. A question you asked. A moment that changed
              your mind.
            </p>
          </Empty>
        ) : results.length ? (
          <div className="kb-search-results">
            <div className="kb-list-toolbar">
              <span className="kb-eyebrow">
                {results.length} RESULTS FOR “{submitted}”
              </span>
            </div>
            {results.map((result) => (
              <article className="kb-search-result" key={result.chunkId}>
                <div className="kb-item-meta">
                  <Badge value={result.type} />
                  <span>{result.path}</span>
                </div>
                <h2>
                  <Link
                    href={
                      result.type === "document"
                        ? documentHref(result.id)
                        : result.sourceId
                          ? sourceHref(result.sourceId, result.start)
                          : noteHref(result.id)
                    }
                  >
                    {result.title}
                    <ArrowRight size={16} />
                  </Link>
                </h2>
                <p>{result.excerpt}</p>
                <div className="kb-search-provenance">
                  {result.start !== undefined && (
                    <span>
                      Passage {stamp(result.start)}
                      {result.end !== undefined ? `–${stamp(result.end)}` : ""}
                    </span>
                  )}
                  <span>
                    Word match {result.lexicalScore.toFixed(2)} · Meaning{" "}
                    {result.semanticScore.toFixed(2)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty
            icon={<Search size={28} />}
            title="That thread hasn’t surfaced yet."
          >
            <p>
              Try a simpler phrase, or rebuild your index in workspace settings
              if files changed outside the app.
            </p>
          </Empty>
        ))}
    </>
  );
}

export function TimelineView() {
  const timeline = useResource<TimelineEvent[]>("timeline");
  const events = timeline.data
    ? [...timeline.data].sort((a, b) => b.at.localeCompare(a.at))
    : [];
  return (
    <>
      <PageTitle
        eyebrow="05 / HOW YOUR THINKING EVOLVES"
        title="A history of understanding"
        description="What you encountered, what you kept, and when it became part of what you know."
      />
      <LoadState {...timeline} retry={timeline.reload} />
      {!timeline.loading &&
        !timeline.error &&
        (events.length ? (
          <ol className="kb-timeline">
            {events.map((event) => (
              <li key={event.id}>
                <time dateTime={event.at}>
                  {date(event.at)}
                  <span>
                    {new Date(event.at).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </time>
                <span className={`kb-timeline-dot kb-event-${event.type}`} />
                <div>
                  <Badge value={event.type} />
                  <h2>
                    <Link href={sourceHref(event.sourceId)}>{event.title}</Link>
                  </h2>
                  <span className="kb-help">{event.sourceId}</span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <Empty
            icon={<History size={30} strokeWidth={1.2} />}
            title="Every understanding has a beginning."
          >
            <p>
              Your encounters, reflections, and accepted changes will leave a
              trail here.
            </p>
            <Link className="kb-text-link" href="/kb">
              Capture your first source
              <ArrowRight size={14} />
            </Link>
          </Empty>
        ))}
    </>
  );
}
