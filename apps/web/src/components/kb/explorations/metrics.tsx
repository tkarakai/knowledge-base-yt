import type { ReactElement } from "react";
import { ArrowRight, BookOpen, CheckCheck, Inbox, PenLine } from "lucide-react";
import Link from "../navigation";
import type { Overview } from "./data";

export function Metrics({ data }: { data: Overview }): ReactElement {
  const items = [
    {
      label: "To reflect on",
      value: data.inbox.data?.counts.inbox,
      resource: data.inbox,
      href: "/kb/inbox",
      icon: Inbox,
    },
    {
      label: "In progress",
      value: data.kept.data?.total,
      resource: data.kept,
      href: "/kb/reflect",
      icon: PenLine,
    },
    {
      label: "Awaiting review",
      value: data.proposals.data ? data.pending.length : undefined,
      resource: data.proposals,
      href: "/kb/proposals",
      icon: CheckCheck,
    },
    {
      label: "Knowledge notes",
      value: data.notes.data?.length,
      resource: data.notes,
      href: "/kb/knowledge",
      icon: BookOpen,
    },
  ];
  return (
    <div className="ux-metrics">
      {items.map(({ label, value, resource, href, icon: Icon }) => (
        <Link key={label} href={href}>
          <Icon size={17} />
          <span>{label}</span>
          <strong>{resource.error ? "—" : (value ?? "…")}</strong>
          <ArrowRight size={14} />
          {resource.error && <small>Unable to load</small>}
        </Link>
      ))}
    </div>
  );
}
