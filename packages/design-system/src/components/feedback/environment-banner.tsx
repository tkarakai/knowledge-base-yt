"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Collapsible as CollapsiblePrimitive } from "radix-ui"
import { Copy, Check, ChevronDown } from "lucide-react"
import { toast } from "sonner"

import { cn } from "../../lib/utils"

/**
 * The collapsed banner height in pixels.
 * This value is also set as --env-banner-h on <html> so that
 * fixed/sticky headers in apps can offset themselves via
 * top-[var(--env-banner-h,0px)].
 */
const ENV_BANNER_H_PX = 14

const environmentBannerVariants = cva(
  "left-0 right-0 z-[9999] font-medium leading-none select-none overflow-hidden",
  {
    variants: {
      environment: {
        development: "bg-env-development text-env-development-foreground",
        staging: "bg-env-staging text-env-staging-foreground",
        production: "hidden",
      },
      position: {
        fixed: "fixed top-0",
        static: "relative",
      },
    },
    defaultVariants: {
      environment: "development",
      position: "fixed",
    },
  }
)

type Environment = "development" | "staging" | "production"

interface EnvironmentBannerProps
  extends Omit<React.ComponentProps<"div">, "children">,
    VariantProps<typeof environmentBannerVariants> {
  environment: Environment
  gitSha?: string
  gitBranch?: string
  deployedAt?: string
  appName?: string
  buildId?: string
  envVars?: Record<string, string>
}

function formatRelativeTime(isoTimestamp: string): string {
  const now = Date.now()
  const then = new Date(isoTimestamp).getTime()
  const diffSeconds = Math.round((now - then) / 1000)

  if (Number.isNaN(diffSeconds)) return isoTimestamp

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

  if (Math.abs(diffSeconds) < 60) return rtf.format(-diffSeconds, "second")
  const diffMinutes = Math.round(diffSeconds / 60)
  if (Math.abs(diffMinutes) < 60) return rtf.format(-diffMinutes, "minute")
  const diffHours = Math.round(diffMinutes / 60)
  if (Math.abs(diffHours) < 24) return rtf.format(-diffHours, "hour")
  const diffDays = Math.round(diffHours / 24)
  return rtf.format(-diffDays, "day")
}

function useGlintAnimation(
  ref: React.RefObject<HTMLDivElement | null>,
  environment: Environment
) {
  React.useEffect(() => {
    if (environment === "production") return
    const el = ref.current
    if (!el) return

    function runGlint() {
      if (!el) return
      const glint = document.createElement("div")
      glint.style.cssText = `
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: linear-gradient(
          105deg,
          transparent 0%,
          transparent 10%,
          rgba(255,255,255,0.08) 20%,
          rgba(255,255,255,0.20) 45%,
          rgba(255,255,255,0.25) 50%,
          rgba(255,255,255,0.20) 55%,
          rgba(255,255,255,0.08) 80%,
          transparent 90%,
          transparent 100%
        );
        transform: translateX(-100%);
        z-index: 1;
      `
      el.appendChild(glint)

      const anim = glint.animate(
        [
          { transform: "translateX(-100%)" },
          { transform: "translateX(100%)" },
        ],
        { duration: 800, easing: "ease-in-out" }
      )
      anim.onfinish = () => glint.remove()
    }

    const initialTimeout = setTimeout(runGlint, 5000)
    const interval = setInterval(runGlint, 60000)

    return () => {
      clearTimeout(initialTimeout)
      clearInterval(interval)
    }
  }, [ref, environment])
}

/* ── Isolated copy button with its own state ── */
function CopyButton({
  value,
  message,
}: {
  value: string
  message: string
}) {
  const [copied, setCopied] = React.useState(false)

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(message)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Failed to copy")
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex rounded p-0.5 opacity-40 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-current/30"
      aria-label="Copy to clipboard"
    >
      {copied ? (
        <Check className="h-2.5 w-2.5" />
      ) : (
        <Copy className="h-2.5 w-2.5" />
      )}
    </button>
  )
}

/* ── Pipe separator between inline items ── */
function Pipe() {
  return (
    <span
      className="mx-1.5 inline-block h-[9px] w-px bg-current opacity-25"
      aria-hidden="true"
    />
  )
}

