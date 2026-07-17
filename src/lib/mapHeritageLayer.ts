import L from "leaflet";
import { heritageSourceById } from "../config/heritageSources";
import type { HeritageData, HeritageFeature } from "../types";

export function addHeritageLayerToMap(
  map: L.Map,
  data: HeritageData,
  onSelectFeature: (feature: HeritageFeature) => void
): L.LayerGroup {
  const group = L.layerGroup();
  const clusteredIds = new Set<string>();

  for (const cluster of clusterPointFeatures(map, data.features)) {
    if (cluster.features.length === 1) continue;
    cluster.features.forEach((feature) => clusteredIds.add(feature.id));
    addClusterMarker(map, group, cluster.features);
  }

  data.features.forEach((feature) => {
    if (clusteredIds.has(feature.id)) return;
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
              className: `heritage-geometry heritage-line heritage-line-${feature.layer}`,
              color: source.color,
              opacity: 0.82,
              weight: 3,
            }
          : {
              className: `heritage-geometry heritage-polygon heritage-polygon-${feature.layer}`,
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

function clusterPointFeatures(
  map: L.Map,
  features: HeritageFeature[],
): Array<{ features: HeritageFeature[] }> {
  if (map.getZoom() >= 17) {
    return features
      .filter((feature) => feature.coordinates)
      .map((feature) => ({ features: [feature] }));
  }

  const cellSize = map.getZoom() >= 15 ? 38 : 46;
  const cells = new Map<string, HeritageFeature[]>();
  for (const feature of features) {
    if (
      heritageSourceById[feature.layer].geometry !== "point" ||
      !feature.coordinates
    ) {
      continue;
    }
    const point = map.latLngToLayerPoint(feature.coordinates);
    const key = `${feature.layer}:${Math.floor(point.x / cellSize)}:${Math.floor(
      point.y / cellSize,
    )}`;
    const cell = cells.get(key) ?? [];
    cell.push(feature);
    cells.set(key, cell);
  }
  return [...cells.values()].map((features) => ({ features }));
}

function addClusterMarker(
  map: L.Map,
  group: L.LayerGroup,
  features: HeritageFeature[],
) {
  const bounds = L.latLngBounds(
    features
      .map((feature) => feature.coordinates)
      .filter((coordinates): coordinates is [number, number] =>
        Boolean(coordinates),
      ),
  );
  const count = features.length;
  const marker = L.marker(bounds.getCenter(), {
    pane: "pointsPane",
    keyboard: true,
    title: `${count} nearby heritage records`,
    icon: L.divIcon({
      className: "heritage-cluster",
      html: `<span>${count}</span>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    }),
  });
  marker.on("click", () => {
    map.fitBounds(bounds.pad(0.45), {
      maxZoom: Math.min(17, map.getZoom() + 2),
      animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    });
  });
  marker.once("add", () => {
    const element = marker.getElement();
    if (!element) return;
    element.setAttribute("role", "button");
    element.setAttribute(
      "aria-label",
      `${count} nearby heritage records. Zoom in to separate them.`,
    );
  });
  marker.addTo(group);
}

function toGeoJson(feature: HeritageFeature) {
  return {
    type: "Feature",
    geometry: feature.geometry,
    properties: feature.raw,
  } as GeoJSON.Feature;
}
