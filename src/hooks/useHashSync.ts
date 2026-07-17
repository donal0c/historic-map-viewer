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

  // State -> hash (debounced)
  useEffect(() => {
    if (isUpdatingFromHash.current) return;

    const timer = setTimeout(() => {
      window.history.replaceState(
        null,
        "",
        encodeHash(state, enabledSourceIds),
      );
    }, 300);

    return () => clearTimeout(timer);
  }, [enabledSourceIds, state]);

  // Hash -> state
  useEffect(() => {
    const onHashChange = () => {
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
