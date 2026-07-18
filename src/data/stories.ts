import type {
  BlendMode,
  HeritageLayerId,
  SearchResult,
  ViewMode,
} from "../types";

export interface StoryStep {
  id: string;
  title: string;
  caption: string;
  sourceNote: string;
  center: [number, number];
  zoom: number;
  activeLayerId: string;
  mode: ViewMode;
  blendMode?: BlendMode;
  opacity?: number;
  enabledSources: HeritageLayerId[];
}

export interface AtlasStory {
  id: string;
  number: string;
  eyebrow: string;
  title: string;
  summary: string;
  place: string;
  previewUrl: string;
  steps: StoryStep[];
}

export interface AtlasDestination extends SearchResult {
  period: string;
  previewUrl: string;
}

export const atlasStories: AtlasStory[] = [
  {
    id: "dublin-redrawn",
    number: "01",
    eyebrow: "City / archaeology",
    title: "Dublin, redrawn",
    summary:
      "Trace the medieval core through two Ordnance Survey editions and the evidence that sits beneath the modern streets.",
    place: "Dublin",
    previewUrl: historicalPreviewUrl(53.3438, -6.2675),
    steps: [
      {
        id: "survey",
        title: "A city fixed on paper",
        caption:
          "The first six-inch survey records a compact city at extraordinary detail. Start with the street pattern, river edge, and the dense grain around the old core.",
        sourceNote:
          "Map: OS Ireland 6-Inch 1st Edition, courtesy of NLS. Evidence: National Monuments Service.",
        center: [53.3438, -6.2675],
        zoom: 14,
        activeLayerId: "6inch-1st",
        mode: "overlay",
        blendMode: "multiply",
        opacity: 0.76,
        enabledSources: ["smr", "urban-zones", "dublin-medieval"],
      },
      {
        id: "revision",
        title: "The revised city",
        caption:
          "Move to the later six-inch edition and use the reveal to compare what persisted, what was recut, and where the city pressed outward.",
        sourceNote:
          "Map: OS Ireland 6-Inch 2nd Edition, courtesy of NLS. Comparison is cartographic, not a claim that every change happened at one date.",
        center: [53.3444, -6.2692],
        zoom: 15,
        activeLayerId: "6inch-2nd",
        mode: "swipe",
        opacity: 0.82,
        enabledSources: ["smr", "urban-zones", "dublin-medieval"],
      },
      {
        id: "evidence",
        title: "Buildings and excavations",
        caption:
          "The historical sheet becomes a working index: architectural records and excavations reveal how many different kinds of evidence occupy the same streets.",
        sourceNote:
          "Evidence: NIAH, Excavations.ie, National Monuments Service and Heritage Maps. Select any marker for its source record.",
        center: [53.3451, -6.2626],
        zoom: 15,
        activeLayerId: "6inch-2nd",
        mode: "overlay",
        blendMode: "multiply",
        opacity: 0.68,
        enabledSources: ["niah", "excavations", "dublin-medieval"],
      },
    ],
  },
  {
    id: "glendalough-valley",
    number: "02",
    eyebrow: "Valley / sacred landscape",
    title: "Glendalough, held in the valley",
    summary:
      "Read the monastic landscape at the scale of paths, water, relief, and the wider constellation of recorded monuments.",
    place: "Glendalough",
    previewUrl: historicalPreviewUrl(53.0105, -6.3272),
    steps: [
      {
        id: "valley",
        title: "The shape of the valley",
        caption:
          "Begin with the first survey. Water, steep ground, roads, and settlement are shown together, making the valley itself part of the historical record.",
        sourceNote:
          "Map: OS Ireland 6-Inch 1st Edition, courtesy of NLS. The survey is presented as a historical source in its own right.",
        center: [53.0105, -6.3272],
        zoom: 14,
        activeLayerId: "6inch-1st",
        mode: "overlay",
        blendMode: "multiply",
        opacity: 0.78,
        enabledSources: ["smr", "holy-wells", "monuments-to-visit"],
      },
      {
        id: "monuments",
        title: "A constellation, not one point",
        caption:
          "Recorded monuments spread beyond the best-known cluster. The overlay encourages a landscape reading rather than a single-site visit.",
        sourceNote:
          "Evidence: National Monuments Service. Marker positions and descriptions link back to the public source records.",
        center: [53.0112, -6.325],
        zoom: 15,
        activeLayerId: "6inch-1st",
        mode: "overlay",
        blendMode: "multiply",
        opacity: 0.65,
        enabledSources: ["smr", "zones", "holy-wells", "monuments-to-visit"],
      },
      {
        id: "second-survey",
        title: "A second reading",
        caption:
          "The revised six-inch sheet offers another view of the same valley. Compare editions carefully: survey conventions and publication ranges differ.",
        sourceNote:
          "Map: OS Ireland 6-Inch 2nd Edition, courtesy of NLS. Date ranges describe map editions, not a single survey day.",
        center: [53.0105, -6.3272],
        zoom: 14,
        activeLayerId: "6inch-2nd",
        mode: "swipe",
        opacity: 0.8,
        enabledSources: ["smr", "holy-wells", "monuments-to-visit"],
      },
    ],
  },
  {
    id: "clonmacnoise-crossroads",
    number: "03",
    eyebrow: "River / monastic landscape",
    title: "Clonmacnoise at the crossroads",
    summary:
      "Explore the relationship between a monastic place, the Shannon, routes across the bog, and layers of recorded evidence.",
    place: "Clonmacnoise",
    previewUrl: historicalPreviewUrl(53.326, -7.986),
    steps: [
      {
        id: "river",
        title: "A place beside the Shannon",
        caption:
          "At this scale, Clonmacnoise is inseparable from the river and its floodplain. The survey makes routes, water, and marginal ground legible together.",
        sourceNote:
          "Map: OS Ireland 6-Inch 1st Edition, courtesy of NLS. Evidence: National Monuments Service.",
        center: [53.326, -7.986],
        zoom: 14,
        activeLayerId: "6inch-1st",
        mode: "overlay",
        blendMode: "multiply",
        opacity: 0.77,
        enabledSources: ["smr", "monuments-to-visit", "historic-graves"],
      },
      {
        id: "recorded-landscape",
        title: "The wider recorded landscape",
        caption:
          "Zoom out just enough to see how the public records extend around the familiar monument complex and along the river corridor.",
        sourceNote:
          "Evidence: National Monuments Service and Historic Graves. Loaded records depend on the current view and live provider availability.",
        center: [53.3275, -7.982],
        zoom: 13,
        activeLayerId: "6inch-1st",
        mode: "overlay",
        blendMode: "multiply",
        opacity: 0.64,
        enabledSources: ["smr", "holy-wells", "historic-graves"],
      },
      {
        id: "edition-change",
        title: "The landscape resurveyed",
        caption:
          "The later edition lets you compare linework and emphasis across time without pretending that every visible difference is a physical change.",
        sourceNote:
          "Map: OS Ireland 6-Inch 2nd Edition, courtesy of NLS. Use the swipe as a question-making tool, not automatic proof of change.",
        center: [53.326, -7.986],
        zoom: 14,
        activeLayerId: "6inch-2nd",
        mode: "swipe",
        opacity: 0.82,
        enabledSources: ["smr", "monuments-to-visit", "historic-graves"],
      },
    ],
  },
];

