"use client";

import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

interface OtpInputProps {
  length: number;
  value: string;
  onChange: (value: string) => void;
  /** Called once every box is filled (typed or pasted). */
  onComplete?: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
}

/**
 * One box per digit. Typing moves to the next box, Backspace moves back,
 * and pasting the whole code (or picking it from the phone keyboard's
 * suggestion) fills every box at once.
 */
export default function OtpInput({
  length,
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
  autoFocus,
}: OtpInputProps) {
  const boxes = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  const focusBox = (i: number) => boxes.current[Math.max(0, Math.min(length - 1, i))]?.focus();

  // After a wrong code the boxes are cleared and re-enabled; put the cursor
  // back in the first box so the person can just type again.
  useEffect(() => {
    if (!disabled && value === "" && invalid) boxes.current[0]?.focus();
  }, [disabled, value, invalid]);

  const commit = (next: string) => {
    const clean = next.replace(/\D/g, "").slice(0, length);
    onChange(clean);
    if (clean.length === length) onComplete?.(clean);
    return clean;
  };

  const handleInput = (i: number, raw: string) => {
    const typed = raw.replace(/\D/g, "");
    if (!typed) return;
    // The code is kept as one string with no gaps, so typing in a box past
    // the end just adds to the end.
    const at = Math.min(i, value.length);
    // More than one digit arrives when the phone autofills the whole code.
    const filled = commit(value.slice(0, at) + typed + value.slice(at + 1));
    focusBox(typed.length > 1 ? filled.length : at + 1);
  };

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i]) {
        onChange(value.slice(0, i) + value.slice(i + 1));
      } else if (i > 0) {
        onChange(value.slice(0, i - 1) + value.slice(i));
        focusBox(i - 1);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusBox(i - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focusBox(i + 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const filled = commit(e.clipboardData.getData("text"));
    focusBox(filled.length);
  };

  return (
    <div className="flex justify-center gap-2 sm:gap-3" role="group" aria-label={`${length}-digit code`}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            boxes.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          // Lets iOS/Android offer the code from the email as a keyboard suggestion.
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${i + 1}`}
          maxLength={i === 0 ? length : 1}
          value={digit}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          onChange={(e) => handleInput(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={cn(
            "h-14 w-11 rounded-xl border bg-background text-center font-heading text-2xl font-bold tabular-nums shadow-sm transition-colors sm:w-12",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-primary",
            "disabled:opacity-50",
            invalid ? "border-destructive text-destructive" : digit ? "border-primary/60" : "border-input"
          )}
        />
      ))}
    </div>
  );
}
