import React, { useCallback, useEffect, useRef, useState } from 'react';

interface TooltipState {
  visible: boolean;
  text: string;
  x: number;
  y: number;
}

const SHOW_DELAY_MS = 500;

/**
 * Tooltip renders a floating label near the cursor for any element that carries
 * a `data-tooltip` attribute.  Mount it once near the root of the UI overlay.
 *
 * Usage in JSX:
 *   <button data-tooltip="Explain what this does">Click</button>
 */
export function Tooltip(): React.ReactElement | null {
  const [state, setState] = useState<TooltipState>({
    visible: false,
    text: '',
    x: 0,
    y: 0,
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleMouseOver = useCallback(
    (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Walk up the DOM to find the closest element with data-tooltip
      const el = target.closest('[data-tooltip]') as HTMLElement | null;
      if (!el) return;

      const text = el.getAttribute('data-tooltip');
      if (!text) return;

      clearTimer();
      const mx = e.clientX;
      const my = e.clientY;

      timerRef.current = setTimeout(() => {
        setState({ visible: true, text, x: mx, y: my });
      }, SHOW_DELAY_MS);
    },
    [clearTimer],
  );

  const handleMouseMove = useCallback((e: MouseEvent) => {
    setState((prev) => {
      if (!prev.visible) return prev;
      return { ...prev, x: e.clientX, y: e.clientY };
    });
  }, []);

  const handleMouseOut = useCallback(
    (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const leaving = target.closest('[data-tooltip]');
      if (!leaving) return;

      clearTimer();
      setState((prev) => ({ ...prev, visible: false }));
    },
    [clearTimer],
  );

  useEffect(() => {
    document.addEventListener('mouseover', handleMouseOver, { passive: true });
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseout', handleMouseOut, { passive: true });
    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseout', handleMouseOut);
      clearTimer();
    };
  }, [handleMouseOver, handleMouseMove, handleMouseOut, clearTimer]);

  if (!state.visible || !state.text) return null;

  // Offset tooltip slightly so it doesn't sit right under the cursor
  const OFFSET_X = 14;
  const OFFSET_Y = 20;

  // Keep tooltip within the viewport
  const tooltipWidth = 220;
  const rawX = state.x + OFFSET_X;
  const clampedX =
    rawX + tooltipWidth > window.innerWidth ? state.x - tooltipWidth - 4 : rawX;
  const clampedY = state.y + OFFSET_Y;

  return (
    <div
      className="tooltip"
      style={{ left: clampedX, top: clampedY }}
      role="tooltip"
      aria-hidden="true"
    >
      {state.text}
    </div>
  );
}
