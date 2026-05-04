# Historic Map Viewer

A portfolio-grade Irish historic environment explorer. Search for a place, compare historical Ordnance Survey map layers against modern basemaps, and inspect live public heritage records around the current view.

The app is built as a full-screen map product rather than a static demo: the map is the primary canvas, with a compact command deck, a bottom timeline, and a place dossier that explains what the map is showing.

## What It Does

- Search Irish places and jump the map to the result.
- Compare modern and historical maps using overlay, swipe, side-by-side, and spyglass modes.
- Switch between historical map eras with a timeline rail.
- Load live public heritage records around the current view:
  - National Monuments Service archaeology records.
  - SMR archaeological zones.
  - National Inventory of Architectural Heritage buildings.
  - Excavations.ie records.
- Select markers to inspect descriptions, classifications, source links, and NIAH imagery where available.
- Preserve the current map state in the URL hash for shareable views.

## Why It Exists

Historic map viewers often stop at raster comparison. This app adds context: it connects old map evidence to live archaeology, architecture, and excavation datasets, turning a map overlay into a place-time investigation tool.

## Tech Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Leaflet
- React Leaflet
- leaflet-side-by-side
- leaflet.sync

## Data Sources

The app uses public web services and map tiles:

- OpenStreetMap and CARTO/Esri basemaps.
- National Library of Scotland historical map tiles.
- National Monuments Service SMR open data.
- National Monuments Service SMR Zone open data.
- National Inventory of Architectural Heritage open data.
- Excavations.ie ArcGIS feature service.
- Nominatim for place search.

All third-party datasets remain subject to their own licences, availability, rate limits, and attribution requirements. The app is an exploratory viewer, not a legal or statutory assessment.

## Local Development

Install dependencies:

```bash
pnpm install
```

Run the development server:

```bash
pnpm dev
```

Build for production:

```bash
pnpm build
```

Preview a production build:

```bash
pnpm preview
```

## Project Structure

```text
src/
  components/       UI, map shell, comparison modes, and panels
  config/           Map, basemap, historical layer, and mode configuration
  hooks/            State, URL hash, spyglass, and heritage data hooks
  lib/              Tile-layer creation, public-data fetching, and map overlays
  types/            Shared TypeScript types
```

## Notes

- Historical tile coverage varies by layer and zoom. Some 6-inch layers take a few seconds to resolve because they are composed from county tile sets.
- Public ArcGIS services can be slow or unavailable. The app keeps the map usable while heritage data refreshes.
- URL hash state stores the current location, zoom, map layer, basemap, opacity, compare mode, and blend mode.
