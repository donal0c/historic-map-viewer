# Historic Map Viewer

A public Irish place-time atlas. Search for a place, move through six historical Ordnance Survey series, compare past and present, and reveal nearby archaeology, architecture, maritime history, transport, sacred landscapes, and conservation evidence.

Live site: [historicmapviewer.vercel.app](https://historicmapviewer.vercel.app)

## Product

- Four comparison modes: Overlay, Swipe, Side-by-side, and Lens.
- Six NLS historical series from the 1830s to the 1940s.
- A 27-source, opt-in public heritage catalogue with six useful presets.
- Point, route, and polygon evidence with an official-source inspector.
- Curated starting places, place search, shareable map/evidence state, and responsive mobile sheets.
- Honest layer readiness: loading, partial coverage, unsupported zoom, outside coverage, and upstream failure are distinct states.

The visual direction is a quiet archival instrument: the map is the dominant plane, while a matte atlas frame, parchment inspector, restrained type, and an oxidised-green accent carry the interaction.

## Architecture

- React 19, TypeScript, Vite, and Leaflet 1.9.
- One persistent Leaflet runtime with dedicated basemap, historical, geometry, selection, and label panes.
- Comparison modes are presentation strategies around that runtime. Side-by-side creates a second synchronized map only while selected.
- Six-inch NLS tiles use a deterministic county-bounds resolver, bounded candidate fan-out, positive/negative caching, and black no-data pixel removal for correct county-edge compositing.
- A typed heritage registry describes provider, endpoint, geometry, fields, styling, zoom range, query limit, and attribution for every source.
- Queries are lazy, abortable, debounced, independently cached, and independently degraded.
- Production place search runs through a cacheable Vercel function that identifies the application to Nominatim.

MapGenie is deliberately excluded: its Tailte Éireann proxy services are restricted to the official viewer’s referrer and are not a public integration surface for this project.

## Public data

The catalogue combines:

- National Monuments Service SMR records, zones, thematic monument sets, monuments to visit, Norman settlements, and Community Monuments Fund projects.
- National Inventory of Architectural Heritage points and building footprints.
- Excavations.ie, Historic Graves, Irish Historic Towns Atlas, historic parks and gardens, and conservation areas.
- Wreck Inventory of Ireland, defence heritage, Martello towers, WWII lookout posts, and Éire signs.
- Workhouses, disused railways, canals, and navigable waterways.

Historical map tiles are provided by the National Library of Scotland. Basemaps come from OpenStreetMap, CARTO, and Esri. Every third-party source remains subject to its own licensing, uptime, and attribution requirements; this is an exploratory atlas, not a legal or statutory assessment.

## Local development

```bash
pnpm install
pnpm dev
```

Quality gates:

```bash
pnpm check             # unit/contract tests and production build
pnpm test:e2e          # deterministic desktop/mobile Chromium journeys
pnpm probe:sources     # live metadata + GeoJSON sample for all 27 sources
pnpm probe:tiles       # live representative checks for all six map series
pnpm check:all
```

## Repository shape

```text
api/                   Vercel place-search function
e2e/                   deterministic browser and accessibility journeys
scripts/               live public-data contract probes
src/components/map/    persistent Leaflet runtime
src/config/            historical maps and typed heritage source registry
src/lib/               tile resolver, queries, sharing, and renderers
.github/workflows/     CI and weekly report-only upstream checks
```
