"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "../../lib/utils"
import { Button } from "../actions/button"
import { Input } from "./input"
import { Popover, PopoverContent, PopoverTrigger } from "../overlay/popover"

/* ─── Types ─── */

export type TimezoneEntry = {
  /** IANA timezone identifier, e.g. "America/New_York" */
  value: string
  /** Display label, e.g. "New York" */
  label: string
}

export type TimezoneGroup = {
  /** Region heading, e.g. "Americas" */
  region: string
  /** Timezone entries within this region */
  zones: TimezoneEntry[]
}

export type TimezoneSelectorProps = {
  /** Currently selected IANA timezone value */
  value: string
  /** Called when the user selects a timezone */
  onValueChange: (value: string) => void
  /** Placeholder text shown when no timezone is selected */
  placeholder?: string
  /** Placeholder text for the search input */
  searchPlaceholder?: string
  /** Label shown above the auto-detected timezone suggestion */
  detectedLabel?: string
  /** Text shown when search yields no results */
  noResultsText?: string
  /** Custom timezone groups. Falls back to a built-in curated list. */
  groups?: TimezoneGroup[]
  /** Additional class names for the trigger button */
  className?: string
  /** Whether the selector is disabled */
  disabled?: boolean
}

/* ─── Built-in curated timezone list ─── */

