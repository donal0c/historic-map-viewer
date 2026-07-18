# Historic Map Viewer — Product and Technical Improvement Plan

Analysis date: 2026-07-18

## Purpose

Historic Map Viewer already has a strong foundation: React 19, Leaflet, six historical map series, multiple comparison modes, deep-linkable state, and a broad registry of Irish archaeology, architecture, excavation, and heritage sources.

The next stage should turn it from an impressive data viewer into a polished historical atlas that is fast, inviting, trustworthy, and memorable enough to be a portfolio exemplar.

This plan prioritises:

1. making the existing application reliable and responsive;
2. giving visitors a compelling way to begin exploring;
3. making the heritage evidence genuinely useful;
4. adding standout visual features on top of a stable mapping foundation.

It deliberately avoids making fragile public services, unapproved tile caching, or credentials from third-party organisations prerequisites for the core experience.

---

## Product principles

### Tell stories, but preserve evidence

Guided experiences should help people understand a place, while every heritage record remains attributable to its original source. Narrative text and sourced evidence must be visually distinct.

### Make uncertainty visible

Historical-map coverage varies by series, scale, location, and zoom. External heritage services can also be incomplete or temporarily unavailable. The interface should communicate loading, unavailable coverage, partial results, and upstream failures honestly.

### Keep optional data optional

The initial experience should not wait for every heritage provider. The historical map and primary controls should become usable first; optional overlays should load only when enabled.

### Design for Irish place-finding

Townlands, Irish and English placenames, counties, and local landmarks should be first-class concepts. Generic worldwide geocoding alone is not sufficient.

### Prefer dependable local capabilities

Stable, licensed local indexes and deterministic browser behaviour are preferable to sending every interaction to an unguaranteed public API.

---

## Workstream 1 — Performance and reliability foundation

This work comes first because animation, richer dossiers, and more elaborate interactions will make the current slow paths more visible.

### 1. Establish measurable performance baselines

Before changing the rendering pipeline, capture repeatable desktop and mobile traces for:

- initial historical-map readiness;
- time until the coverage/search circle appears;
- a cold search and a repeated search;
- switching historical series;
- panning with several heritage sources enabled;
- opening and closing a dense place dossier;
- each comparison mode.

Record main-thread long tasks, image-processing time, heritage request counts, failed requests, and time to first usable map. Add lightweight development diagnostics so future work can be compared with the baseline.

### 2. Move historical-image processing off the main thread

`removeBlackNodata()` currently performs canvas reads, a per-pixel loop, and image encoding on the main thread for candidate historical images. This can delay controls and map interaction while a composite loads.

Move this work into a feature-detected Web Worker using `OffscreenCanvas` and `createImageBitmap` where supported, with a safe main-thread fallback. Limit worker concurrency so a fast pan cannot create an unbounded processing queue. Cancel or ignore stale work when the view or selected series changes.

Cache successfully processed results by source image URL in Cache API or IndexedDB with a version and expiry policy. Avoid an unbounded in-memory blob cache.

### 3. Reduce repeat historical-map discovery

Persist successful and failed historical-series availability results with sensible positive and negative expiry times. Invalidate the cache when the discovery algorithm or source configuration changes.

The UI should distinguish:

- checking for coverage;
- loading a known available image;
- no coverage at this location or scale;
- an upstream request failure.

These states should not all appear as an indefinite spinner.

### 4. Reduce heritage request churn

The current cache key changes after relatively small centre movements, which can cause repeated requests to every enabled source.

Replace centre rounding with stable spatial query cells or a movement threshold relative to the query radius. Reuse results while the current view remains sufficiently covered, abort stale requests, and retain independent per-source results so one provider cannot block the rest.

Request counts must reflect the enabled sources. The system can fan out to all 27 registered providers, but it should not do so unless the user has actually enabled all 27.

### 5. Update map features incrementally

The heritage layer is currently removed and recreated when its data changes. Introduce keyed feature reconciliation so unchanged features and clusters survive refreshes.

Profile this improvement before changing every layer to canvas. A shared Leaflet canvas renderer may help very dense views, but it weakens per-feature keyboard interaction. If canvas is introduced, the complete evidence browser must provide an equivalent accessible route to every loaded record. Selected or focused features can remain SVG where that materially improves interaction.

### 6. Add selective connection hints

Preconnect only to origins required for the default first view, principally the active historical-map service and default basemap. Use DNS prefetch, lazy loading, or no hint for optional providers.

Do not preconnect to every ArcGIS endpoint during initial load. Disabled overlays should create effectively no startup work.

### 7. Keep bundle optimisation evidence-led

The initial JavaScript bundle is currently about 129 KB gzip, below the existing 180 KB budget. Manual vendor chunking is therefore not an urgent performance fix.

Track bundle size in CI and introduce chunk splitting or lazy loading when measurement shows a meaningful initial-load or returning-visitor benefit. Avoid adding extra requests and loading complexity merely to produce smaller-looking files.

---

## Workstream 2 — Search and entry experience

