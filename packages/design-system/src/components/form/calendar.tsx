"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "../../lib/utils"
import { Button } from "../actions/button"

/* ─── Locale helpers ─── */

function getFirstDayOfWeek(locale: string): number {
  try {
    const loc = new Intl.Locale(locale)
    // getWeekInfo() is the standard; weekInfo is the V8 non-standard fallback
    const info =
      (loc as { getWeekInfo?: () => { firstDay: number } }).getWeekInfo?.() ??
      (loc as unknown as { weekInfo?: { firstDay: number } }).weekInfo
    if (info?.firstDay) {
      // Intl: 1=Mon … 7=Sun → JS: 0=Sun 1=Mon … 6=Sat
      return info.firstDay === 7 ? 0 : info.firstDay
    }
  } catch {
    /* ignore */
  }
  // Fallback heuristic: Sunday-start locales
  return /^(en|ja|ko|zh|pt-BR)/i.test(locale) ? 0 : 1
}

function getWeekdayNames(locale: string, firstDay: number): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" })
  const names: string[] = []
  for (let i = 0; i < 7; i++) {
    // 2024-01-07 is a Sunday (day 0)
    const d = new Date(2024, 0, 7 + ((firstDay + i) % 7))
    names.push(fmt.format(d))
  }
  return names
}

function getMonthYearLabel(locale: string, date: Date): string {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(date)
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/* ─── Grid generation ─── */

type CalendarGrid = (Date | null)[][]

function buildGrid(year: number, month: number, firstDay: number): CalendarGrid {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  let offset = new Date(year, month, 1).getDay() - firstDay
  if (offset < 0) offset += 7

  const weeks: CalendarGrid = []
  let week: (Date | null)[] = []

  for (let i = 0; i < offset; i++) week.push(null)

  for (let day = 1; day <= daysInMonth; day++) {
    week.push(new Date(year, month, day))
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
  }

  if (week.length > 0) {
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }

  return weeks
}

/* ─── Component ─── */

export type CalendarProps = {
  /** Currently selected date */
  selected?: Date
  /** Called when a day is clicked */
  onSelect?: (date: Date) => void
  /** BCP 47 locale string (e.g. "en", "de", "ja") */
  locale?: string
  className?: string
}

function Calendar({
  selected,
  onSelect,
  locale = "en",
  className,
}: CalendarProps) {
  const [viewDate, setViewDate] = React.useState(
    () => selected ?? new Date()
  )

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const today = new Date()
  const firstDay = getFirstDayOfWeek(locale)
  const weekdays = getWeekdayNames(locale, firstDay)
  const grid = buildGrid(year, month, firstDay)
  const caption = getMonthYearLabel(locale, viewDate)

  const goPrev = () => setViewDate(new Date(year, month - 1, 1))
  const goNext = () => setViewDate(new Date(year, month + 1, 1))

  // Sync view to selected date when it changes externally
  React.useEffect(() => {
    if (selected) {
      setViewDate(new Date(selected.getFullYear(), selected.getMonth(), 1))
    }
  }, [selected?.getTime()]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={cn("p-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0 opacity-50 hover:opacity-100"
          onClick={goPrev}
          type="button"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium capitalize">{caption}</span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0 opacity-50 hover:opacity-100"
          onClick={goNext}
          type="button"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {weekdays.map((name, i) => (
          <div
            key={i}
            className="text-center text-[0.75rem] font-normal text-muted-foreground py-1"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Day grid */}
      {grid.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7">
          {week.map((day, di) => {
            if (!day) {
              return <div key={di} className="p-0.5" />
            }

            const isSelected = selected ? isSameDay(day, selected) : false
            const isToday = isSameDay(day, today)

            return (
              <div key={di} className="p-0.5">
                <button
                  type="button"
                  onClick={() => onSelect?.(day)}
                  className={cn(
                    "inline-flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isSelected &&
                      "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                    !isSelected &&
                      isToday &&
                      "bg-accent text-accent-foreground",
                  )}
                >
                  {day.getDate()}
                </button>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

Calendar.displayName = "Calendar"

export { Calendar }
