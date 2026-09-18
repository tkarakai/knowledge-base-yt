"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactElement } from "react";
import { ArrowRight, ChevronRight, FlaskConical, Menu, X } from "lucide-react";
import type { Health } from "@repo/kb-shared";
import { WorkspaceBase } from "../navigation";
import { useResource } from "../common";
import { concepts, type ConceptId } from "./concepts";
import { explorationScreen } from "./screens";
import { ExperienceSidebar, navigation } from "./sidebar";

export function ExplorationShell({
  concept,
  view,
}: {
  concept: ConceptId;
  view: string[];
}): ReactElement {
  const health = useResource<Health>("health");
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [menuOpen]);
  const base = `/kb/explore/${concept}`;
  const current = concepts.find((c) => c.id === concept)!;
  const section = view[0] ?? "home";
  const active =
    section === "sources"
      ? "reflect"
      : section === "documents"
        ? "knowledge"
        : section;
  const screen = explorationScreen({
    concept,
    view,
    reloadHealth: health.reload,
  });
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
  const pageLabel =
    section === "settings"
      ? "Settings"
      : (navItems.find((n) => n.section === active)?.label ?? "Page");
  return (
    <WorkspaceBase.Provider value={base}>
      <div className={`ux-app ux-${concept}`}>
        <a className="kb-skip" href="#ux-main">
          Skip to content
        </a>
        <ExperienceSidebar
          concept={concept}
          active={active}
          menuOpen={menuOpen}
          closeMenu={() => setMenuOpen(false)}
          guideOpen={guideOpen}
          toggleGuide={() => setGuideOpen(!guideOpen)}
          connection={
            health.loading
              ? "loading"
              : health.error || !health.data?.ok
                ? "offline"
                : "online"
          }
          reloadHealth={health.reload}
        />
        <div className="ux-main-shell">
          <header className="ux-topbar">
            <button
              ref={menuButton}
              className="ux-mobile-menu kb-icon-button"
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="ux-breadcrumb">
              <Link href={base}>{current.name}</Link>
              <ChevronRight size={14} />
              <span>{pageLabel}</span>
            </div>
            <div className="ux-experience-selector">
              <label htmlFor="ux-experience">EXPERIENCE</label>
              <select
                id="ux-experience"
                value={concept}
                onChange={(e) => {
                  const suffix = view.map(encodeURIComponent).join("/");
                  router.push(
                    `/kb/explore/${e.target.value}${suffix ? `/${suffix}` : ""}${window.location.hash}`,
                  );
                }}
              >
                {concepts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.number} · {c.name}
                  </option>
                ))}
              </select>
              <Link href="/kb/explore" aria-label="Compare all experiences">
                <FlaskConical size={17} />
              </Link>
            </div>
          </header>
          {guideOpen && (
            <section className="ux-direction-guide">
              <div>
                <strong>
                  {current.name}: {current.tagline}
                </strong>
                <p>
                  {current.description} Best for: {current.best.toLowerCase()}.
                  Tradeoff: {current.tradeoff.toLowerCase()}.
                </p>
              </div>
              <button
                className="kb-icon-button"
                aria-label="Close direction guide"
                onClick={() => setGuideOpen(false)}
              >
                <X size={18} />
              </button>
            </section>
          )}
          <div className="ux-vault-notice">
            <span className="ux-live-dot" />
            Alternative experience · Same vault, shared changes
            <Link href="/kb">
              Return to original
              <ArrowRight size={13} />
            </Link>
          </div>
          {concept === "pipeline" && section !== "home" && (
            <nav className="ux-stepper" aria-label="Learning workflow">
              {[
                { s: "inbox", text: "Capture" },
                { s: "reflect", text: "Reflect & connect" },
                { s: "proposals", text: "Review" },
                { s: "knowledge", text: "Knowledge" },
              ].map((step, i) => (
                <Link
                  href={href(step.s)}
                  key={step.s}
                  aria-current={active === step.s ? "step" : undefined}
                  className={active === step.s ? "is-active" : ""}
                >
                  <span>0{i + 1}</span>
                  {step.text}
                  <ChevronRight size={16} />
                </Link>
              ))}
            </nav>
          )}
          <main
            id="ux-main"
            className={`ux-main ux-section-${section}`}
            tabIndex={-1}
          >
            <div key={section}>
              {screen ?? (
                <div className="ux-empty-inline">
                  <h1>This page couldn’t be found.</h1>
                  <Link href={base}>Return to {current.name}</Link>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </WorkspaceBase.Provider>
  );
}
