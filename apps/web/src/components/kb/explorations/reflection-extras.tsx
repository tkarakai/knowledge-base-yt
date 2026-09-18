"use client";
import { useContext, type ReactElement, type ReactNode } from "react";
import { WorkspaceBase } from "../navigation";

/** Keep the primary reflection short, with secondary prompts available on demand. */
export function ReflectionExtras({
  children,
  hasContent,
}: {
  children: ReactNode;
  hasContent: boolean;
}): ReactElement {
  const experience = useContext(WorkspaceBase);
  return experience ? (
    <details className="ux-reflection-extras" open={hasContent || undefined}>
      <summary>
        Reaction & questions<span>Optional</span>
      </summary>
      {children}
    </details>
  ) : (
    <>{children}</>
  );
}
