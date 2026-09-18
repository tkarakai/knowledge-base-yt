"use client";

import * as React from "react";
import {
  DateTimeWithTimezone,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system";
import { DemoSection } from "@/components/demo-section";

const DEMO_LOCALES = [
  { value: "en-US", label: "English (US)" },
  { value: "de-DE", label: "Deutsch (DE)" },
  { value: "fr-FR", label: "Français (FR)" },
  { value: "ja-JP", label: "日本語 (JP)" },
] as const;

const DEMO_TIMEZONES = [
  { value: "America/Los_Angeles", label: "Los Angeles" },
  { value: "America/New_York", label: "New York" },
  { value: "Europe/Berlin", label: "Berlin" },
  { value: "Asia/Tokyo", label: "Tokyo" },
] as const;

function LocaleTimezoneToolbar({
  locale,
  timeZone,
  onLocaleChange,
  onTimeZoneChange,
}: {
  locale: string;
  timeZone: string;
  onLocaleChange: (value: string) => void;
  onTimeZoneChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Select value={locale} onValueChange={onLocaleChange}>
        <SelectTrigger className="h-7 w-[140px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DEMO_LOCALES.map((entry) => (
            <SelectItem key={entry.value} value={entry.value} className="text-xs">
              {entry.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={timeZone} onValueChange={onTimeZoneChange}>
        <SelectTrigger className="h-7 w-[150px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DEMO_TIMEZONES.map((entry) => (
            <SelectItem key={entry.value} value={entry.value} className="text-xs">
              {entry.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function DateTimeWithTimezoneShowcase() {
  const [locale, setLocale] = React.useState("en-US");
  const [timeZone, setTimeZone] = React.useState("America/Los_Angeles");

  // Fixed UTC instant so locale/timezone changes are easy to compare.
  const comparisonInstant = Date.UTC(2026, 5, 18, 21, 35, 0);
  const withTime = new Date(2026, 5, 18, 14, 35).getTime();
  const dateOnly = new Date(2026, 5, 18, 0, 0, 0).getTime();

  return (
    <>
      <DemoSection
        title="Locale + Timezone Formatting"
        description="Same exact timestamp, formatted by selected locale and timezone. Locale changes style (order/clock), timezone changes the represented local time."
        toolbar={
          <LocaleTimezoneToolbar
            locale={locale}
            timeZone={timeZone}
            onLocaleChange={setLocale}
            onTimeZoneChange={setTimeZone}
          />
        }
      >
        <div className="max-w-sm space-y-2">
          <Label>Exact moment</Label>
          <DateTimeWithTimezone
            value={comparisonInstant}
            locale={locale}
            timeZone={timeZone}
            mode="datetime"
          />
        </div>
      </DemoSection>

      <DemoSection
        title="Date + Time + Timezone"
        description='Displays the formatted date/time plus a two-line timezone block ("City" and "(GMT offset)").'
      >
        <div className="max-w-sm space-y-2">
          <Label>Published at</Label>
          <DateTimeWithTimezone
            value={withTime}
            locale={locale}
            timeZone="America/Los_Angeles"
          />
        </div>
      </DemoSection>

      <DemoSection
        title="Date Only (Forced)"
        description='Use `mode="date"` when the value should always render as a date.'
      >
        <div className="max-w-sm space-y-2">
          <Label>Starts on</Label>
          <DateTimeWithTimezone
            value={dateOnly}
            locale={locale}
            timeZone="Europe/Berlin"
            mode="date"
          />
        </div>
      </DemoSection>

      <DemoSection
        title="Narrow Layout"
        description="Timezone text is constrained to 65px and truncates with ellipsis when needed."
      >
        <div className="max-w-[220px] space-y-2">
          <Label>Deadline</Label>
          <DateTimeWithTimezone
            value={withTime}
            locale={locale}
            timeZone="America/Argentina/Buenos_Aires"
          />
        </div>
      </DemoSection>

      <DemoSection
        title="One-line Timezone"
        description='Set `timezoneLineMode="one-line"` to render timezone as a single line with max width 130px.'
      >
        <div className="max-w-[320px] space-y-2">
          <Label>Last updated</Label>
          <DateTimeWithTimezone
            value={comparisonInstant}
            locale={locale}
            timeZone="America/Argentina/Buenos_Aires"
            mode="datetime"
            timezoneLineMode="one-line"
          />
        </div>
      </DemoSection>

      <DemoSection
        title="Timezone Below Date/Time"
        description='Set `timezonePlacement="below"` to render timezone text underneath the main date/time with compact line spacing.'
      >
        <div className="max-w-[280px] space-y-2">
          <Label>Release window</Label>
          <DateTimeWithTimezone
            value={comparisonInstant}
            locale={locale}
            timeZone="America/Argentina/Buenos_Aires"
            mode="datetime"
            timezoneLineMode="one-line"
            timezonePlacement="below"
          />
        </div>
      </DemoSection>
    </>
  );
}
