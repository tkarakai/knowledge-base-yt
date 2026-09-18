"use client";

import { useState, type ReactElement } from "react";
import { ArrowRight, BookOpen, FileText, Search } from "lucide-react";
import type { KnowledgeNote } from "@repo/kb-shared";
import Link from "../navigation";
import { date, LoadState, noteHref, useResource } from "../common";
import { NoteView } from "../library";
import { SourceShelf } from "./source-shelf";

export function LibraryHome({ selected }: { selected?: string }): ReactElement {
  const notes = useResource<KnowledgeNote[]>("knowledge");
  const [tag, setTag] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("updated");
  const tags = [...new Set(notes.data?.flatMap((n) => n.tags) ?? [])].sort();
  const visible = (notes.data ?? [])
    .filter(
      (n) =>
        (!tag || n.tags.includes(tag)) &&
        `${n.title} ${n.tags.join(" ")} ${n.markdown}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title)
        : b.updatedAt.localeCompare(a.updatedAt),
    );
  return (
    <>
      <header className="ux-page-heading">
        <div>
          <span className="ux-kicker">THE KNOWLEDGE LIBRARY</span>
          <h1>Your thinking, connected.</h1>
          <p>
            Browse by topic. Follow the evidence. Give an idea another chapter.
          </p>
        </div>
        <Link href="/kb/documents" className="kb-button">
          <FileText size={16} />
          Import Markdown
        </Link>
      </header>
      <div className="ux-library-toolbar">
        <label className="ux-search-input">
          <Search size={18} />
          <input
            type="search"
            aria-label="Search library notes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a note, topic, or phrase…"
          />
        </label>
        <select
          aria-label="Sort library notes"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="updated">Recently updated</option>
          <option value="title">Title A–Z</option>
        </select>
        <Link href="/kb/search">
          Search the whole vault
          <ArrowRight size={15} />
        </Link>
      </div>
      <div className={`ux-library-layout ${selected ? "has-reader" : ""}`}>
        <aside className="ux-topics">
          <span className="ux-kicker">TOPIC SHELVES</span>
          <button
            aria-pressed={!tag}
            className={!tag ? "is-active" : ""}
            onClick={() => setTag("")}
          >
            <BookOpen size={16} />
            All notes<span>{notes.data?.length ?? "…"}</span>
          </button>
          {tags.map((t) => (
            <button
              key={t}
              aria-pressed={tag === t}
              className={tag === t ? "is-active" : ""}
              onClick={() => setTag(t)}
            >
              <span className="ux-topic-mark">#</span>
              {t}
              <span>
                {notes.data?.filter((n) => n.tags.includes(t)).length}
              </span>
            </button>
          ))}
          {!tags.length && <p>Topics appear here when your notes have tags.</p>}
          <div className="ux-shelf-bottom">
            <span className="ux-kicker">SOURCE MATERIAL</span>
            <Link href="/kb/inbox">
              Videos & reflections
              <ArrowRight size={14} />
            </Link>
            <Link href="/kb/search">
              Documents & passages
              <ArrowRight size={14} />
            </Link>
            <Link href="/kb/proposals">
              Proposals to review
              <ArrowRight size={14} />
            </Link>
          </div>
        </aside>
        <section className="ux-library-results" aria-label="Knowledge notes">
          <div className="ux-panel-heading">
            <h2>{tag || "All knowledge"}</h2>
            <span>{visible.length} notes</span>
          </div>
          <LoadState {...notes} retry={notes.reload} />
          {!notes.loading && !notes.error && (
            <div className="ux-library-cards">
              {visible.map((n, i) => (
                <Link
                  className={`ux-library-card ${selected === n.id ? "is-selected" : ""}`}
                  href={noteHref(n.id)}
                  key={n.id}
                  aria-current={selected === n.id ? "page" : undefined}
                >
                  <div className="ux-note-index">
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <BookOpen size={18} />
                  </div>
                  <h2>{n.title}</h2>
                  <p>{n.markdown.replace(/[#*`>[\]]/g, "").slice(0, 180)}</p>
                  <div className="ux-note-tags">
                    {n.tags.slice(0, 3).map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                  <footer>
                    <span>{date(n.updatedAt)}</span>
                    <ArrowRight size={16} />
                  </footer>
                </Link>
              ))}
              {!visible.length && (
                <div className="ux-library-empty">
                  <BookOpen size={36} strokeWidth={1.2} />
                  <h2>
                    {query || tag
                      ? "No notes on this shelf"
                      : "A home for what you understand."}
                  </h2>
                  <p>
                    {query || tag
                      ? "Try another phrase or choose All notes. Search the whole vault to include sources and documents."
                      : "Your library grows when you accept proposed changes. Start with a source, or bring existing Markdown into your searchable vault."}
                  </p>
                  <Link
                    className="kb-button kb-primary"
                    href={query || tag ? "/kb/search" : "/kb/inbox"}
                  >
                    {query || tag
                      ? "Search whole vault"
                      : "Start with a source"}
                    <ArrowRight size={15} />
                  </Link>
                </div>
              )}
            </div>
          )}
        </section>
        {selected && (
          <section
            className="ux-library-reader"
            aria-label="Selected knowledge note"
          >
            <NoteView key={selected} id={selected} />
          </section>
        )}
      </div>
      {!selected && <SourceShelf />}
    </>
  );
}
