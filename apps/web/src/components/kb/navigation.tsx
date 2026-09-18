"use client";

import NextLink from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  type ComponentProps,
  type ReactElement,
} from "react";

export const WorkspaceBase = createContext<string | null>(null);

export function workspaceHref(href: string, base: string | null): string {
  if (
    !base ||
    !/^\/kb(?:[/?#]|$)/.test(href) ||
    /^\/kb\/explore(?:[/?#]|$)/.test(href)
  )
    return href;
  const rest = href.slice(3);
  return `${base}${!rest || /^[?#]/.test(rest) ? "/inbox" : ""}${rest}`;
}

/** Existing screens retain the selected experience, including evidence anchors. */
export default function WorkspaceLink(
  props: ComponentProps<typeof NextLink>,
): ReactElement {
  const base = useContext(WorkspaceBase);
  const href =
    typeof props.href === "string"
      ? workspaceHref(props.href, base)
      : props.href;
  return <NextLink {...props} href={href} />;
}

export function useWorkspaceRouter(): { push: (href: string) => void } {
  const router = useRouter();
  const base = useContext(WorkspaceBase);
  return { push: (href: string) => router.push(workspaceHref(href, base)) };
}