function EnvironmentBanner({
  environment,
  gitSha,
  gitBranch,
  deployedAt,
  appName,
  buildId,
  envVars,
  position,
  className,
  ref: externalRef,
  ...props
}: EnvironmentBannerProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [showEnvVars, setShowEnvVars] = React.useState(true)
  const [mounted, setMounted] = React.useState(false)
  const hoverTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const bannerRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => setMounted(true), [])

  const isFixed = position !== "static"

  useGlintAnimation(bannerRef, environment)

  React.useEffect(() => {
    if (!isFixed || environment === "production") return
    document.documentElement.style.setProperty(
      "--env-banner-h",
      `${ENV_BANNER_H_PX}px`
    )
    return () => {
      document.documentElement.style.removeProperty("--env-banner-h")
    }
  }, [isFixed, environment])

  if (environment === "production") return null

  const label = environment === "staging" ? "STAGING" : "DEV"
  const shortSha = gitSha?.slice(0, 7)

  const envVarEntries = envVars
    ? Object.entries(envVars).sort(([a], [b]) => a.localeCompare(b))
    : []

  function handleMouseEnter() {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    setIsOpen(true)
  }

  function handleMouseLeave() {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsOpen(false)
    }, 200)
  }

  // Collapsed bar: terse status fragments separated by pipes
  const statusParts: string[] = [label]
  if (appName) statusParts.push(appName)
  if (gitBranch) statusParts.push(gitBranch)
  if (shortSha) statusParts.push(shortSha)

  // Expanded: key → value pairs
  const metadataItems = [
    { key: "env", val: environment },
    appName ? { key: "app", val: appName } : null,
    gitBranch ? { key: "branch", val: gitBranch } : null,
    shortSha
      ? { key: "commit", val: shortSha, copyVal: gitSha }
      : null,
    deployedAt
      ? { key: "deployed", val: formatRelativeTime(deployedAt) }
      : null,
    buildId ? { key: "build", val: buildId } : null,
  ].filter(Boolean) as Array<{
    key: string
    val: string
    copyVal?: string
  }>

  function setRefs(el: HTMLDivElement | null) {
    bannerRef.current = el
    if (typeof externalRef === "function") {
      externalRef(el)
    } else if (externalRef) {
      ;(externalRef as React.MutableRefObject<HTMLDivElement | null>).current =
        el
    }
  }

  const collapsedBar = (
    <span className="flex items-center font-mono">
      {statusParts.map((part, i) => (
        <React.Fragment key={i}>
          {i > 0 && <Pipe />}
          <span
            className={
              i === 0 ? "font-semibold" : "opacity-70"
            }
          >
            {part}
          </span>
        </React.Fragment>
      ))}
    </span>
  )

  const bannerClassName = cn(
    environmentBannerVariants({ environment, position }),
    className
  )

  // During SSR, render a simple static bar to avoid Radix useId() hydration mismatch
  if (!mounted) {
    return (
      <>
        <div
          ref={setRefs}
          role="status"
          aria-label={`Environment: ${environment}`}
          data-slot="environment-banner"
          data-environment={environment}
          className={bannerClassName}
          {...props}
        >
          <div className="flex w-full items-center justify-center py-px text-[10px] font-medium tracking-wide">
            {collapsedBar}
          </div>
        </div>
        {isFixed && (
          <div
            style={{ height: ENV_BANNER_H_PX }}
            data-slot="environment-banner-spacer"
            aria-hidden="true"
          />
        )}
      </>
    )
  }

  return (
    <>
      <CollapsiblePrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
        <div
          ref={setRefs}
          role="status"
          aria-label={`Environment: ${environment}`}
          data-slot="environment-banner"
          data-environment={environment}
          className={bannerClassName}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          {...props}
        >
          {/* ── Collapsed bar ── */}
          <CollapsiblePrimitive.CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-center py-px text-[10px] font-medium tracking-wide transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
              aria-expanded={isOpen}
            >
              {collapsedBar}
            </button>
          </CollapsiblePrimitive.CollapsibleTrigger>

          {/* ── Expanded panel ── */}
          <CollapsiblePrimitive.CollapsibleContent
            data-slot="collapsible-content"
            className="overflow-hidden"
          >
            <div className="border-t border-current/10">
              {/* Metadata: status-line style */}
              <div className="flex flex-wrap items-center justify-center px-4 py-1.5 font-mono text-[10px] leading-relaxed">
                {metadataItems.map((item, i) => (
                  <React.Fragment key={item.key}>
                    {i > 0 && <Pipe />}
                    <span className="inline-flex items-center gap-1">
                      <span className="opacity-45">{item.key}</span>
                      <span className="font-semibold">{item.val}</span>
                      {item.copyVal && (
                        <CopyButton
                          value={item.copyVal}
                          message="SHA copied"
                        />
                      )}
                    </span>
                  </React.Fragment>
                ))}
              </div>

              {/* Env vars */}
              {envVarEntries.length > 0 && (
                <div className="border-t border-current/8 px-4 py-1.5">
                  <button
                    type="button"
                    onClick={() => setShowEnvVars((v) => !v)}
                    className="mx-auto flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest opacity-45 transition-opacity hover:opacity-75"
                  >
                    <ChevronDown
                      className={cn(
                        "h-2.5 w-2.5 transition-transform duration-150",
                        !showEnvVars && "-rotate-90"
                      )}
                    />
                    env ({envVarEntries.length})
                  </button>

                  {showEnvVars && (
                    <div className="mx-auto mt-1.5 max-h-52 w-fit overflow-y-auto rounded-sm bg-black/[0.06]">
                      <table className="border-collapse font-mono text-[10px]">
                        <tbody>
                          {envVarEntries.map(([key, value], i) => (
                            <tr
                              key={key}
                              className={
                                i % 2 === 0
                                  ? "bg-transparent"
                                  : "bg-black/[0.04]"
                              }
                            >
                              <td className="whitespace-nowrap py-px pl-2 pr-3 opacity-55">
                                {key}
                              </td>
                              <td className="whitespace-nowrap py-px pr-2">
                                {value || (
                                  <span className="opacity-30">&mdash;</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CollapsiblePrimitive.CollapsibleContent>
        </div>
      </CollapsiblePrimitive.Root>
      {isFixed && (
        <div
          style={{ height: ENV_BANNER_H_PX }}
          data-slot="environment-banner-spacer"
          aria-hidden="true"
        />
      )}
    </>
  )
}

export { EnvironmentBanner, environmentBannerVariants }
export type { EnvironmentBannerProps, Environment }
