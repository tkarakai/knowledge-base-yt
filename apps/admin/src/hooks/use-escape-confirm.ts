"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Reusable hook for "Esc again to close" pattern on dirty dialogs.
 *
 * When `isDirty` is true and Escape is pressed:
 * 1. First press: prevents close, shows hint for 4 seconds
 * 2. Second press within 4 seconds: allows close
 * 3. After 4 seconds: resets, requires double-Esc again
 *
 * When `isDirty` is false: Escape works normally.
 *
 * Usage:
 * ```tsx
 * const { showEscHint, onEscapeKeyDown } = useEscapeConfirm(isDirty);
 * <DialogContent onEscapeKeyDown={onEscapeKeyDown}>
 *   {showEscHint && <EscHintBadge />}
 * </DialogContent>
 * ```
 */
export function useEscapeConfirm(isDirty: boolean) {
  const [showEscHint, setShowEscHint] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Reset hint when dialog becomes clean.
  useEffect(() => {
    if (!isDirty) {
      setShowEscHint(false);
      if (timerRef.current) clearTimeout(timerRef.current);
    }
  }, [isDirty]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const onEscapeKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isDirty) return; // Allow normal close

      if (showEscHint) {
        // Second Esc within window — allow close (don't prevent)
        setShowEscHint(false);
        if (timerRef.current) clearTimeout(timerRef.current);
        return;
      }

      // First Esc while dirty — block and show hint
      e.preventDefault();
      setShowEscHint(true);
      timerRef.current = setTimeout(() => setShowEscHint(false), 4000);
    },
    [isDirty, showEscHint],
  );

  return { showEscHint, onEscapeKeyDown };
}
