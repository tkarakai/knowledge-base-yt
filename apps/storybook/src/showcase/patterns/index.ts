import type { ComponentType } from "react";

import DateTimePickerShowcase from "./date-time-picker";
import DateTimeWithTimezoneShowcase from "./date-time-with-timezone";
import SiteHeaderShowcase from "./site-header";
import ThemeToggleShowcase from "./theme-toggle";
import TimezoneSelectorShowcase from "./timezone-selector";

export const patternShowcaseMap: Record<string, ComponentType> = {
  "date-time-picker": DateTimePickerShowcase,
  "date-time-with-timezone": DateTimeWithTimezoneShowcase,
  "site-header": SiteHeaderShowcase,
  "theme-toggle": ThemeToggleShowcase,
  "timezone-selector": TimezoneSelectorShowcase,
};
