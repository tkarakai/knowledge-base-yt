"use client"

import * as React from "react"
import { WifiOff } from "lucide-react"
import { cn } from "../../lib/utils"
import { useNetworkStatus } from "../../hooks/use-network-status"

interface OfflineBannerProps {
  className?: string
  label?: string
}

const defaultLabel = "You appear to be offline. An active connection is needed to continue."

function OfflineBanner({ className, label }: OfflineBannerProps) {
  const isOnline = useNetworkStatus()
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    if (!isOnline) {
      const id = window.requestAnimationFrame(() => setVisible(true))
      return () => window.cancelAnimationFrame(id)
    }
    setVisible(false)
  }, [isOnline])

  if (isOnline) return null

  return (
    <div
      role="alert"
      aria-live="polite"
      data-slot="offline-banner"
      className={cn(
        "fixed left-0 right-0 top-[var(--env-banner-h,0px)] z-[9998]",
        "flex items-center justify-center gap-2 px-4 py-2",
        "text-offline-foreground text-sm font-medium",
        "bg-offline/95 backdrop-blur supports-[backdrop-filter]:bg-offline/60",
        "[transition:opacity_300ms_cubic-bezier(0.4,0,0.2,1)]",
        visible ? "opacity-95" : "opacity-0",
        className,
      )}
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>{label ?? defaultLabel}</span>
    </div>
  )
}

export { OfflineBanner }
export type { OfflineBannerProps }
