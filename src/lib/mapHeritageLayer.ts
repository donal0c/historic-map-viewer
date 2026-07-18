import L from "leaflet";
import { heritageSourceById } from "../config/heritageSources";
import type { HeritageData, HeritageFeature } from "../types";

interface RenderedItem {
  layer: L.Layer;
  signature: string;
}

interface DesiredFeatureItem {
  kind: "feature";
  key: string;
  feature: HeritageFeature;
  signature: string;
}

interface DesiredClusterItem {
  kind: "cluster";
  key: string;
  features: HeritageFeature[];
  signature: string;
}

type DesiredItem = DesiredFeatureItem | DesiredClusterItem;

export interface HeritageLayerController {
  update(
    data: HeritageData,
    onSelectFeature: (feature: HeritageFeature) => void,
  ): void;
  remove(): void;
}

export function addHeritageLayerToMap(
  map: L.Map,
  data: HeritageData,
  onSelectFeature: (feature: HeritageFeature) => void,
): HeritageLayerController {
  return new IncrementalHeritageLayer(map, data, onSelectFeature);
}

class IncrementalHeritageLayer implements HeritageLayerController {
  private readonly group = L.layerGroup();
  private readonly rendered = new Map<string, RenderedItem>();
  private data: HeritageData;
  private onSelectFeature: (feature: HeritageFeature) => void;

  constructor(
    private readonly map: L.Map,
    data: HeritageData,
    onSelectFeature: (feature: HeritageFeature) => void,
  ) {
    this.data = data;
    this.onSelectFeature = onSelectFeature;
    this.group.addTo(map);
    this.map.on("zoomend moveend", this.reconcile);
    this.reconcile();
  }

  update(
    data: HeritageData,
    onSelectFeature: (feature: HeritageFeature) => void,
  ) {
    this.data = data;
    this.onSelectFeature = onSelectFeature;
    this.reconcile();
  }

  remove() {
    this.map.off("zoomend moveend", this.reconcile);
    this.group.remove();
    this.rendered.clear();
  }

  private readonly reconcile = () => {
    const desired = desiredItems(this.map, this.data.features);
    const desiredByKey = new Map(desired.map((item) => [item.key, item]));

    for (const [key, rendered] of this.rendered) {
      const next = desiredByKey.get(key);
      if (!next || next.signature !== rendered.signature) {
        this.group.removeLayer(rendered.layer);
        this.rendered.delete(key);
      }
    }

    for (const item of desired) {
      if (this.rendered.has(item.key)) continue;
      const layer =
        item.kind === "cluster"
          ? this.createClusterLayer(item.features)
          : this.createFeatureLayer(item.feature);
      layer.addTo(this.group);
      this.rendered.set(item.key, {
        layer,
        signature: item.signature,
      });
    }
  };

  private createFeatureLayer(feature: HeritageFeature): L.GeoJSON {
    const source = heritageSourceById[feature.layer];
    return L.geoJSON(toGeoJson(feature), {
      pane:
        source.geometry === "polygon"
          ? "polygonsPane"
          : source.geometry === "line"
            ? "linesPane"
            : "pointsPane",
      style:
        source.geometry === "point"
          ? undefined
          : source.geometry === "line"
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
        layer.on("click", () => this.onSelectFeature(feature));
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
              this.onSelectFeature(feature);
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
    });
  }

  private createClusterLayer(features: HeritageFeature[]): L.Marker {
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
      this.map.fitBounds(bounds.pad(0.45), {
        maxZoom: Math.min(17, this.map.getZoom() + 2),
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
    return marker;
  }
}

function desiredItems(
  map: L.Map,
  features: HeritageFeature[],
): DesiredItem[] {
  const items: DesiredItem[] = [];
  const clusteredIds = new Set<string>();

  for (const cluster of clusterPointFeatures(map, features)) {
    if (cluster.features.length === 1) continue;
    const ids = cluster.features.map((feature) => feature.id).sort();
    cluster.features.forEach((feature) => clusteredIds.add(feature.id));
    items.push({
      kind: "cluster",
      key: `cluster:${ids.join("|")}`,
      features: cluster.features,
      signature: ids.join("|"),
    });
  }

  for (const feature of features) {
    if (clusteredIds.has(feature.id)) continue;
    items.push({
      kind: "feature",
      key: `feature:${feature.id}`,
      feature,
      signature: featureSignature(feature),
    });
  }

  return items;
}

function featureSignature(feature: HeritageFeature) {
  return JSON.stringify([
    feature.layer,
    feature.title,
    feature.subtitle,
    feature.sourceUrl,
    feature.geometry,
  ]);
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
  return [...cells.values()].map((clusterFeatures) => ({
    features: clusterFeatures,
  }));
}

function toGeoJson(feature: HeritageFeature) {
  return {
    type: "Feature",
    geometry: feature.geometry,
    properties: feature.raw,
  } as GeoJSON.Feature;
}
