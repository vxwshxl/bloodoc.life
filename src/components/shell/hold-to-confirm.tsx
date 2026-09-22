"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A button that fires only after it has been held down.
 *
 * The hold is the confirmation. A second "are you sure?" dialog is dismissed by
 * reflex — people click through them without reading — whereas holding a button
 * for a second and a half cannot be done by accident, and letting go is an
 * escape that needs no explanation. The fill is not decoration: it is the only
 * thing telling you how much longer to hold.
 *
 * Keyboard gets the same interaction rather than a different one. Holding Space
 * or Enter on a focused button emits repeating `keydown` events, so the same
 * timer runs; `keyup` cancels it exactly as lifting a finger does. Without this
 * the control would be pointer-only, which for a destructive action means
 * keyboard users get no way to do it at all.
 *
 * Reduced motion keeps the fill — it is feedback, not animation — but it stops
 * being a transition and steps instead.
 */
export function HoldToConfirm({
  onConfirm,
  label = "Hold to delete",
  holdingLabel = "Keep holding…",
  durationMs = 1500,
  pending = false,
  className,
}: {
  onConfirm: () => void;
  label?: string;
  holdingLabel?: string;
  durationMs?: number;
  pending?: boolean;
  className?: string;
}) {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  // Guards the repeat-keydown case: a held key emits keydown over and over, and
  // without this each repeat would restart the timer and the bar never fills.
  const keyDown = useRef(false);
  // The callback is read at the moment the hold completes, not captured when
  // the hold began — so the animation loop below does not have to restart every
  // time the parent re-renders with a new closure.
  const onConfirmRef = useRef(onConfirm);
  useEffect(() => {
    onConfirmRef.current = onConfirm;
  }, [onConfirm]);

  const stop = useCallback(() => {
    keyDown.current = false;
    setHolding(false);
    setProgress(0);
  }, []);

  const start = useCallback(() => {
    if (pending) return;
    setHolding(true);
  }, [pending]);

  /**
   * The hold itself.
   *
   * Driven by an effect keyed on `holding` rather than by a self-referential
   * `useCallback` — a memoized callback that schedules itself cannot see its
   * own latest version, and the React Compiler rejects it outright. The whole
   * loop living inside one effect also means cancelling is just the cleanup
   * function, with nothing to tear down by hand.
   */
  useEffect(() => {
    if (!holding) return;
    const started = performance.now();
    let frame = requestAnimationFrame(function loop() {
      const p = Math.min(1, (performance.now() - started) / durationMs);
      setProgress(p);
      if (p >= 1) {
        // Reset before firing: the action revalidates and this may unmount, so
        // anything scheduled past this point would touch a dead component.
        setHolding(false);
        setProgress(0);
        onConfirmRef.current();
        return;
      }
      frame = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(frame);
  }, [holding, durationMs]);

  // A pointer released outside the button still cancels. Without this, dragging
  // off mid-hold leaves the timer running and the delete fires with the cursor
  // somewhere else entirely.
  useEffect(() => {
    if (!holding) return;
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [holding, stop]);

  return (
    <button
      type="button"
      disabled={pending}
      onPointerDown={start}
      onPointerLeave={stop}
      onKeyDown={(e) => {
        if (e.key !== " " && e.key !== "Enter") return;
        e.preventDefault();
        if (keyDown.current) return;
        keyDown.current = true;
        start();
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") stop();
      }}
      onBlur={stop}
      aria-describedby="hold-hint"
      className={cn(
        "press relative h-10 w-full overflow-hidden rounded-lg bg-destructive text-sm font-semibold text-white select-none disabled:opacity-60",
        className,
      )}
    >
      {/* The fill. `origin-left` + scaleX so it is one composited transform
          rather than a width the browser re-lays-out sixty times a second. */}
      <span
        aria-hidden
        className="absolute inset-0 origin-left bg-black/25 motion-safe:transition-transform motion-safe:duration-75"
        style={{ transform: `scaleX(${progress})` }}
      />
      <span className="relative flex items-center justify-center gap-2">
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Deleting…
          </>
        ) : (
          <>
            <Trash2 className="size-4" strokeWidth={1.9} aria-hidden />
            {holding ? holdingLabel : label}
          </>
        )}
      </span>
    </button>
  );
}
