import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import type L from "leaflet";
import type { HeritageData, HeritageFeature } from "../../types";
import { addHeritageLayerToMap } from "../../lib/mapHeritageLayer";

interface HeritageLayerMountProps {
  data: HeritageData;
  onSelectFeature: (feature: HeritageFeature) => void;
}

export default function HeritageLayerMount({
  data,
  onSelectFeature,
}: HeritageLayerMountProps) {
  const map = useMap();
  const groupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.remove();
      groupRef.current = null;
    }

    groupRef.current = addHeritageLayerToMap(map, data, onSelectFeature);

    return () => {
      groupRef.current?.remove();
      groupRef.current = null;
    };
  }, [map, data, onSelectFeature]);

  return null;
}
