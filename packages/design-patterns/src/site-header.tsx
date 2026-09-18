import { cn } from "@repo/design-system";

interface SiteHeaderProps {
  /** App name displayed next to the icon */
  appName: string;
  /** Link target for the logo/name. Defaults to "/" */
  homeHref?: string;
  /** Custom link component (e.g., locale-aware Link). Defaults to <a>. */
  linkAs?: React.ElementType;
  /** Content rendered on the right side (e.g., LocaleSwitcher) */
  actions?: React.ReactNode;
  className?: string;
}

export function SiteHeader({
  appName,
  homeHref = "/",
  linkAs: LinkComponent = "a",
  actions,
  className,
}: SiteHeaderProps) {
  return (
    <header
      className={cn(
        "fixed top-[calc(var(--env-banner-h,0px)+var(--announcement-banner-h,0px))] z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        className,
      )}
    >
      <div className="flex items-center justify-between px-6 py-4">
        <LinkComponent
          href={homeHref}
          className="flex items-center gap-2 text-sm font-semibold text-foreground transition-colors hover:text-muted-foreground"
        >
          <img src="/icon.svg" alt="" width={24} height={24} />
          {appName}
        </LinkComponent>
        {actions}
      </div>
    </header>
  );
}