### 1. Make search reliable before making it clever

Search should always provide a visible outcome: results, a clear no-results state, or an actionable provider error. It must never silently fail.

Add automated coverage for:

- a known Irish city;
- a townland or small locality;
- Irish-language text;
- no results;
- upstream failure and fallback;
- keyboard submission and result selection;
- mobile search-panel behaviour.

### 2. Build Irish place autocomplete on a dependable index

Do not use public Nominatim for keystroke-by-keystroke autocomplete; its usage policy prohibits that pattern. Photon can remain an explicit-search fallback, but its public demo has no availability guarantee.

Investigate and adopt a redistributable Irish placename or townland dataset that can be indexed locally. Confirm licensing, attribution, update frequency, Irish and English name coverage, hierarchy, and bundle size before selecting it.

The target search experience should include:

- fast local autocomplete;
- townland, settlement, county, and landmark distinctions;
- Irish and English names where available;
- keyboard navigation;
- recent searches stored on the device;
- explicit external geocoding for queries outside the local index.

Logainm can be considered as an enrichment or update source if an appropriate key and usage arrangement are available, but the core search experience should not depend on acquiring credentials.

### 3. Replace the cold start with an exploration gallery

Promote the existing curated locations into a visual exploration gallery with four to six strong destinations. Each card should show a meaningful historical-map crop or designed thumbnail, a date or series, and one sentence explaining why the place is interesting.

Keep this integrated into the normal search and welcome surface rather than introducing a blocking first-run modal.

Provide an optional “Explore near me” action. Request geolocation only after the user presses it, explain why the location is needed, and retain a useful experience when permission is denied.

---

## Workstream 3 — Guided historical stories

Guided stories are the best first major product feature: they use existing map state, solve the “where do I begin?” problem, and demonstrate the application’s strongest capabilities.

### Story model

Define stories as data rather than bespoke components. Each step should support:

- centre and zoom;
- historical series;
- comparison mode and its settings;
- enabled heritage sources;
- optional highlighted feature;
- title, caption, and source notes;
- a fallback view when a historical series has no coverage.

Extend the existing deep-link state only where required. A visitor should be able to share either the complete story or an individual step.

### Story interface

Create a restrained, responsive story player with:

- previous and next controls;
- progress and step title;
- pause or exit back to free exploration;
- keyboard and touch support;
- reduced-motion behaviour;
- a clear transition from curated narrative to independent exploration.

### Initial editorial set

Build three carefully verified stories with contrasting geography and evidence types. Possible themes include:

- Dublin’s vanished streets;
- the Famine landscape of Achill;
- the Martello towers of Dublin Bay;
- the monastic landscape around Clonmacnoise.

The final choices should be based on confirmed map coverage and reliable heritage records, not title appeal alone.

---

## Workstream 4 — Complete evidence browser

The map can load considerably more heritage evidence than the dossier currently reveals. Turning that evidence into an inspectable, filterable collection will make the project valuable to researchers and local historians.

### Evidence browser

Add a full responsive browser for every record currently loaded into the view. It should support:

- grouping by source and evidence type;
- filtering by source, category, and distance;
- sorting by distance or source;
- selecting a result on the map;
- clear per-source loading, success, empty, and failure states;
- list virtualisation when the result set is large;
- provenance and a direct link to the original record where available.

The existing short dossier list can remain as a summary that links to the complete browser.

### Export

Support GeoJSON and CSV export of the currently loaded, currently filtered records. Every export should include:

- source name and source record identifier;
- original source URL where available;
- coordinates and relevant attributes;
- query location, radius, and export timestamp;
- a note identifying sources that failed or were disabled.

Label exports accurately. They are a snapshot of records returned for the active view, not a complete national extract.

---

## Workstream 5 — Time-lapse comparison

Time-lapse should be built after historical-layer readiness, caching, and cancellation are reliable.

### Behaviour

Add a play control that advances through compatible historical series for the current view. Preload the next available series, crossfade only when it is ready, and skip or explain unavailable editions.

The sequence must account for:

- different coverage and scale constraints;
- varying date ranges rather than pretending every layer is one exact year;
- interruption when the user pans, zooms, changes mode, or selects a layer;
- pause, replay, and speed controls;
- reduced-motion preferences;
- mobile controls that do not obscure the map.

The modern basemap can be a final comparison state, but it should be visually and semantically distinct from historical editions.

### Integration with comparison modes

Start with the normal overlay view. Add time-lapse to swipe, side-by-side, or spyglass only after the interaction remains understandable and performs well. Do not attempt every combination in the first implementation.

---

## Workstream 6 — Place dossier enrichment

Enrichment should deepen a place without obscuring the primary evidence or making the application dependent on additional fragile services.

### First enrichment stage

Add carefully attributed Wikipedia/Wikidata context where there is a confident geographic match:

- a short summary;
- a representative image with licence and attribution;
- a link to the source article or entity;
- an explicit indication that this is contextual material, not a heritage record.

Cache responses and avoid showing weak or ambiguous matches.

