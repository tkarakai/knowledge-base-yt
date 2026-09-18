"use client";

import * as React from "react";
import {
  DateTimePicker,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system";
import { DemoSection } from "@/components/demo-section";

const DEMO_LOCALES = [
  { value: "en", label: "English (US)" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
  { value: "ja", label: "日本語" },
  { value: "ar", label: "العربية" },
  { value: "hu", label: "Magyar" },
  { value: "zh", label: "中文" },
] as const;

function LocaleToolbar({
  locale,
  onLocaleChange,
}: {
  locale: string;
  onLocaleChange: (locale: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Locale:</span>
      <Select value={locale} onValueChange={onLocaleChange}>
        <SelectTrigger className="h-7 w-[140px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DEMO_LOCALES.map((l) => (
            <SelectItem key={l.value} value={l.value} className="text-xs">
              {l.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function DateTimePickerShowcase() {
  const [locale1, setLocale1] = React.useState("en");
  const [value1, setValue1] = React.useState<number | undefined>(undefined);

  const [locale2, setLocale2] = React.useState("de");
  const [value2, setValue2] = React.useState<number | undefined>(
    () => new Date(2026, 2, 15, 14, 30).getTime(),
  );

  const [locale3, setLocale3] = React.useState("en");
  const [value3, setValue3] = React.useState<number | undefined>(undefined);

  const [locale4, setLocale4] = React.useState("ja");
  const [value4, setValue4] = React.useState<number | undefined>(
    () => new Date(2026, 5, 1).getTime(),
  );

  return (
    <>
      <DemoSection
        title="Date & Time (default)"
        description="Calendar with locale-aware weekday names, first day of week, month names, and a time selector that adapts between 12h (AM/PM) and 24h clock based on the selected locale. Switch the locale to see the calendar and time controls change."
        toolbar={
          <LocaleToolbar locale={locale1} onLocaleChange={setLocale1} />
        }
      >
        <div className="max-w-sm space-y-2">
          <Label>Deadline</Label>
          <DateTimePicker
            value={value1}
            onChange={setValue1}
            locale={locale1}
            placeholder="Pick a date and time"
          />
        </div>
      </DemoSection>

      <DemoSection
        title="Pre-selected Value"
        description="When a value is already set, the trigger shows the formatted date and time. The clear button removes the selection. Try switching between locales to see how the same timestamp is formatted differently."
        toolbar={
          <LocaleToolbar locale={locale2} onLocaleChange={setLocale2} />
        }
      >
        <div className="max-w-sm space-y-2">
          <Label>Event date</Label>
          <DateTimePicker
            value={value2}
            onChange={setValue2}
            locale={locale2}
            placeholder="Select date and time"
          />
        </div>
      </DemoSection>

      <DemoSection
        title="Date Only"
        description='With mode="date", only the calendar is shown — no time selects. Useful for deadlines, birthdays, or any field that only needs a date.'
        toolbar={
          <LocaleToolbar locale={locale3} onLocaleChange={setLocale3} />
        }
      >
        <div className="max-w-sm space-y-2">
          <Label>Due date</Label>
          <DateTimePicker
            value={value3}
            onChange={setValue3}
            mode="date"
            locale={locale3}
            placeholder="Pick a date"
          />
        </div>
      </DemoSection>

      <DemoSection
        title="Non-clearable"
        description="Set clearable={false} to hide the clear button. Useful when a date value is always required."
        toolbar={
          <LocaleToolbar locale={locale4} onLocaleChange={setLocale4} />
        }
      >
        <div className="max-w-sm space-y-2">
          <Label>Start date</Label>
          <DateTimePicker
            value={value4}
            onChange={setValue4}
            mode="date"
            locale={locale4}
            placeholder="Pick a date"
            clearable={false}
          />
        </div>
      </DemoSection>
    </>
  );
}
