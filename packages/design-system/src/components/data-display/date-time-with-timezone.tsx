"use client"

import * as React from "react"

import { cn } from "../../lib/utils"
import { CURATED_TIMEZONES } from "../form/timezone-selector"

type DisplayMode = "auto" | "date" | "datetime"
type TimezoneLineMode = "two-line" | "one-line"
type TimezonePlacement = "inline" | "below"

type TimezoneDisplay = {
  label: string
  offset: string
}

function detectBrowserTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return undefined
  }
}

function getNumberPart(
  parts: Intl.DateTimeFormatPart[],
  type: "hour" | "minute" | "second",
): number {
  const value = parts.find((part) => part.type === type)?.value
  return value ? parseInt(value, 10) : 0
}

function getTimeParts(
  value: number,
  timeZone?: string,
): { hour: number; minute: number; second: number } {
  const date = new Date(value)
  if (!timeZone) {
    return {
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
    }
  }

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date)
    return {
      hour: getNumberPart(parts, "hour"),
      minute: getNumberPart(parts, "minute"),
      second: getNumberPart(parts, "second"),
    }
  } catch {
    return {
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
    }
  }
}

function resolveDisplayMode(
  value: number,
  mode: DisplayMode,
  timeZone?: string,
): "date" | "datetime" {
  if (mode === "date" || mode === "datetime") return mode
  const parts = getTimeParts(value, timeZone)
  return parts.hour === 0 && parts.minute === 0 && parts.second === 0
    ? "date"
    : "datetime"
}

function formatDisplay(
  value: number,
  locale: string,
  mode: "date" | "datetime",
  timeZone?: string,
): string {
  const date = new Date(value)
  if (mode === "date") {
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone,
    }).format(date)
  }
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(date)
}

function getUtcOffset(tz: string, value?: number): string {
  try {
    const date = value !== undefined ? new Date(value) : new Date()
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(date)
    const offsetPart = parts.find((p) => p.type === "timeZoneName")
    return offsetPart?.value ?? ""
  } catch {
    return ""
  }
}

function getTimezoneDisplay(
  timeZone?: string,
  value?: number,
): TimezoneDisplay | undefined {
  if (!timeZone) return undefined
  const label =
    CURATED_TIMEZONES.flatMap((group) => group.zones).find(
      (zone) => zone.value === timeZone,
    )?.label ?? timeZone.replace(/_/g, " ")

  try {
    return {
      label,
      offset: getUtcOffset(timeZone, value),
    }
  } catch {
    return { label, offset: "" }
  }
}

export type DateTimeWithTimezoneProps = {
  /** UTC timestamp in milliseconds (or Date), or undefined for no value */
  value: number | Date | undefined
  /** Locale used for formatting date/time text */
  locale?: string
  /** IANA timezone used for display */
  timeZone?: string
  /** Auto-detect whether to show time; can be forced to date or datetime */
  mode?: DisplayMode
  /** Placeholder shown when value is undefined */
  placeholder?: string
  /** Timezone text layout */
  timezoneLineMode?: TimezoneLineMode
  /** Place timezone text beside or under the date/time text */
  timezonePlacement?: TimezonePlacement
  /** Additional wrapper className */
  className?: string
}

function DateTimeWithTimezone({
  value,
  locale = "en",
  timeZone,
  mode = "auto",
  placeholder = "No date",
  timezoneLineMode = "two-line",
  timezonePlacement = "inline",
  className,
}: DateTimeWithTimezoneProps) {
  const browserTimeZone = React.useMemo(() => detectBrowserTimeZone(), [])
  const effectiveTimeZone = timeZone ?? browserTimeZone
  const timestamp =
    value instanceof Date ? value.getTime() : value

  const resolvedMode =
    timestamp !== undefined
      ? resolveDisplayMode(timestamp, mode, effectiveTimeZone)
      : "date"
  const displayText =
    timestamp !== undefined
      ? formatDisplay(timestamp, locale, resolvedMode, effectiveTimeZone)
      : placeholder
  const timezoneDisplay =
    timestamp !== undefined
      ? getTimezoneDisplay(effectiveTimeZone, timestamp)
      : undefined

  const timezoneLabel =
    timezoneDisplay && timezoneDisplay.offset
      ? `${timezoneDisplay.label} (${timezoneDisplay.offset})`
      : timezoneDisplay?.label

  return (
    <div
      className={cn(
        "flex min-w-0",
        timezonePlacement === "inline"
          ? "items-center gap-2"
          : "flex-col items-start gap-0.5",
        className,
      )}
    >
      <span
        className={cn(
          "min-w-0 shrink truncate",
          timestamp === undefined && "text-muted-foreground",
        )}
      >
        {displayText}
      </span>
      {timezoneDisplay && (
        timezoneLineMode === "one-line" ? (
          <div
            className={cn(
              "text-left text-[11px] text-muted-foreground",
              timezonePlacement === "inline"
                ? "max-w-[130px] shrink-0"
                : "max-w-full leading-[1.05]",
            )}
          >
            <span className="block truncate">{timezoneLabel}</span>
          </div>
        ) : (
          <div
            className={cn(
              "text-left text-[11px] text-muted-foreground",
              timezonePlacement === "inline"
                ? "w-[65px] shrink-0 leading-[1.1]"
                : "w-full leading-[1.05]",
            )}
          >
            <span className="block truncate">{timezoneDisplay.label}</span>
            {timezoneDisplay.offset && (
              <span className="block truncate">({timezoneDisplay.offset})</span>
            )}
          </div>
        )
      )}
    </div>
  )
}

DateTimeWithTimezone.displayName = "DateTimeWithTimezone"

export { DateTimeWithTimezone }
