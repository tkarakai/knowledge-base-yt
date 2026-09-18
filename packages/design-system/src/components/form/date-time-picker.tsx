"use client"

import * as React from "react"
import { CalendarDays, X } from "lucide-react"

import { cn } from "../../lib/utils"
import { Button } from "../actions/button"
import { Popover, PopoverContent, PopoverTrigger } from "../overlay/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select"
import { Calendar } from "./calendar"
import { CURATED_TIMEZONES } from "./timezone-selector"

/* ─── Locale helpers ─── */

function usesAmPm(locale: string): boolean {
  const resolved = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
  }).resolvedOptions()
  return resolved.hour12 === true
}

function detectBrowserTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return undefined
  }
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

/* ─── Time helpers ─── */

type DateParts = {
  year: number
  month: number
  day: number
}

type DateTimeParts = DateParts & {
  hour: number
  minute: number
}

type DateTimePartType =
  | "year"
  | "month"
  | "day"
  | "hour"
  | "minute"
  | "second"

function getNumberPart(
  parts: Intl.DateTimeFormatPart[],
  type: DateTimePartType,
): number {
  const value = parts.find((part) => part.type === type)?.value
  return value ? parseInt(value, 10) : 0
}

function getDateTimeParts(value: number, timeZone?: string): DateTimeParts {
  const date = new Date(value)
  if (!timeZone) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
    }
  }

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date)

    return {
      year: getNumberPart(parts, "year"),
      month: getNumberPart(parts, "month"),
      day: getNumberPart(parts, "day"),
      hour: getNumberPart(parts, "hour"),
      minute: getNumberPart(parts, "minute"),
    }
  } catch {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
    }
  }
}

function getTimeZoneOffsetMs(value: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value))

  const year = getNumberPart(parts, "year")
  const month = getNumberPart(parts, "month")
  const day = getNumberPart(parts, "day")
  const hour = getNumberPart(parts, "hour")
  const minute = getNumberPart(parts, "minute")
  const second = getNumberPart(parts, "second")
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second)
  return asUtc - value
}

function buildTimestampFromParts(parts: DateTimeParts, timeZone?: string): number {
  const { year, month, day, hour, minute } = parts
  if (!timeZone) {
    return new Date(year, month - 1, day, hour, minute, 0, 0).getTime()
  }

  try {
    const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0, 0)
    const offsetAtGuess = getTimeZoneOffsetMs(utcGuess, timeZone)
    let timestamp = utcGuess - offsetAtGuess
    const offsetAtResolved = getTimeZoneOffsetMs(timestamp, timeZone)
    if (offsetAtResolved !== offsetAtGuess) {
      timestamp = utcGuess - offsetAtResolved
    }
    return timestamp
  } catch {
    return new Date(year, month - 1, day, hour, minute, 0, 0).getTime()
  }
}

function toCalendarDate(parts: DateParts): Date {
  return new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0)
}

