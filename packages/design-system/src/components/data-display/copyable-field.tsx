"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";

import { cn } from "../../lib/utils";

export interface CopyableFieldProps {
  /** The text value to display and copy to clipboard */
  value: string;
  /** Additional class names for the outer container */
  className?: string;
  /** Number of visible rows. When set, renders a scrollable multi-line container. */
  rows?: number;
  /** Callback invoked after a successful copy */
  onCopied?: () => void;
  /** Callback invoked when copy fails */
  onCopyError?: () => void;
}

/**
 * A read-only field that displays a value with an inline copy button.
 * Useful for secret keys, recovery codes, tokens, and other copyable values.
 */
const ROW_HEIGHT_REM = 1.25;

function CopyableField({
  value,
  className,
  rows,
  onCopied,
  onCopyError,
}: CopyableFieldProps) {
  const [copied, setCopied] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleCopy = async () => {
    try {
      const clipboard = globalThis.navigator?.clipboard;
      if (!clipboard) throw new Error("Clipboard API unavailable");
      await clipboard.writeText(value);
      setCopied(true);
      onCopied?.();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      onCopyError?.();
    }
  };

  const copyButton = (
    <button
      type="button"
      onClick={handleCopy}
      className="flex-none rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={copied ? "Copied" : "Copy to clipboard"}
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </button>
  );

  if (rows) {
    return (
      <div
        data-slot="copyable-field"
        className={cn(
          "relative rounded-md border border-input bg-muted/50 text-sm shadow-sm",
          className,
        )}
      >
        <div
          className="overflow-y-auto px-3 py-2 pr-10"
          style={{ maxHeight: `${rows * ROW_HEIGHT_REM}rem` }}
        >
          <pre className="min-w-0 select-all whitespace-pre-wrap break-all font-mono text-xs">
            {value}
          </pre>
        </div>
        <div className="absolute right-6 top-2">{copyButton}</div>
      </div>
    );
  }

  return (
    <div
      data-slot="copyable-field"
      className={cn(
        "flex items-center gap-2 rounded-md border border-input bg-muted/50 px-3 py-2 text-sm shadow-sm",
        className,
      )}
    >
      <span className="min-w-0 flex-1 select-all break-all font-mono text-xs">
        {value}
      </span>
      {copyButton}
    </div>
  );
}

export { CopyableField };
