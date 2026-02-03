import { useCallback, useEffect, useRef, useState } from 'react';

const THRESHOLD = 80;
const MAX_PULL = 120;

/**
 * usePullToRefresh(onRefresh): attach pull-to-refresh to a scroll container.
 * Returns { pullRef, pullStyle, pulling, triggerRefresh }.
 * Use pullRef on the scroll container (e.g. main content div).
 */
export function usePullToRefresh(onRefresh) {
  const [pulling, setPulling] = useState(false);
  const [pullY, setPullY] = useState(0);
  const startY = useRef(0);
  const containerRef = useRef(null);

  const triggerRefresh = useCallback(async () => {
    if (!onRefresh) return;
    setPulling(true);
    try {
      await Promise.resolve(onRefresh());
    } finally {
      setPulling(false);
    }
  }, [onRefresh]);

  const pullYRef = useRef(0);
  pullYRef.current = pullY;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !onRefresh) return;

    const handleTouchStart = (e) => {
      if (el.scrollTop <= 0) {
        startY.current = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e) => {
      if (el.scrollTop > 0) return;
      const y = e.touches[0].clientY;
      const diff = y - startY.current;
      if (diff > 0) {
        const pull = Math.min(diff * 0.5, MAX_PULL);
        setPullY(pull);
      }
    };

    const handleTouchEnd = () => {
      if (pullYRef.current >= THRESHOLD) {
        triggerRefresh();
      }
      setPullY(0);
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    el.addEventListener('touchend', handleTouchEnd);
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onRefresh, triggerRefresh]);

  const pullRef = containerRef;
  const pullStyle = pullY > 0 ? { transform: `translateY(${pullY}px)` } : undefined;

  return { pullRef, pullStyle, pulling, pullY, triggerRefresh };
}
