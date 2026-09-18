"use client";

import { useLocale, useTranslations } from "next-intl";

import { DateTimePicker, Label } from "@repo/design-system";

type DeadlineInputProps = {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  timeZone?: string;
};

export function DeadlineInput({ value, onChange, timeZone }: DeadlineInputProps) {
  const t = useTranslations("tasks");
  const locale = useLocale();

  return (
    <div className="space-y-2">
      <Label>{t("fields.deadline")}</Label>
      <DateTimePicker
        value={value}
        onChange={onChange}
        locale={locale}
        timeZone={timeZone}
        pickerTimeZone={timeZone}
        placeholder={t("fields.deadlinePlaceholder")}
        clearLabel={t("fields.clearDeadline")}
      />
    </div>
  );
}