### Later enrichment candidates

Logainm placename hierarchy and Dúchas folklore could add exceptional Irish context, but both require an access and integration decision. Before implementation, confirm:

- API credentials and permitted client architecture;
- usage limits and reliability;
- caching and redistribution rights;
- attribution requirements;
- geographic matching quality;
- what happens when the service is unavailable.

If these dependencies are unsuitable for a public side project, prefer a licensed downloadable dataset, curated editorial excerpts with links, or omit the integration.

---

## Workstream 7 — Sharing and portfolio presentation

### Dynamic share cards

Replace the single generic social image with designed dynamic cards derived from URL state. The first version should render:

- place or story title;
- historical series and date range;
- comparison mode;
- a consistent Historic Map Viewer visual identity;
- an illustrated or pre-rendered map crop for curated destinations.

Do not make live Leaflet rendering or a fan-out across heritage APIs part of the social-card request path.

Actual arbitrary-view map snapshots can be investigated later. They would require a reliable screenshot or tile-compositing service, aggressive caching, and confirmation that all imagery can be reproduced in share cards.

### Visual overhaul

Apply a coherent visual system across the map shell, panels, story player, dossier, evidence browser, and share cards:

- typography inspired by archival catalogues without sacrificing legibility;
- a restrained palette derived from paper, ink, survey marks, and annotation colours;
- strong hierarchy between map controls, narrative, and evidence;
- consistent spacing, elevation, focus states, and motion;
- touch targets and bottom-sheet behaviour designed for mobile;
- excellent empty, loading, error, and partial-data states.

The map must remain the principal visual surface. Decorative styling should not compete with historical detail or reduce contrast.

---

## Deferred work

### Offline map packs

Do not implement downloadable offline areas until tile-provider terms, storage limits, cache invalidation, eviction, and update behaviour are resolved.

A later PWA phase may add:

- installability;
- an offline application shell;
- cached editorial stories and interface assets;
- carefully bounded caching explicitly permitted by each provider.

This should not imply that third-party historical or basemap tiles are available for unrestricted offline download.

### Broad live enrichment fan-out

Do not query multiple contextual APIs every time the user moves the map. Enrichment should be user-triggered, cached, cancellable, and isolated from core historical-map readiness.

### Every mode in every feature

Stories and time-lapse do not initially need to support every comparison mode. Begin with the smallest coherent interaction, validate it thoroughly, and expand only when the combined controls remain clear.

---

## Recommended implementation sequence

### Chunk 1 — Stable, fast exploration

Group the performance baseline, historical-image worker, availability caching, heritage-query stabilisation, incremental feature updates, and complete search smoke tests.

These changes share the same browser traces, network diagnostics, loading-state work, and regression paths. They are safe to review as one coherent reliability chunk and establish a trustworthy foundation for everything that follows.

### Chunk 2 — A beautiful way in

Build the visual exploration gallery, dependable Irish place autocomplete, guided-story data model, story player, and three initial stories.

These features share content, navigation, deep-linking, responsive layout, and visual design. Together they create a complete first-visit journey rather than a collection of disconnected controls.

### Chunk 3 — Evidence as a serious tool

Build the complete evidence browser, filters, provenance treatment, map/list selection, and GeoJSON/CSV export.

This is one coherent data surface with a shared accessibility and verification path.

### Chunk 4 — The signature visual experience

Implement time-lapse for the standard map view, including preloading, missing-coverage behaviour, interruption, reduced motion, and mobile validation.

Keep it separate because it exercises the historical rendering pipeline heavily and deserves focused performance validation.

### Chunk 5 — Context, sharing, and final portfolio polish

Add staged dossier enrichment, dynamic designed share cards, and the final visual-system pass across all completed surfaces.

External enrichment integrations should remain independently disableable so they cannot compromise the core application.

---

## Validation standard

Every chunk should be tested in the real browser as it is built, not only at the end.

Validation should include:

- desktop and mobile viewport smoke tests;
- keyboard-only navigation;
- touch interactions and panel ergonomics;
- reduced-motion behaviour;
- console and network errors;
- slow-network and failed-provider states;
- historical locations with full, partial, and absent coverage;
- dense and sparse heritage results;
- all existing comparison modes;
- direct URLs, refreshes, browser history, and shared links;
- performance traces compared with the recorded baseline;
- production-build and deployed-site verification.

Add automated tests for deterministic state, data adapters, caching, search fallback, exports, and story definitions. Use browser automation for critical user journeys, while retaining a manual visual review for map rendering and responsive quality.

---

## Definition of success

The renewed Historic Map Viewer should:

- become interactively usable quickly on a normal mobile connection;
- never leave the user guessing whether a map or provider is still loading;
- make Irish places and townlands easy to find;
- give a first-time visitor an immediate, beautiful path into the material;
- expose heritage evidence completely and transparently;
- deliver a memorable temporal comparison without sacrificing performance;
- remain useful when optional upstream providers fail;
- look and behave like a deliberate historical atlas rather than a collection of map controls.
