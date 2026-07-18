import { useEffect, useMemo, useState } from "react";
import type { LatLngTuple } from "leaflet";
import type { HeritageData, HeritageLayerId } from "../types";
import {
  fetchHeritageData,
  heritageQueryCell,
  radiusForZoom,
} from "../lib/heritage";

export function useHeritageData(
  center: LatLngTuple,
  zoom: number,
  enabledSourceIds: HeritageLayerId[],
): HeritageData {
  const [data, setData] = useState<HeritageData>({
    features: [],
    status: "idle",
    radiusMeters: radiusForZoom(zoom),
    sources: {},
  });

  const query = useMemo(
    () => heritageQueryCell(center[0], center[1], zoom, enabledSourceIds),
    [center, enabledSourceIds, zoom],
  );

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setData((previous) => ({
      features: previous.features,
      status: "loading",
      radiusMeters: radiusForZoom(zoom),
      sources: Object.fromEntries(
        enabledSourceIds.map((id) => [
          id,
          {
            status: "loading",
            count: previous.sources[id]?.count ?? 0,
          },
        ]),
      ),
    }));

    const timer = window.setTimeout(() => {
      fetchHeritageData(
        center[0],
        center[1],
        zoom,
        enabledSourceIds,
        controller.signal,
      )
        .then((next) => {
          if (!cancelled) setData(next);
        })
        .catch((error) => {
          if (!cancelled && !controller.signal.aborted) {
            setData({
              features: [],
              status: "error",
              error: error instanceof Error ? error.message : "Data unavailable",
              radiusMeters: radiusForZoom(zoom),
              sources: {},
            });
          }
        });
    }, 280);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
    // Data from the previous settled query cell remains visible while the next
    // abortable request is in flight.
  }, [query.key]);

  return data;
}
