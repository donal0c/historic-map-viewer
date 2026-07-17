import { useEffect, useRef } from "react";
import type { HeritageLayerId, MapState } from "../types";
import {
  decodeHash,
  decodeHeritageSourceIds,
  encodeHash,
} from "../lib/hash";

export function useHashSync(
  state: MapState,
  setState: React.Dispatch<React.SetStateAction<MapState>>,
  enabledSourceIds: HeritageLayerId[],
  setEnabledSourceIds: React.Dispatch<React.SetStateAction<HeritageLayerId[]>>,
) {
  const isUpdatingFromHash = useRef(false);
  const isUpdatingHash = useRef(false);

  // State -> hash (debounced)
  useEffect(() => {
    if (isUpdatingFromHash.current) return;

    isUpdatingHash.current = true;
    const timer = setTimeout(() => {
      window.location.hash = encodeHash(state, enabledSourceIds).slice(1);
      isUpdatingHash.current = false;
    }, 300);

    return () => {
      clearTimeout(timer);
      isUpdatingHash.current = false;
    };
  }, [enabledSourceIds, state]);

  // Hash -> state
  useEffect(() => {
    const onHashChange = () => {
      if (isUpdatingHash.current) return;

      const decoded = decodeHash(window.location.hash);
      if (!decoded) return;
      const decodedSources = decodeHeritageSourceIds(window.location.hash);

      isUpdatingFromHash.current = true;
      setState((prev) => ({ ...prev, ...decoded }));
      if (decodedSources) setEnabledSourceIds(decodedSources);

      // Small delay to prevent circular update
      setTimeout(() => {
        isUpdatingFromHash.current = false;
      }, 100);
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [setEnabledSourceIds, setState]);
}
