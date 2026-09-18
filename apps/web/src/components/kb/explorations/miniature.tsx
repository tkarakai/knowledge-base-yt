import type { ReactElement } from "react";
import type { ConceptId } from "./concepts";

export function Miniature({ concept }: { concept: ConceptId }): ReactElement {
  return (
    <div className={`ux-mini ux-mini-${concept}`} aria-hidden="true">
      <div className="ux-mini-bar">
        <b>commonplace</b>
        <span>● ● ●</span>
      </div>
      <div className="ux-mini-body">
        <div className="ux-mini-nav">
          <i />
          <i />
          <i />
          <i />
        </div>
        {concept === "workbench" ? (
          <>
            <div className="ux-mini-queue">
              SOURCES
              {[1, 2, 3, 4].map((i) => (
                <div key={i}>
                  <b />
                  <span />
                  <span />
                </div>
              ))}
            </div>
            <div className="ux-mini-reading">
              A thought worth keeping<h4>The source, in context.</h4>
              <i />
              <i />
              <i />
              <i />
              <i />
              <small>00:24 · Selected passage</small>
            </div>
            <div className="ux-mini-reflect">
              YOUR REFLECTION
              <i />
              <i />
              <span className="ux-mini-save">Save reflection</span>
            </div>
          </>
        ) : concept === "pipeline" ? (
          <div className="ux-mini-board">
            {["Capture", "Reflect", "Review", "Knowledge"].map((s, i) => (
              <div key={s}>
                <b>
                  {i + 1} · {s}
                </b>
                <article />
                <article />
                {i < 2 && <article />}
              </div>
            ))}
          </div>
        ) : (
          <div className="ux-mini-library-content">
            <h4>Your thinking, connected.</h4>
            <div className="ux-mini-search">⌕ Search your knowledge</div>
            <small>All notes · Learning · Systems</small>
            <div>
              {[1, 2, 3, 4].map((i) => (
                <article key={i}>
                  <b />
                  <i />
                  <i />
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
