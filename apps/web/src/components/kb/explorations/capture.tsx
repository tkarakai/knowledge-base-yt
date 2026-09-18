"use client";

import { useState, type ReactElement } from "react";
import { ArrowRight, Plus } from "lucide-react";
import type { SourceDetail } from "@repo/kb-shared";
import Link, { useWorkspaceRouter } from "../navigation";
import { api, Feedback, sourceHref, useAction } from "../common";

export function Capture(): ReactElement {
  const [url, setUrl] = useState("");
  const action = useAction();
  const router = useWorkspaceRouter();
  return (
    <div className="ux-capture">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(async () => {
            const detail = await api<SourceDetail>("sources", "POST", { url });
            setUrl("");
            router.push(sourceHref(detail.source.id));
          });
        }}
      >
        <label htmlFor="ux-capture-url">
          <Plus size={17} />
          Add a source
        </label>
        <input
          id="ux-capture-url"
          type="url"
          required
          placeholder="Paste a YouTube link…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button
          className="kb-button kb-primary"
          disabled={action.busy || !url.trim()}
        >
          {action.busy ? "Adding…" : "Add video"}
          <ArrowRight size={15} />
        </button>
        <Link href="/kb/settings#youtube-history">Import history</Link>
      </form>
      <Feedback {...action} />
    </div>
  );
}
