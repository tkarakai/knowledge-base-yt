"use client";

import { useEffect } from "react";
import type {
  KnowledgeNote,
  SourcePage,
  SynthesisProposal,
} from "@repo/kb-shared";
import { useResource } from "../common";

export function useOverview() {
  const inbox = useResource<SourcePage>("sources/page?tab=inbox");
  const kept = useResource<SourcePage>("sources/page?tab=kept");
  const notes = useResource<KnowledgeNote[]>("knowledge");
  const proposals = useResource<SynthesisProposal[]>("proposals");
  const pending =
    proposals.data?.filter(
      (p) =>
        p.status === "pending" ||
        p.changes.some((c) => c.decision === "pending"),
    ) ?? [];
  const reloadInbox = inbox.reload,
    reloadKept = kept.reload,
    reloadNotes = notes.reload,
    reloadProposals = proposals.reload;
  useEffect(() => {
    const refresh = () => {
      if (!document.hidden) {
        reloadInbox();
        reloadKept();
        reloadNotes();
        reloadProposals();
      }
    };
    window.addEventListener("focus", refresh);
    const timer = setInterval(refresh, 15000);
    return () => {
      window.removeEventListener("focus", refresh);
      clearInterval(timer);
    };
  }, [reloadInbox, reloadKept, reloadNotes, reloadProposals]);
  return { inbox, kept, notes, proposals, pending };
}
export type Overview = ReturnType<typeof useOverview>;
