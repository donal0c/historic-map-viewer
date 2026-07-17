import L from "leaflet";
import { heritageSourceById } from "../config/heritageSources";
import type { HeritageData, HeritageFeature } from "../types";

export function addHeritageLayerToMap(
  map: L.Map,
  data: HeritageData,
  onSelectFeature: (feature: HeritageFeature) => void
): L.LayerGroup {
  const group = L.layerGroup();

  data.features.forEach((feature) => {
    const source = heritageSourceById[feature.layer];
    L.geoJSON(toGeoJson(feature), {
      pane:
        source.geometry === "polygon"
          ? "polygonsPane"
          : source.geometry === "line"
            ? "linesPane"
            : "pointsPane",
      style:
        source.geometry === "line"
          ? {
              color: source.color,
              opacity: 0.82,
              weight: 3,
            }
          : {
              color: source.color,
              fillColor: source.color,
              fillOpacity: 0.1,
              opacity: 0.76,
              weight: 1.4,
            },
      pointToLayer: (_geoFeature, latlng) =>
        L.circleMarker(latlng, {
          pane: "pointsPane",
          radius: 6,
          color: "#fffaf0",
          fillColor: source.color,
          fillOpacity: 0.94,
          opacity: 1,
          weight: 1.7,
          className: `heritage-marker heritage-marker-${feature.layer}`,
        }),
      onEachFeature: (_geoFeature, layer) => {
        layer.on("click", () => onSelectFeature(feature));
        layer.once("add", () => {
          const element =
            "getElement" in layer && typeof layer.getElement === "function"
              ? layer.getElement()
              : null;
          if (!element) return;
          element.setAttribute("tabindex", "0");
          element.setAttribute("role", "button");
          element.setAttribute(
            "aria-label",
            `${source.shortName}: ${feature.title}`,
          );
          element.addEventListener("keydown", (event: KeyboardEvent) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelectFeature(feature);
            }
          });
        });
        if (source.geometry === "point") {
          layer.bindTooltip(feature.title, {
            direction: "top",
            offset: [0, -8],
            opacity: 0.95,
          });
        }
      },
    }).addTo(group);
  });

  group.addTo(map);
  return group;
}

function toGeoJson(feature: HeritageFeature) {
  return {
    type: "Feature",
    geometry: feature.geometry,
    properties: feature.raw,
  } as GeoJSON.Feature;
}
