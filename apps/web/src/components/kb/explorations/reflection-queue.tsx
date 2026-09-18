import type { ReactElement } from "react";
import { SourceQueue } from "./source-queue";

export function ReflectionQueue(): ReactElement {
  return (
    <>
      <header className="ux-page-heading">
        <div>
          <span className="ux-kicker">REFLECT & CONNECT</span>
          <h1>Develop the sources you kept.</h1>
          <p>
            Save why a source matters, then propose connections to your existing
            knowledge.
          </p>
        </div>
      </header>
      <SourceQueue initialTab="kept" />
    </>
  );
}
