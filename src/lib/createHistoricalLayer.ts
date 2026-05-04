import L from "leaflet";
import type { TileLayerConfig } from "../types";
import { createCompositeCountyLayer } from "./compositeLayer";

/**
 * Creates the appropriate Leaflet TileLayer for a historical layer config.
 * Handles both simple URL-based layers and composite county layers.
 */
export function createHistoricalLayer(
  config: TileLayerConfig,
  extraOptions?: L.TileLayerOptions
): L.TileLayer {
  if (config.composite === "6inch-1st") {
    return createCompositeCountyLayer("1st", {
      ...extraOptions,
    });
  }

  if (config.composite === "6inch-2nd") {
    return createCompositeCountyLayer("2nd", {
      ...extraOptions,
    });
  }

  return L.tileLayer(config.url, {
    attribution: config.attribution,
    maxZoom: config.maxZoom,
    minZoom: config.minZoom,
    tms: config.tms ?? false,
    ...extraOptions,
  });
}
