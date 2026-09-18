"use client";
import type { ReactElement } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCheck,
  ChevronRight,
  FlaskConical,
  History,
  Inbox,
  LayoutDashboard,
  PenLine,
  Search,
  Settings2,
} from "lucide-react";
import { concepts, type ConceptId } from "./concepts";

export const navigation = [
  { section: "home", label: "Overview", icon: LayoutDashboard },
  { section: "inbox", label: "Capture inbox", icon: Inbox },
  { section: "reflect", label: "Reflect & connect", icon: PenLine },
  { section: "proposals", label: "Review proposals", icon: CheckCheck },
  { section: "knowledge", label: "Knowledge", icon: BookOpen },
  { section: "search", label: "Search everything", icon: Search },
  { section: "timeline", label: "Activity", icon: History },
];

export function ExperienceSidebar({
  concept,
  active,
  menuOpen,
  closeMenu,
  guideOpen,
  toggleGuide,
  connection,
  reloadHealth,
}: {
  concept: ConceptId;
  active: string;
  menuOpen: boolean;
  closeMenu: () => void;
  guideOpen: boolean;
  toggleGuide: () => void;
  connection: "loading" | "offline" | "online";
  reloadHealth: () => void;
}): ReactElement {
  const base = `/kb/explore/${concept}`;
  const current = concepts.find((c) => c.id === concept)!;
  const navItems =
    concept === "library"
      ? [
          navigation[0],
          navigation[4],
          navigation[5],
          navigation[1],
          navigation[2],
          navigation[3],
          navigation[6],
        ]
      : navigation;
  const href = (s: string) => `${base}${s === "home" ? "" : `/${s}`}`;
  return (
    <aside className={`ux-sidebar ${menuOpen ? "is-open" : ""}`}>
      <Link href={base} className="ux-brand">
        <span>
          <BookOpen size={22} />
        </span>
        commonplace<span className="ux-brand-period">.</span>
      </Link>
      <div className="ux-workspace-label">
        PERSONAL WORKSPACE<span>LOCAL</span>
      </div>
      <nav aria-label="Experience navigation">
        {navItems.map(({ section: s, label, icon: Icon }) => (
          <Link
            key={s}
            href={href(s)}
            onClick={closeMenu}
            className={active === s ? "is-active" : ""}
            aria-current={active === s ? "page" : undefined}
          >
            <Icon size={18} />
            <span>
              {s === "home"
                ? concept === "pipeline"
                  ? "Workflow board"
                  : concept === "library"
                    ? "Library home"
                    : "My workbench"
                : label}
            </span>
            {active === s && <ChevronRight size={14} />}
          </Link>
        ))}
      </nav>
      <div className="ux-sidebar-guide">
        <span className="ux-kicker">
          {current.number} / {current.name.toUpperCase()}
        </span>
        <p>{current.tagline}</p>
        <button onClick={toggleGuide} aria-expanded={guideOpen}>
          About this direction
          <ArrowRight size={14} />
        </button>
      </div>
      <div className="ux-sidebar-bottom">
        <Link
          href={`${base}/settings`}
          aria-current={active === "settings" ? "page" : undefined}
        >
          <Settings2 size={18} />
          Settings & connections
        </Link>
        <Link href="/kb/explore">
          <FlaskConical size={18} />
          Compare experiences
        </Link>
        <Link href="/kb">
          <ArrowLeft size={18} />
          Original app
        </Link>
        <button className="ux-connection" onClick={reloadHealth}>
          <span
            className={`ux-live-dot ${connection === "online" ? "" : "is-offline"}`}
          />
          {connection === "loading"
            ? "Checking connection…"
            : connection === "offline"
              ? "Companion offline · Retry"
              : "Local companion connected"}
        </button>
      </div>
    </aside>
  );
}
