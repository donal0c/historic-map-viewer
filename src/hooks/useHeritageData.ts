import { useEffect, useMemo, useState } from "react";
import type { LatLngTuple } from "leaflet";
import type { HeritageData, HeritageLayerId } from "../types";
import { fetchHeritageData, radiusForZoom } from "../lib/heritage";

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

  const key = useMemo(
    () =>
      `${center[0].toFixed(3)},${center[1].toFixed(3)},${zoom}:${enabledSourceIds.join(",")}`,
    [center, enabledSourceIds, zoom],
  );

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setData({
      features: data.features,
      status: "loading",
      radiusMeters: radiusForZoom(zoom),
      sources: Object.fromEntries(
        enabledSourceIds.map((id) => [
          id,
          {
            status: "loading",
            count: data.sources[id]?.count ?? 0,
          },
        ]),
      ),
    });

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
    // Data from the previous settled view remains visible while the next
    // abortable request is in flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return data;
}
