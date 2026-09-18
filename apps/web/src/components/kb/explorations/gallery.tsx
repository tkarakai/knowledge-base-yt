"use client";

import Link from "next/link";
import { ArrowRight, Check, FlaskConical } from "lucide-react";
import { useEffect, useState, type ReactElement } from "react";
import { concepts, isConcept, type ConceptId } from "./concepts";

import { Miniature } from "./miniature";

export function ExplorationGallery(): ReactElement {
  const [favorite, setFavorite] = useState<ConceptId | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("commonplace-ux-favorite");
      if (isConcept(saved ?? undefined)) setFavorite(saved as ConceptId);
    } catch {
      /* Storage is optional. */
    }
  }, []);
  function choose(id: ConceptId) {
    setFavorite(id);
    try {
      window.localStorage.setItem("commonplace-ux-favorite", id);
      setNotice(
        "Preference saved in this browser. The original experience remains your default.",
      );
    } catch {
      setNotice(
        "Preference selected for this visit. Browser storage is unavailable.",
      );
    }
  }
  return (
    <div className="ux-gallery">
      <div className="ux-kicker">
        <FlaskConical size={15} /> EXPERIENCE LAB / THREE WORKING DIRECTIONS
      </div>
      <header className="ux-gallery-heading">
        <h1>
          A different way
          <br />
          to make it yours.
        </h1>
        <p>
          Same knowledge. Three ways to work.
          <br />
          Explore each direction, follow a complete workflow, and see which one
          feels natural.
        </p>
      </header>
      <div className="ux-gallery-note">
        <span className="ux-live-dot" />
        <strong>Connected to your real vault.</strong> Changes made here also
        appear in the original app.
      </div>
      <div className="ux-concept-grid">
        {concepts.map((c) => (
          <article className={`ux-concept ux-concept-${c.id}`} key={c.id}>
            <Link href={`/kb/explore/${c.id}`} aria-label={`Explore ${c.name}`}>
              <Miniature concept={c.id} />
            </Link>
            <div className="ux-concept-copy">
              <div className="ux-concept-title">
                <span>{c.number}</span>
                <h2>{c.name}</h2>
                {favorite === c.id && (
                  <Check size={18} aria-label="Your favorite" />
                )}
              </div>
              <h3>{c.tagline}</h3>
              <p>{c.description}</p>
              <dl>
                <dt>BEST FOR</dt>
                <dd>{c.best}</dd>
                <dt>THE TRADEOFF</dt>
                <dd>{c.tradeoff}</dd>
              </dl>
              <div className="ux-concept-actions">
                <Link
                  href={`/kb/explore/${c.id}`}
                  className="kb-button kb-primary"
                >
                  Try {c.name}
                  <ArrowRight size={15} />
                </Link>
                <button
                  className="ux-favorite"
                  onClick={() => choose(c.id)}
                  aria-pressed={favorite === c.id}
                >
                  {favorite === c.id ? "Your favorite" : "Mark favorite"}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {notice && (
        <p className="ux-preference" role="status">
          {notice}
        </p>
      )}
      <section className="ux-comparison-guide">
        <div>
          <span className="ux-kicker">A FAIR COMPARISON</span>
          <h2>Try the same small journey.</h2>
        </div>
        <ol>
          <li>
            <span>1</span>Open a video and find a useful passage.
          </li>
          <li>
            <span>2</span>Write why it matters and save your reflection.
          </li>
          <li>
            <span>3</span>Propose connections, then review the changes.
          </li>
          <li>
            <span>4</span>Find the resulting note in your knowledge.
          </li>
        </ol>
        <p>
          Switch directions from the experience selector at any time. Choose
          “Original app” to return. Your favorite is a bookmark, not a permanent
          switch.
        </p>
      </section>
    </div>
  );
}
