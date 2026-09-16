"use client";

import { cn } from "@repo/design-system";

import { renderPreview } from "@/lib/email-template-constants";

export function EmailHtmlPreview({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  const rendered = renderPreview(html);

  return (
    <iframe
      srcDoc={rendered}
      sandbox=""
      title="Email preview"
      className={cn(
        "h-[500px] w-full rounded-md border bg-white",
        className
      )}
    />
  );
}
