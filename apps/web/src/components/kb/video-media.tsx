"use client";
import { useState } from "react";
import { CalendarDays, Youtube } from "lucide-react";
import type { Source } from "@repo/kb-shared";
import { releaseDay } from "@/lib/kb/video-list";
import { date } from "./common";

function SavedImage({
  source,
  kind,
}: {
  source: Source;
  kind: "thumbnail" | "avatar";
}) {
  const [failed, setFailed] = useState(false);
  const url = `/api/kb/sources/${encodeURIComponent(source.id)}/media/${kind}`;
  return (
    <span
      className={
        kind === "thumbnail" ? "kb-video-thumbnail" : "kb-channel-avatar"
      }
    >
      {kind === "thumbnail" ? (
        <Youtube aria-hidden="true" size={24} />
      ) : (
        <span aria-hidden="true">
          {(source.channel || "?").slice(0, 1).toUpperCase()}
        </span>
      )}
      {!failed && (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
export function VideoThumbnail({ source }: { source: Source }) {
  return (
    <SavedImage
      key={source.thumbnailUrl ?? source.id}
      source={source}
      kind="thumbnail"
    />
  );
}
export function VideoChannel({ source }: { source: Source }) {
  const content = (
    <>
      <SavedImage
        key={source.channelAvatarUrl ?? source.channelUrl ?? source.id}
        source={source}
        kind="avatar"
      />
      <span>{source.channel || "Unknown channel"}</span>
    </>
  );
  return source.channelUrl ? (
    <a
      className="kb-video-channel"
      href={source.channelUrl}
      target="_blank"
      rel="noreferrer"
    >
      {content}
    </a>
  ) : (
    <span className="kb-video-channel">{content}</span>
  );
}
export function VideoReleaseDate({ source }: { source: Source }) {
  const day = releaseDay(source);
  return (
    <span
      className={`kb-release-date${day ? "" : " is-unknown"}`}
      title={source.metadataError}
    >
      <CalendarDays size={14} aria-hidden="true" />
      {day ? (
        <time dateTime={day}>Released {date(`${day}T12:00:00`)}</time>
      ) : (
        <span>
          {source.metadataCheckedAt
            ? "Release date unavailable"
            : "Fetching release date…"}
        </span>
      )}
    </span>
  );
}
