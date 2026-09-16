"use client";

import Link from "next/link";
import {
  BookOpen,
  Inbox,
  GitPullRequest,
  Search,
  History,
  Settings2,
  ArrowUpRight,
  Circle,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useState } from "react";
import type { Health } from "@repo/kb-shared";
import { useResource, Empty } from "./common";
import { InboxView, SourceView } from "./sources";
import { ProposalsView } from "./proposals";
import {
  KnowledgeView,
  NoteView,
  DocumentView,
  SearchView,
  TimelineView,
} from "./library";
import { SettingsView } from "./settings";

const navigation = [
  { href: "/kb", key: "inbox", label: "Inbox", icon: Inbox },
  {
    href: "/kb/knowledge",
    key: "knowledge",
    label: "Knowledge",
    icon: BookOpen,
  },
  {
    href: "/kb/proposals",
    key: "proposals",
    label: "Review desk",
    icon: GitPullRequest,
  },
  { href: "/kb/search", key: "search", label: "Search", icon: Search },
  { href: "/kb/timeline", key: "timeline", label: "Timeline", icon: History },
];

export function Workspace({ view }: { view: string[] }) {
  const health = useResource<Health>("health");
  const [compact, setCompact] = useState(false);
  const section = view[0] ?? "inbox";
  const active =
    section === "sources"
      ? "inbox"
      : section === "documents"
        ? "knowledge"
        : section;
  const connected = health.data?.ok && !health.error;
  let content;
  if (section === "inbox" && view.length < 2) content = <InboxView />;
  else if (section === "sources" && view.length === 2)
    content = <SourceView key={view[1]} id={view[1]} />;
  else if (section === "knowledge" && view.length === 2)
    content = <NoteView key={view[1]} id={view[1]} />;
  else if (section === "documents" && view.length === 2)
    content = <DocumentView key={view[1]} id={view[1]} />;
  else if (section === "knowledge" && view.length === 1)
    content = <KnowledgeView />;
  else if (section === "proposals" && view.length === 1)
    content = <ProposalsView />;
  else if (section === "search" && view.length === 1) content = <SearchView />;
  else if (section === "timeline" && view.length === 1)
    content = <TimelineView />;
  else if (section === "settings" && view.length === 1)
    content = <SettingsView onSaved={health.reload} />;
  else
    content = (
      <Empty icon={<BookOpen />} title="This page isn’t in your notebook.">
        <Link href="/kb">Return to the inbox</Link>
      </Empty>
    );

  return (
    <div className={`kb-workspace ${compact ? "kb-compact" : ""}`}>
      <a className="kb-skip" href="#kb-main">
        Skip to content
      </a>
      <aside className="kb-sidebar">
        <Link className="kb-brand" href="/kb">
          <span className="kb-brand-mark">
            <BookOpen size={22} strokeWidth={1.5} />
          </span>
          <span className="kb-brand-text">
            commonplace<span>A PERSONAL KNOWLEDGE WORKSPACE</span>
          </span>
        </Link>
        <div className="kb-sidebar-label">YOUR NOTEBOOK</div>
        <nav aria-label="Knowledge workspace">
          {navigation.map(({ href, key, label, icon: Icon }) => (
            <Link
              key={key}
              href={href}
              aria-label={label}
              className={`kb-nav-link ${active === key ? "is-active" : ""}`}
              aria-current={active === key ? "page" : undefined}
            >
              <Icon size={18} strokeWidth={1.5} />
              <span>{label}</span>
              {active === key && <span className="kb-nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="kb-sidebar-bottom">
          <div className="kb-margin-note">
            <span>
              Make room for
              <br />
              <em>what matters.</em>
            </span>
            <p>
              A source is a beginning.
              <br />
              Your understanding is the work.
            </p>
          </div>
          <Link
            href="/kb/settings"
            aria-label="Workspace settings"
            className={`kb-nav-link ${active === "settings" ? "is-active" : ""}`}
            aria-current={active === "settings" ? "page" : undefined}
          >
            <Settings2 size={18} />
            <span>Workspace settings</span>
          </Link>
          <button
            className="kb-connection"
            onClick={health.reload}
            title="Check companion connection"
          >
            <Circle
              size={8}
              fill="currentColor"
              className={connected ? "kb-online" : "kb-offline"}
            />
            <span>
              {health.loading
                ? "Checking connection"
                : connected
                  ? "Local companion connected"
                  : "Companion offline"}
            </span>
          </button>
        </div>
      </aside>
      <div className="kb-main-shell">
        <div className="kb-topbar">
          <div>
            <button
              className="kb-icon-button kb-sidebar-toggle"
              aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => setCompact(!compact)}
            >
              {compact ? (
                <PanelLeftOpen size={17} />
              ) : (
                <PanelLeftClose size={17} />
              )}
            </button>
            <span>YOUR KNOWLEDGE, CONSIDERED</span>
          </div>
          <Link href="/kb/settings">
            <span className="kb-local-dot" /> Local-first{" "}
            <ArrowUpRight size={13} />
          </Link>
        </div>
        <main id="kb-main" className="kb-main" tabIndex={-1}>
          {content}
        </main>
        <footer className="kb-footer">
          <span>Commonplace</span>
          <span>Sources → reflections → understanding</span>
          <span>Yours, in Markdown.</span>
        </footer>
      </div>
    </div>
  );
}
