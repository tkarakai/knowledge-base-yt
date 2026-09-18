"use client";
import type { ReactElement } from "react";
import { ArrowRight } from "lucide-react";
import type { SourcePage } from "@repo/kb-shared";
import Link from "../navigation";
import { LoadState, useResource } from "../common";
import { SourceItem } from "./source-item";

export function SourceShelf(): ReactElement {
  const sources = useResource<SourcePage>("sources/page?tab=all");
  return (
    <section className="ux-source-shelf">
      <div className="ux-panel-heading">
        <div>
          <span className="ux-kicker">KEEP EXPLORING</span>
          <h2>From your source material</h2>
        </div>
        <Link href="/kb/inbox">
          Open inbox
          <ArrowRight size={14} />
        </Link>
      </div>
      <LoadState {...sources} retry={sources.reload} />
      {!sources.error && !sources.loading && (
        <div className="ux-source-shelf-grid">
          {sources.data?.groups
            .flatMap((g) => g.videos)
            .slice(0, 3)
            .map((s) => (
              <SourceItem key={s.id} source={s} compact />
            ))}
          {!sources.data?.total && (
            <p>
              Add a video in the capture inbox to begin your first reflection.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
