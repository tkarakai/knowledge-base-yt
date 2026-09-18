import type { ReactNode } from "react";
import { SourceView, InboxView } from "../sources";
import {
  DocumentView,
  KnowledgeView,
  NoteView,
  SearchView,
  TimelineView,
} from "../library";
import { ProposalsView } from "../proposals";
import { SettingsView } from "../settings";
import type { ConceptId } from "./concepts";
import { WorkbenchHome } from "./workbench-home";
import { PipelineHome } from "./pipeline-home";
import { ReflectionQueue } from "./reflection-queue";
import { LibraryHome } from "./library-home";
import { SourceQueue } from "./source-queue";

export function explorationScreen({
  concept,
  view,
  reloadHealth,
}: {
  concept: ConceptId;
  view: string[];
  reloadHealth: () => void;
}): ReactNode {
  const section = view[0] ?? "home";
  if (view.length > 2) return null;
  if (section === "home" && view.length < 2)
    return concept === "workbench" ? (
      <WorkbenchHome />
    ) : concept === "pipeline" ? (
      <PipelineHome />
    ) : (
      <LibraryHome />
    );
  if (section === "sources" && view.length === 2)
    return concept === "workbench" ? (
      <div className="ux-desk-reader">
        <SourceQueue compact selected={view[1]} />
        <section className="ux-source-reader" aria-label="Selected source">
          <SourceView key={view[1]} id={view[1]} />
        </section>
      </div>
    ) : (
      <SourceView key={view[1]} id={view[1]} />
    );
  if (section === "knowledge" && view.length === 2)
    return concept === "library" ? (
      <LibraryHome selected={view[1]} />
    ) : (
      <NoteView key={view[1]} id={view[1]} />
    );
  if (section === "documents" && view.length === 2)
    return <DocumentView key={view[1]} id={view[1]} />;
  if (view.length > 1) return null;
  if (section === "inbox") return <InboxView />;
  if (section === "reflect") return <ReflectionQueue />;
  if (section === "knowledge")
    return concept === "library" ? <LibraryHome /> : <KnowledgeView />;
  if (section === "documents") return <KnowledgeView initialImportOpen />;
  if (section === "proposals") return <ProposalsView />;
  if (section === "search") return <SearchView />;
  if (section === "timeline") return <TimelineView />;
  if (section === "settings") return <SettingsView onSaved={reloadHealth} />;
  return null;
}
