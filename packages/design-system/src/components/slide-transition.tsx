"use client";

import * as React from "react";

type SlideDirection = "forward" | "back";
type AnimPhase = "idle" | "setup" | "animating";

interface SlideTransitionProps {
  /** Current step index — changes trigger the animation. */
  stepIndex: number;
  /** Content to render inside the animated container. */
  children: React.ReactNode;
  /** Animation duration in milliseconds. @default 250 */
  duration?: number;
  /** CSS easing function. @default "ease-out" */
  easing?: string;
}

/**
 * Horizontal slide transition wrapper for multi-step wizards.
 *
 * Both the outgoing and incoming panels animate simultaneously so there is no
 * visible gap between steps. The container height animates smoothly so the
 * surrounding card / dialog resizes without snapping.
 *
 * - Forward (step increases): both panels slide left (old exits left, new enters from right).
 * - Back (step decreases): both panels slide right (old exits right, new enters from left).
 * - Uses CSS transforms + opacity for smooth 60 fps animations.
 */
export function SlideTransition({
  stepIndex,
  children,
  duration = 250,
  easing = "ease-out",
}: SlideTransitionProps) {
  const [currentContent, setCurrentContent] =
    React.useState<React.ReactNode>(children);
  const [outgoingContent, setOutgoingContent] =
    React.useState<React.ReactNode>(null);
  const [direction, setDirection] = React.useState<SlideDirection>("forward");
  const [phase, setPhase] = React.useState<AnimPhase>("idle");
  const prevStepRef = React.useRef(stepIndex);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const enterRef = React.useRef<HTMLDivElement>(null);
  const outgoingRef = React.useRef<HTMLDivElement>(null);

  // Keep a ref to current content so we can capture it synchronously as
  // "outgoing" when the step changes.
  const currentContentRef = React.useRef<React.ReactNode>(children);
  currentContentRef.current = currentContent;

  React.useEffect(() => {
    if (stepIndex === prevStepRef.current) {
      setCurrentContent(children);
      return;
    }

    const dir: SlideDirection =
      stepIndex > prevStepRef.current ? "forward" : "back";
    prevStepRef.current = stepIndex;
    setDirection(dir);
    setOutgoingContent(currentContentRef.current);
    setCurrentContent(children);
    // "setup" positions both panels at their starting offsets with no transition.
    setPhase("setup");

    // We intentionally only trigger the animation when stepIndex changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  // After "setup" renders both panels at their start positions, measure heights,
  // lock the container to the outgoing height, force a reflow, then set the
  // target height and flip to "animating" so slide + height transitions run.
  //
  // Height is managed imperatively because we need precise reflow timing that
  // React state batching can't provide. React's per-property style reconciliation
  // won't touch `height` or `transition` since they're never in the JSX style prop.
  React.useLayoutEffect(() => {
    if (phase !== "setup") return;

    const container = containerRef.current;
    const inEl = enterRef.current;
    if (!container || !inEl) return;

    const outH = outgoingRef.current?.offsetHeight ?? inEl.offsetHeight;
    const inH = inEl.offsetHeight;

    // Account for vertical padding (2px top + 2px bottom) in border-box model
    const padY = 4;

    // Lock to outgoing height with no transition
    container.style.height = `${outH + padY}px`;
    container.style.transition = "none";
    container.getBoundingClientRect(); // force reflow

    // Set target height with transition
    container.style.transition = `height ${duration}ms ${easing}`;
    container.style.height = `${inH + padY}px`;

    // Kick off slide animations (the reflow above also commits the enter
    // panel's starting translateX so the CSS transition will animate it).
    setPhase("animating");
  }, [phase, duration, easing]);

  // Remove outgoing content after the animation completes.
  React.useEffect(() => {
    if (phase === "animating") {
      const timer = setTimeout(() => {
        setOutgoingContent(null);
        setPhase("idle");
        // Remove the fixed height so the container returns to auto-sizing.
        if (containerRef.current) {
          containerRef.current.style.height = "";
          containerRef.current.style.transition = "";
        }
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [phase, duration]);

  // Keep current content in sync when children change *without* a step change
  // (e.g. form state updates within a step).
  React.useEffect(() => {
    if (phase === "idle") {
      setCurrentContent(children);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children]);

  const exitX = direction === "forward" ? "-100%" : "100%";
  const enterX = direction === "forward" ? "100%" : "-100%";
  const transition = `transform ${duration}ms ${easing}, opacity ${duration}ms ${easing}`;

  const isActive = phase !== "idle";

  // --- Outgoing panel styles ---
  const outgoingStyle: React.CSSProperties =
    phase === "setup"
      ? { transform: "translateX(0)", opacity: 1, transition: "none" }
      : { transform: `translateX(${exitX})`, opacity: 0, transition };

  // --- Entering panel styles ---
  let enterStyle: React.CSSProperties;
  switch (phase) {
    case "setup":
      enterStyle = {
        transform: `translateX(${enterX})`,
        opacity: 0,
        transition: "none",
      };
      break;
    case "animating":
      enterStyle = {
        transform: "translateX(0)",
        opacity: 1,
        transition,
      };
      break;
    case "idle":
    default:
      enterStyle = {};
      break;
  }

  return (
    <div
      ref={containerRef}
      style={{
        overflow: "clip",
        position: "relative",
        // Padding gives focus rings room to render without being clipped;
        // negative margin compensates so layout is unchanged.
        padding: "2px 4px",
        margin: "-2px -4px",
      }}
    >
      {/* Outgoing panel — absolutely positioned so it doesn't affect layout */}
      {isActive && outgoingContent != null && (
        <div
          ref={outgoingRef}
          style={{
            position: "absolute",
            top: 2,
            left: 4,
            right: 4,
            ...outgoingStyle,
          }}
        >
          {outgoingContent}
        </div>
      )}

      {/* Current / entering panel — stays in normal flow to maintain height */}
      <div ref={enterRef} style={enterStyle}>
        {currentContent}
      </div>
    </div>
  );
}
