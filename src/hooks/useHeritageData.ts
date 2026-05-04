import { useEffect, useMemo, useState } from "react";
import type { LatLngTuple } from "leaflet";
import type { HeritageData } from "../types";
import { fetchHeritageData, radiusForZoom } from "../lib/heritage";

export function useHeritageData(center: LatLngTuple, zoom: number): HeritageData {
  const [data, setData] = useState<HeritageData>({
    features: [],
    status: "idle",
    radiusMeters: radiusForZoom(zoom),
  });

  const key = useMemo(
    () => `${center[0].toFixed(3)},${center[1].toFixed(3)},${zoom}`,
    [center, zoom]
  );

  useEffect(() => {
    let cancelled = false;
    setData({
      features: [],
      status: "loading",
      radiusMeters: radiusForZoom(zoom),
    });

    const timer = window.setTimeout(() => {
      fetchHeritageData(center[0], center[1], zoom)
        .then((next) => {
          if (!cancelled) setData(next);
        })
        .catch((error) => {
          if (!cancelled) {
            setData({
              features: [],
              status: "error",
              error: error instanceof Error ? error.message : "Data unavailable",
              radiusMeters: radiusForZoom(zoom),
            });
          }
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [key, center, zoom]);

  return data;
}