export const atlasDestinations: AtlasDestination[] = [
  {
    id: "curated-dublin",
    label: "Medieval Dublin",
    detail: "City walls, archaeology and architectural layers",
    period: "1829–1913",
    lat: 53.3438,
    lng: -6.2675,
    source: "curated",
    previewUrl: historicalPreviewUrl(53.3438, -6.2675),
  },
  {
    id: "curated-glendalough",
    label: "Glendalough",
    detail: "A monastic landscape held by the Wicklow valley",
    period: "1837–1909",
    lat: 53.0105,
    lng: -6.3272,
    source: "curated",
    previewUrl: historicalPreviewUrl(53.0105, -6.3272),
  },
  {
    id: "curated-cobh",
    label: "Cobh",
    detail: "Maritime heritage around Cork Harbour",
    period: "1841–1913",
    lat: 51.8503,
    lng: -8.2943,
    source: "curated",
    previewUrl: historicalPreviewUrl(51.8503, -8.2943),
  },
  {
    id: "curated-clonmacnoise",
    label: "Clonmacnoise",
    detail: "Monastic evidence beside the Shannon",
    period: "1838–1912",
    lat: 53.326,
    lng: -7.986,
    source: "curated",
    previewUrl: historicalPreviewUrl(53.326, -7.986),
  },
  {
    id: "curated-kilkenny",
    label: "Kilkenny",
    detail: "A dense historic town and medieval core",
    period: "1839–1900",
    lat: 52.6541,
    lng: -7.2448,
    source: "curated",
    previewUrl: historicalPreviewUrl(52.6541, -7.2448),
  },
  {
    id: "curated-galway",
    label: "Galway",
    detail: "Urban archaeology at the Atlantic edge",
    period: "1839–1899",
    lat: 53.274,
    lng: -9.049,
    source: "curated",
    previewUrl: historicalPreviewUrl(53.274, -9.049),
  },
];

export function historicalPreviewUrl(lat: number, lng: number, zoom = 12) {
  const x = Math.floor(((lng + 180) / 360) * 2 ** zoom);
  const latitudeRadians = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2) * 2 ** zoom,
  );
  return `https://mapseries-tilesets.s3.amazonaws.com/os/ireland_1inch_1st_hills/${zoom}/${x}/${y}.png`;
}

export function readStoryRoute(search: string) {
  const params = new URLSearchParams(search);
  const story = atlasStories.find((candidate) => candidate.id === params.get("story"));
  if (!story) return null;
  const requestedStep = Number.parseInt(params.get("step") ?? "1", 10) - 1;
  const stepIndex = Math.max(
    0,
    Math.min(Number.isFinite(requestedStep) ? requestedStep : 0, story.steps.length - 1),
  );
  return { storyId: story.id, stepIndex };
}

export function storyUrl(storyId: string | null, stepIndex = 0) {
  const url = new URL(window.location.href);
  if (storyId) {
    url.searchParams.set("story", storyId);
    url.searchParams.set("step", String(stepIndex + 1));
  } else {
    url.searchParams.delete("story");
    url.searchParams.delete("step");
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
