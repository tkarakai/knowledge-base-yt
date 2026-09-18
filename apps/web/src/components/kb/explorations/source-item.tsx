import type { ReactElement } from "react";
import { ArrowRight } from "lucide-react";
import type { Source, SourceStatus } from "@repo/kb-shared";
import Link from "../navigation";
import { sourceHref } from "../common";
import { VideoThumbnail } from "../video-media";

const statuses: Record<SourceStatus, string> = {
  ready_for_reflection: "To reflect",
  kept: "Kept",
  ignored: "Ignored",
  deferred: "For later",
  synthesis_pending: "Connecting",
  proposal_ready: "Review ready",
  integrated: "Integrated",
};
export function SourceItem({
  source,
  selected,
  compact = false,
}: {
  source: Source;
  selected?: boolean;
  compact?: boolean;
}): ReactElement {
  return (
    <Link
      className={`ux-source-row ${selected ? "is-selected" : ""} ${compact ? "is-compact" : ""}`}
      href={sourceHref(source.id)}
      aria-current={selected ? "page" : undefined}
    >
      <VideoThumbnail source={source} />
      <div className="ux-source-copy">
        <strong>{source.title}</strong>
        <span>{source.channel || "Unknown channel"}</span>
        <small>
          <i className={`ux-status-dot ux-status-${source.status}`} />
          {statuses[source.status]}
          {!compact && (
            <span>
              {" "}
              ·{" "}
              {source.publishedOn ??
                source.publishedAt?.slice(0, 10) ??
                "Release date unavailable"}
            </span>
          )}
        </small>
      </div>
      <ArrowRight size={14} className="ux-row-arrow" />
    </Link>
  );
}