const CURATED_TIMEZONES: TimezoneGroup[] = [
  {
    region: "Americas",
    zones: [
      { value: "America/New_York", label: "New York" },
      { value: "America/Chicago", label: "Chicago" },
      { value: "America/Denver", label: "Denver" },
      { value: "America/Los_Angeles", label: "Los Angeles" },
      { value: "America/Anchorage", label: "Anchorage" },
      { value: "Pacific/Honolulu", label: "Honolulu" },
      { value: "America/Phoenix", label: "Phoenix" },
      { value: "America/Toronto", label: "Toronto" },
      { value: "America/Vancouver", label: "Vancouver" },
      { value: "America/Mexico_City", label: "Mexico City" },
      { value: "America/Sao_Paulo", label: "S\u00e3o Paulo" },
      { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires" },
      { value: "America/Bogota", label: "Bogota" },
      { value: "America/Lima", label: "Lima" },
      { value: "America/Santiago", label: "Santiago" },
    ],
  },
  {
    region: "Europe",
    zones: [
      { value: "Europe/London", label: "London" },
      { value: "Europe/Paris", label: "Paris" },
      { value: "Europe/Berlin", label: "Berlin" },
      { value: "Europe/Madrid", label: "Madrid" },
      { value: "Europe/Rome", label: "Rome" },
      { value: "Europe/Amsterdam", label: "Amsterdam" },
      { value: "Europe/Brussels", label: "Brussels" },
      { value: "Europe/Vienna", label: "Vienna" },
      { value: "Europe/Warsaw", label: "Warsaw" },
      { value: "Europe/Prague", label: "Prague" },
      { value: "Europe/Budapest", label: "Budapest" },
      { value: "Europe/Bucharest", label: "Bucharest" },
      { value: "Europe/Athens", label: "Athens" },
      { value: "Europe/Helsinki", label: "Helsinki" },
      { value: "Europe/Stockholm", label: "Stockholm" },
      { value: "Europe/Moscow", label: "Moscow" },
      { value: "Europe/Istanbul", label: "Istanbul" },
      { value: "Europe/Lisbon", label: "Lisbon" },
      { value: "Europe/Dublin", label: "Dublin" },
      { value: "Europe/Zurich", label: "Zurich" },
    ],
  },
  {
    region: "Asia & Pacific",
    zones: [
      { value: "Asia/Tokyo", label: "Tokyo" },
      { value: "Asia/Shanghai", label: "Shanghai" },
      { value: "Asia/Hong_Kong", label: "Hong Kong" },
      { value: "Asia/Singapore", label: "Singapore" },
      { value: "Asia/Seoul", label: "Seoul" },
      { value: "Asia/Taipei", label: "Taipei" },
      { value: "Asia/Bangkok", label: "Bangkok" },
      { value: "Asia/Jakarta", label: "Jakarta" },
      { value: "Asia/Manila", label: "Manila" },
      { value: "Asia/Ho_Chi_Minh", label: "Ho Chi Minh" },
      { value: "Asia/Kolkata", label: "Delhi / Mumbai / Kolkata" },
      { value: "Asia/Dubai", label: "Dubai" },
      { value: "Australia/Sydney", label: "Sydney" },
      { value: "Australia/Melbourne", label: "Melbourne" },
      { value: "Pacific/Auckland", label: "Auckland" },
      { value: "Pacific/Fiji", label: "Fiji" },
    ],
  },
  {
    region: "Africa",
    zones: [
      { value: "Africa/Cairo", label: "Cairo" },
      { value: "Africa/Johannesburg", label: "Johannesburg" },
      { value: "Africa/Lagos", label: "Lagos" },
      { value: "Africa/Nairobi", label: "Nairobi" },
      { value: "Africa/Casablanca", label: "Casablanca" },
    ],
  },
]

/* ─── Helpers ─── */

type ResolvedEntry = TimezoneEntry & { offset: string; hasDST: boolean }
type ResolvedGroup = { region: string; timezones: ResolvedEntry[] }

function getUtcOffset(tz: string): string {
  try {
    const now = new Date()
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(now)
    const offsetPart = parts.find((p) => p.type === "timeZoneName")
    return offsetPart?.value ?? ""
  } catch {
    return ""
  }
}

function getOffsetAt(tz: string, date: Date): string {
  try {
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

function observesDST(tz: string): boolean {
  const jan = new Date(new Date().getFullYear(), 0, 1)
  const jul = new Date(new Date().getFullYear(), 6, 1)
  return getOffsetAt(tz, jan) !== getOffsetAt(tz, jul)
}

function resolveGroups(groups: TimezoneGroup[]): ResolvedGroup[] {
  return groups.map((g) => ({
    region: g.region,
    timezones: g.zones.map((z) => ({
      ...z,
      offset: getUtcOffset(z.value),
      hasDST: observesDST(z.value),
    })),
  }))
}

function detectUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return ""
  }
}

/* ─── Component ─── */

function TimezoneSelector({
  value,
  onValueChange,
  placeholder = "Select timezone",
  searchPlaceholder = "Search timezones...",
  detectedLabel = "Detected",
  noResultsText = "No timezone found.",
  groups,
  className,
  disabled,
}: TimezoneSelectorProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const resolvedGroups = React.useMemo(
    () => resolveGroups(groups ?? CURATED_TIMEZONES),
    [groups],
  )

  const detectedTimezone = React.useMemo(() => detectUserTimezone(), [])

  // Display label for the trigger
  const selectedDisplay = React.useMemo(() => {
    for (const group of resolvedGroups) {
      const entry = group.timezones.find((tz) => tz.value === value)
      if (entry) return `${entry.label} (${entry.offset})`
    }
    return value ? value.replace(/_/g, " ") : ""
  }, [value, resolvedGroups])

  // Filtered groups based on search
  const filteredGroups = React.useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return resolvedGroups
    return resolvedGroups
      .map((group) => ({
        ...group,
        timezones: group.timezones.filter(
          (tz) =>
            tz.label.toLowerCase().includes(q) ||
            tz.value.toLowerCase().includes(q) ||
            tz.offset.toLowerCase().includes(q) ||
            (q === "dst" && tz.hasDST),
        ),
      }))
      .filter((group) => group.timezones.length > 0)
  }, [search, resolvedGroups])

  // Detected timezone entry
  const detectedEntry = React.useMemo(() => {
    for (const group of resolvedGroups) {
      const entry = group.timezones.find((tz) => tz.value === detectedTimezone)
      if (entry) return entry
    }
    return null
  }, [detectedTimezone, resolvedGroups])

  const handleSelect = (tzValue: string) => {
    onValueChange(tzValue)
    setOpen(false)
    setSearch("")
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("flex w-full justify-between font-normal", className)}
        >
          <span className="truncate">
            {value ? selectedDisplay : placeholder}
          </span>
          <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <div className="p-2">
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
        </div>
        <div className="max-h-64 overflow-y-auto px-1 pb-1">
          {/* Detected timezone at the top */}
          {detectedEntry && !search && detectedEntry.value !== value && (
            <div className="px-1 pb-1">
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
                {detectedLabel}
              </p>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                onClick={() => handleSelect(detectedEntry.value)}
              >
                <Check
                  className={cn(
                    "h-4 w-4 shrink-0",
                    value === detectedEntry.value
                      ? "opacity-100"
                      : "opacity-0",
                  )}
                />
                <span className="flex-1 text-start">
                  {detectedEntry.label}
                </span>
                {detectedEntry.hasDST && (
                  <span className="rounded bg-muted px-1 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
                    DST
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {detectedEntry.offset}
                </span>
              </button>
            </div>
          )}
          {filteredGroups.map((group) => (
            <div key={group.region} className="px-1 pb-1">
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
                {group.region}
              </p>
              {group.timezones.map((tz) => (
                <button
                  key={tz.value}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                  onClick={() => handleSelect(tz.value)}
                >
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      value === tz.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="flex-1 text-start">{tz.label}</span>
                  {tz.hasDST && (
                    <span className="rounded bg-muted px-1 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
                      DST
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {tz.offset}
                  </span>
                </button>
              ))}
            </div>
          ))}
          {filteredGroups.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {noResultsText}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { TimezoneSelector, CURATED_TIMEZONES }
