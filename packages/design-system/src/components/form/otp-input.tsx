"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

export interface OtpInputProps {
  /** Number of digits (default: 6) */
  length?: number;
  /** Current value */
  value: string;
  /** Called when value changes */
  onChange: (value: string) => void;
  /**
   * When true, fires onComplete as soon as the last digit is typed,
   * then auto-clears the field and resets cursor to the first digit.
   * When false (default), the filled code just stays put.
   */
  autoSubmit?: boolean;
  /** Called when all digits are filled and autoSubmit is true */
  onComplete?: (value: string) => void;
  /** Disable the input */
  disabled?: boolean;
  /** Auto-focus the first input on mount */
  autoFocus?: boolean;
  /** Show error styling */
  error?: boolean;
  /** Accessible label */
  "aria-label"?: string;
}

export interface OtpInputHandle {
  focus: () => void;
}

export const OtpInput = React.forwardRef<OtpInputHandle, OtpInputProps>(function OtpInput({
  length = 6,
  value,
  onChange,
  autoSubmit = false,
  onComplete,
  disabled = false,
  autoFocus = false,
  error = false,
  "aria-label": ariaLabel = "One-time password",
}: OtpInputProps, ref) {
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  React.useImperativeHandle(ref, () => ({
    focus: () => focusInput(0),
  }));

  // Keep a ref to the latest value so focus handlers always see current state
  const valueRef = React.useRef(value);
  valueRef.current = value;

  // Track whether the last focus was caused by our own programmatic focusInput()
  // so we can skip the snap-to-first-empty logic for those cases
  const programmaticFocusRef = React.useRef(false);

  // Roving tabindex: only the active input participates in the tab order.
  // Tab exits the entire group; arrow keys navigate within.
  const [activeIndex, setActiveIndex] = React.useState(0);

  const digits = React.useMemo(() => {
    const arr = value.split("").slice(0, length);
    while (arr.length < length) arr.push("");
    return arr;
  }, [value, length]);

  const focusInput = (index: number) => {
    const clamped = Math.max(0, Math.min(index, length - 1));
    programmaticFocusRef.current = true;
    setActiveIndex(clamped);
    inputRefs.current[clamped]?.focus();
  };

  const setValueAndNotify = React.useCallback(
    (newDigits: string[]) => {
      const newValue = newDigits.join("");
      onChange(newValue);
      if (autoSubmit && newValue.length === length && onComplete) {
        onComplete(newValue);
        // Auto-reset: clear the field and move cursor back to the first digit.
        // The parent's onComplete handler receives the completed code via the
        // argument, so clearing the controlled value is safe.
        onChange("");
        setActiveIndex(0);
        requestAnimationFrame(() => {
          programmaticFocusRef.current = true;
          inputRefs.current[0]?.focus();
        });
      }
    },
    [autoSubmit, onChange, onComplete, length],
  );

  const handleChange = (index: number, raw: string) => {
    // Only accept single digits
    const digit = raw.replace(/\D/g, "").slice(-1);
    if (!digit) return;

    const newDigits = [...digits];
    newDigits[index] = digit;
    setValueAndNotify(newDigits);

    // Advance to next field
    if (index < length - 1) {
      focusInput(index + 1);
    }
  };

  const handleKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    // Let Tab pass through naturally for accessibility
    if (event.key === "Tab") return;

    if (event.key === "Backspace") {
      event.preventDefault();
      const newDigits = [...digits];
      if (digits[index]) {
        newDigits[index] = "";
        setValueAndNotify(newDigits);
      } else if (index > 0) {
        newDigits[index - 1] = "";
        setValueAndNotify(newDigits);
        focusInput(index - 1);
      }
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focusInput(index - 1);
    } else if (event.key === "ArrowRight" && index < length - 1) {
      event.preventDefault();
      focusInput(index + 1);
    } else if (event.key === "Delete") {
      event.preventDefault();
      const newDigits = [...digits];
      newDigits[index] = "";
      setValueAndNotify(newDigits);
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, length);
    if (!pasted) return;

    const newDigits = [...digits];
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    setValueAndNotify(newDigits);

    // Only move to next empty when not auto-submitting (autoSubmit resets to 0)
    if (!autoSubmit || newDigits.join("").length < length) {
      const nextEmpty = newDigits.findIndex((d) => !d);
      focusInput(nextEmpty === -1 ? length - 1 : nextEmpty);
    }
  };

  const handleFocus = (
    index: number,
    event: React.FocusEvent<HTMLInputElement>,
  ) => {
    // Select content so the next keystroke replaces it
    event.target.select();
    setActiveIndex(index);

    // If this focus was triggered programmatically (after typing a digit),
    // skip the snap-to-first-empty logic — the caller already chose the target
    if (programmaticFocusRef.current) {
      programmaticFocusRef.current = false;
      return;
    }

    // For user-initiated focus (click): snap to the first empty slot
    // using the ref so we always read the latest value
    const currentDigits = valueRef.current.split("").slice(0, length);
    const firstEmpty = currentDigits.length < length ? currentDigits.length : -1;
    if (firstEmpty !== -1 && index > firstEmpty) {
      focusInput(firstEmpty);
    }
  };

  return (
    <div
      className="flex items-center justify-center gap-2"
      role="group"
      aria-label={ariaLabel}
    >
      {digits.map((digit, index) => (
        <React.Fragment key={index}>
          {index === Math.floor(length / 2) && length > 3 ? (
            <span
              className="text-muted-foreground mx-1 text-lg select-none"
              aria-hidden
            >
              –
            </span>
          ) : null}
          <input
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            tabIndex={index === activeIndex ? 0 : -1}
            aria-label={`Digit ${index + 1} of ${length}`}
            value={digit}
            disabled={disabled}
            autoFocus={autoFocus && index === 0}
            className={cn(
              "h-12 w-10 rounded-md border text-center text-lg font-mono font-semibold",
              "bg-background shadow-sm transition-all duration-150",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
              "placeholder:text-muted-foreground/30",
              "disabled:cursor-not-allowed disabled:opacity-50",
              error
                ? "border-destructive focus:ring-destructive"
                : "border-input",
            )}
            maxLength={1}
            placeholder="·"
            onChange={(event) => handleChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={handlePaste}
            onFocus={(event) => handleFocus(index, event)}
          />
        </React.Fragment>
      ))}
    </div>
  );
});
