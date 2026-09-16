"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";

/**
 * Forces the theme to "system" while mounted (auth pages have no theme toggle).
 * Restores the user's explicit preference when unmounting (e.g. navigating to dashboard).
 */
export function ForceSystemTheme() {
  const { theme, setTheme } = useTheme();
  const savedTheme = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (theme && theme !== "system") {
      savedTheme.current = theme;
      setTheme("system");
    }

    return () => {
      if (savedTheme.current) {
        setTheme(savedTheme.current);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
