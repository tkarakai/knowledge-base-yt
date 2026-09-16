"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const THROTTLE_MS = 500;
const POLL_MS = 250;

/**
 * Throttles password values sent to the server for strength evaluation.
 *
 * On every keystroke the latest password is placed in a single-slot queue.
 * A `processQueue` function decides whether to send it to the server:
 *
 * - If the queue is empty → exit.
 * - If a server call is in-flight OR less than 500 ms since the last call
 *   → schedule a 250 ms self-check and exit.
 * - Otherwise → dequeue, record the time, mark pending, and send
 *   (by updating state, which drives the consumer's `useQuery`).
 *
 * The 250 ms poll guarantees that the **last typed character** is always
 * evaluated — either within 500 ms of the previous call or as soon as the
 * pending call resolves.
 *
 * Usage:
 * ```tsx
 * const [throttledPassword, notifyResolved] = useThrottledPasswordCheck(password);
 * const result = useQuery(api.passwordStrength.evaluate,
 *   throttledPassword ? { password: throttledPassword, ... } : "skip");
 *
 * // Notify when query resolves so the hook can send queued passwords
 * useEffect(() => {
 *   if (result !== undefined) notifyResolved();
 * }, [result, notifyResolved]);
 * ```
 */
export function useThrottledPasswordCheck(
  password: string,
): [throttledPassword: string, notifyResolved: () => void] {
  const [sentPassword, setSentPassword] = useState("");

  // --- refs (never trigger re-renders) ---
  const queueRef = useRef<string | null>(null);
  const lastCallTimeRef = useRef(0);
  const pendingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // processQueue: the single decision function.
  // Called from keystrokes, the poll timer, and notifyResolved.
  const processQueue = useCallback(() => {
    // 1. Nothing queued → exit
    if (queueRef.current === null) return;

    // 2. Can't send yet → schedule a poll and exit
    const elapsed = Date.now() - lastCallTimeRef.current;
    if (pendingRef.current || (lastCallTimeRef.current > 0 && elapsed < THROTTLE_MS)) {
      if (timerRef.current === null) {
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          processQueue();
        }, POLL_MS);
      }
      return;
    }

    // 3. Ready to send
    const pwd = queueRef.current;
    queueRef.current = null;
    lastCallTimeRef.current = Date.now();
    pendingRef.current = true;
    setSentPassword(pwd);
  }, []);

  // Every keystroke: update queue, then try to process
  useEffect(() => {
    if (!password) {
      // Empty → reset everything
      queueRef.current = null;
      lastCallTimeRef.current = 0;
      pendingRef.current = false;
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setSentPassword("");
      return;
    }

    queueRef.current = password;
    processQueue();
  }, [password, processQueue]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  // notifyResolved: consumer calls this when the server query resolves.
  const notifyResolved = useCallback(() => {
    if (!pendingRef.current) return;
    pendingRef.current = false;
    processQueue(); // immediate retry — no 250 ms wait
  }, [processQueue]);

  return [sentPassword, notifyResolved];
}
