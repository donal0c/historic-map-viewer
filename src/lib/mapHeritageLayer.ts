import L from "leaflet";
import type { HeritageData, HeritageFeature, HeritageLayerId } from "../types";

const COLORS: Record<HeritageLayerId, string> = {
  smr: "#e2483d",
  zones: "#f5a623",
  niah: "#2f80ed",
  excavations: "#8b5cf6",
};

export function addHeritageLayerToMap(
  map: L.Map,
  data: HeritageData,
  onSelectFeature: (feature: HeritageFeature) => void
): L.LayerGroup {
  const group = L.layerGroup();

  data.features.forEach((feature) => {
    if (feature.layer === "zones") {
      L.geoJSON(toGeoJson(feature), {
        style: {
          color: COLORS.zones,
          fillColor: COLORS.zones,
          fillOpacity: 0.08,
          opacity: 0.7,
          weight: 1.2,
        },
        onEachFeature: (_geoFeature, layer) => {
          layer.on("click", () => onSelectFeature(feature));
        },
      }).addTo(group);
      return;
    }

    if (!feature.coordinates) return;
    const [lat, lng] = feature.coordinates;
    const marker = L.circleMarker([lat, lng], {
      radius: markerRadius(feature.layer),
      color: "#fffaf0",
      fillColor: COLORS[feature.layer],
      fillOpacity: 0.92,
      opacity: 1,
      weight: 1.7,
      className: `heritage-marker heritage-marker-${feature.layer}`,
    })
      .on("click", () => onSelectFeature(feature))
      .on("mouseover", () => {
        marker.setRadius(markerRadius(feature.layer) + 1.4);
        marker.setStyle({ weight: 2.3 });
      })
      .on("mouseout", () => {
        marker.setRadius(markerRadius(feature.layer));
        marker.setStyle({ weight: 1.7 });
      })
      .bindTooltip(feature.title, {
        direction: "top",
        offset: [0, -8],
        opacity: 0.95,
      })
      .addTo(group);
  });

  group.addTo(map);
  return group;
}

function markerRadius(layer: HeritageLayerId): number {
  if (layer === "niah") return 6;
  if (layer === "excavations") return 5.5;
  return 6.5;
}

function toGeoJson(feature: HeritageFeature) {
  return {
    type: "Feature",
    geometry: feature.geometry,
    properties: feature.raw,
  } as GeoJSON.Feature;
}