type TimezoneDisplay = {
  label: string
  offset: string
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

function roundToFive(n: number): number {
  const rounded = Math.round(n / 5) * 5
  return rounded === 60 ? 55 : rounded
}

function extractTimeParts(
  hour24: number,
  minuteValue: number,
  is12h: boolean,
): { hour: number; minute: number; period: "AM" | "PM" } {
  const h = hour24
  const minute = roundToFive(minuteValue)
  if (!is12h) return { hour: h, minute, period: h < 12 ? "AM" : "PM" }
  const period: "AM" | "PM" = h < 12 ? "AM" : "PM"
  let hour = h % 12
  if (hour === 0) hour = 12
  return { hour, minute, period }
}

function toHour24(hour: number, period: "AM" | "PM", is12h: boolean): number {
  if (!is12h) return hour
  if (period === "AM") return hour === 12 ? 0 : hour
  return hour === 12 ? 12 : hour + 12
}

/* ─── Component ─── */

export type DateTimePickerProps = {
  /** UTC timestamp in milliseconds, or undefined for no selection */
  value: number | undefined
  /** Called with the new UTC timestamp, or undefined when cleared */
  onChange: (value: number | undefined) => void
  /** "datetime" shows calendar + time selects; "date" shows calendar only */
  mode?: "date" | "datetime"
  /** BCP 47 locale string (e.g. "en", "de", "ja"). Defaults to "en". */
  locale?: string
  /** IANA timezone for display formatting (e.g. "America/New_York") */
  timeZone?: string
  /** IANA timezone used for date/time selection and value conversion */
  pickerTimeZone?: string
  /** Placeholder text when no date is selected */
  placeholder?: string
  /** Show a clear button when a value is set. Defaults to true. */
  clearable?: boolean
  /** Aria label for the clear button */
  clearLabel?: string
  /** Additional className for the trigger button */
  className?: string
}

function DateTimePicker({
  value,
  onChange,
  mode = "datetime",
  locale = "en",
  timeZone,
  pickerTimeZone,
  placeholder = "Pick a date",
  clearable = true,
  clearLabel = "Clear",
  className,
}: DateTimePickerProps) {
  const browserTimeZone = React.useMemo(() => detectBrowserTimeZone(), [])
  const displayTimeZone = timeZone ?? browserTimeZone
  const selectionTimeZone = pickerTimeZone ?? displayTimeZone
  const is12h = mode === "datetime" ? usesAmPm(locale) : false

  const selectedDateTimeParts =
    value !== undefined ? getDateTimeParts(value, selectionTimeZone) : undefined
  const selectedDate = selectedDateTimeParts
    ? toCalendarDate(selectedDateTimeParts)
    : undefined
  const selectedDayParts = selectedDateTimeParts
    ? {
        year: selectedDateTimeParts.year,
        month: selectedDateTimeParts.month,
        day: selectedDateTimeParts.day,
      }
    : undefined
  const timeParts = selectedDateTimeParts
    ? extractTimeParts(selectedDateTimeParts.hour, selectedDateTimeParts.minute, is12h)
    : { hour: is12h ? 12 : 0, minute: 0, period: "AM" as const }

  const [hour, setHour] = React.useState(timeParts.hour)
  const [minute, setMinute] = React.useState(timeParts.minute)
  const [period, setPeriod] = React.useState<"AM" | "PM">(timeParts.period)

  // Sync local time state when value changes externally
  React.useEffect(() => {
    if (selectedDateTimeParts) {
      const parts = extractTimeParts(
        selectedDateTimeParts.hour,
        selectedDateTimeParts.minute,
        is12h,
      )
      setHour(parts.hour)
      setMinute(parts.minute)
      setPeriod(parts.period)
    }
  }, [value, is12h, selectionTimeZone]) // eslint-disable-line react-hooks/exhaustive-deps

  const buildTimestamp = (
    date: DateParts,
    h: number,
    m: number,
    p: "AM" | "PM",
  ) => {
    if (mode === "date") {
      return buildTimestampFromParts(
        {
          ...date,
          hour: 0,
          minute: 0,
        },
        selectionTimeZone,
      )
    }

    return buildTimestampFromParts(
      {
        ...date,
        hour: toHour24(h, p, is12h),
        minute: m,
      },
      selectionTimeZone,
    )
  }

  const handleDaySelect = (day: Date) => {
    const dayParts = {
      year: day.getFullYear(),
      month: day.getMonth() + 1,
      day: day.getDate(),
    }
    onChange(buildTimestamp(dayParts, hour, minute, period))
  }

  const handleHourChange = (val: string) => {
    const h = parseInt(val, 10)
    setHour(h)
    if (selectedDayParts) {
      onChange(buildTimestamp(selectedDayParts, h, minute, period))
    }
  }

  const handleMinuteChange = (val: string) => {
    const m = parseInt(val, 10)
    setMinute(m)
    if (selectedDayParts) {
      onChange(buildTimestamp(selectedDayParts, hour, m, period))
    }
  }

  const handlePeriodChange = (p: string) => {
    const newPeriod = p as "AM" | "PM"
    setPeriod(newPeriod)
    if (selectedDayParts) {
      onChange(buildTimestamp(selectedDayParts, hour, minute, newPeriod))
    }
  }

  const hours = is12h
    ? [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    : Array.from({ length: 24 }, (_, i) => i)

  const minutes = Array.from({ length: 12 }, (_, i) => i * 5)

  const displayText = value
    ? formatDisplay(value, locale, mode, displayTimeZone)
    : placeholder
  const displayTimezoneDisplay = getTimezoneDisplay(displayTimeZone, value)
  const selectionTimezoneDisplay = getTimezoneDisplay(selectionTimeZone, value)

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "justify-start text-left font-normal",
              !value && "text-muted-foreground",
              className,
            )}
          >
            <CalendarDays className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{displayText}</span>
            {value && displayTimezoneDisplay && (
              <div className="ml-0 max-w-[65px] shrink-0 text-left text-[11px] leading-[1.1] text-muted-foreground">
                <span className="block truncate">{displayTimezoneDisplay.label}</span>
                {displayTimezoneDisplay.offset && (
                  <span className="block truncate">
                    ({displayTimezoneDisplay.offset})
                  </span>
                )}
              </div>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            selected={selectedDate}
            onSelect={handleDaySelect}
            locale={locale}
          />

          {mode === "datetime" && (
            <div className="border-t border-border px-3 py-3">
              <div className="flex min-w-0 items-center gap-1.5">
                <Select value={String(hour)} onValueChange={handleHourChange}>
                  <SelectTrigger className="h-8 w-[60px] shrink-0 tabular-nums">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {hours.map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {String(h).padStart(2, "0")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm font-medium text-muted-foreground">
                  :
                </span>
                <Select
                  value={String(minute)}
                  onValueChange={handleMinuteChange}
                >
                  <SelectTrigger className="h-8 w-[60px] shrink-0 tabular-nums">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {minutes.map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {String(m).padStart(2, "0")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {is12h && (
                  <Select value={period} onValueChange={handlePeriodChange}>
                    <SelectTrigger className="h-8 w-[62px] shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AM">AM</SelectItem>
                      <SelectItem value="PM">PM</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {selectionTimezoneDisplay && (
                  <div className="ml-auto min-w-0 max-w-[100px] pl-3 text-left text-xs leading-[1.1] text-muted-foreground">
                    <span className="block truncate">
                      {selectionTimezoneDisplay.label}
                    </span>
                    {selectionTimezoneDisplay.offset && (
                      <span className="block truncate">
                        ({selectionTimezoneDisplay.offset})
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {clearable && value !== undefined && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 w-9 shrink-0 p-0"
          onClick={() => onChange(undefined)}
          aria-label={clearLabel}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

DateTimePicker.displayName = "DateTimePicker"

export { DateTimePicker }
