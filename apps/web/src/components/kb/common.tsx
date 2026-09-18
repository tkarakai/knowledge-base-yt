"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "./navigation";
import {
  AlertCircle,
  ArrowUpRight,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";

export const sourceHref = (id: string, start?: number) =>
  `/kb/sources/${encodeURIComponent(id)}${start === undefined ? "" : `#t-${start}`}`;
export const documentHref = (id: string) =>
  `/kb/documents/${encodeURIComponent(id)}`;
export const noteHref = (id: string) =>
  `/kb/knowledge/${encodeURIComponent(id)}`;
export const stamp = (seconds: number) => {
  const value = Math.max(0, Math.floor(seconds));
  return value >= 3600
    ? `${Math.floor(value / 3600)}:${String(Math.floor(value / 60) % 60).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`
    : `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
};
export const date = (value: string) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
export const label = (value: string) => value.replaceAll("_", " ");

export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
  onResponse?: (response: Response) => void,
): Promise<T> {
  const response = await fetch(`/api/kb/${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
    cache: "no-store",
  });
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(
      "The workspace received an invalid response. Check the companion and retry.",
    );
  }
  if (!response.ok)
    throw new Error(
      typeof payload === "object" &&
      payload &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `Request failed (${response.status}). Please retry.`,
    );
  onResponse?.(response);
  return payload as T;
}

export function useResource<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [dataPath, setDataPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (path === null) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api<T>(path, "GET", undefined, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setData(value);
          setDataPath(path);
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to load the workspace.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, revision]);
  return {
    data,
    error,
    loading,
    reload,
    refreshing: loading && data !== null && dataPath === path,
  };
}

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const locked = useRef(false);
  async function run(work: () => Promise<void>, success?: string) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await work();
      if (success) setMessage(success);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Something went wrong. Your changes have not been confirmed.",
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return { busy, error, message, run };
}

export function Feedback({
  error,
  message,
}: {
  error?: string | null;
  message?: string | null;
}) {
  return (
    <>
      {error && (
        <div className="kb-notice kb-notice-error" role="alert">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}
      {message && (
        <div className="kb-notice" role="status">
          {message}
        </div>
      )}
    </>
  );
}
export function LoadState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: string | null;
  retry: () => void;
}) {
  if (error)
    return (
      <div className="kb-load-error">
        <Feedback error={error} />
        <button className="kb-button" onClick={retry}>
          <RefreshCw size={15} /> Try again
        </button>
      </div>
    );
  if (loading)
    return (
      <div className="kb-loading" role="status">
        <LoaderCircle size={18} className="kb-spin" /> Opening your workspace…
      </div>
    );
  return null;
}
export function Empty({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="kb-empty">
      <span className="kb-empty-icon">{icon}</span>
      <h2>{title}</h2>
      <div>{children}</div>
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <header className="kb-page-title">
      <div>
        <span className="kb-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </header>
  );
}
export function Badge({ value }: { value: string }) {
  return <span className={`kb-badge kb-badge-${value}`}>{label(value)}</span>;
}
export function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  let safe = false;
  try {
    safe = ["http:", "https:"].includes(new URL(href).protocol);
  } catch {
    /* Invalid URLs render as text. */
  }
  return safe ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="kb-external"
    >
      {children}
      <ArrowUpRight size={13} />
    </a>
  ) : (
    <span>{children}</span>
  );
}

function inline(text: string): ReactNode[] {
  return text
    .split(/(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*)/g)
    .map((part, index) => {
      const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        if (/^https?:\/\//i.test(link[2]))
          return (
            <ExternalLink key={index} href={link[2]}>
              {link[1]}
            </ExternalLink>
          );
        return (
          <span key={index} title={link[2]}>
            {link[1]}
          </span>
        );
      }
      if (part.startsWith("`"))
        return <code key={index}>{part.slice(1, -1)}</code>;
      if (part.startsWith("**"))
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      return part;
    });
}
/** Small, inert Markdown preview: raw HTML is always text and URLs are protocol checked. */
export function Markdown({ text }: { text: string }) {
  const blocks = text.split(/(```[^\n]*\n[\s\S]*?```)/g);
  return (
    <div className="kb-markdown">
      {blocks.map((block, index) =>
        block.startsWith("```") ? (
          <pre key={index}>
            <code>{block.replace(/^```[^\n]*\n/, "").replace(/```$/, "")}</code>
          </pre>
        ) : (
          block.split(/\n\s*\n/).map((paragraph, part) => {
            const key = `${index}-${part}`;
            if (!paragraph.trim()) return null;
            const heading = paragraph.match(/^(#{1,6}) (.*)$/);
            if (heading)
              return heading[1].length === 1 ? (
                <h2 key={key}>{inline(heading[2])}</h2>
              ) : (
                <h3 key={key}>{inline(heading[2])}</h3>
              );
            if (
              /^[-*] /m.test(paragraph) &&
              paragraph.split("\n").every((line) => /^[-*] /.test(line))
            )
              return (
                <ul key={key}>
                  {paragraph.split("\n").map((line, item) => (
                    <li key={item}>{inline(line.slice(2))}</li>
                  ))}
                </ul>
              );
            if (paragraph.startsWith("> "))
              return (
                <blockquote key={key}>
                  {inline(paragraph.replace(/^> /gm, ""))}
                </blockquote>
              );
            return <p key={key}>{inline(paragraph)}</p>;
          })
        ),
      )}
    </div>
  );
}

export function BackLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link className="kb-back" href={href}>
      ← {children}
    </Link>
  );
}
