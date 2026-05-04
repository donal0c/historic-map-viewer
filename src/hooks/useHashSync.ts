import { useEffect, useRef } from "react";
import type { MapState } from "../types";
import { encodeHash, decodeHash } from "../lib/hash";

export function useHashSync(
  state: MapState,
  setState: React.Dispatch<React.SetStateAction<MapState>>
) {
  const isUpdatingFromHash = useRef(false);
  const isUpdatingHash = useRef(false);

  // State -> hash (debounced)
  useEffect(() => {
    if (isUpdatingFromHash.current) return;

    isUpdatingHash.current = true;
    const timer = setTimeout(() => {
      window.location.hash = encodeHash(state).slice(1); // remove leading #, browser adds it
      isUpdatingHash.current = false;
    }, 300);

    return () => {
      clearTimeout(timer);
      isUpdatingHash.current = false;
    };
  }, [state]);

  // Hash -> state
  useEffect(() => {
    const onHashChange = () => {
      if (isUpdatingHash.current) return;

      const decoded = decodeHash(window.location.hash);
      if (!decoded) return;

      isUpdatingFromHash.current = true;
      setState((prev) => ({ ...prev, ...decoded }));

      // Small delay to prevent circular update
      setTimeout(() => {
        isUpdatingFromHash.current = false;
      }, 100);
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [setState]);
}
