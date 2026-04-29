"use client";

import { useEffect, useState } from "react";

export function usePresence(isOpen: boolean, durationMs = 220) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);

      const frameId = window.requestAnimationFrame(() => {
        setIsVisible(true);
      });

      return () => window.cancelAnimationFrame(frameId);
    }

    setIsVisible(false);

    const timeoutId = window.setTimeout(() => {
      setShouldRender(false);
    }, durationMs);

    return () => window.clearTimeout(timeoutId);
  }, [durationMs, isOpen]);

  return { shouldRender, isVisible };
}
