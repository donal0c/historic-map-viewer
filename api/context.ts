import {
  selectContextCandidate,
  type ContextCandidate,
  type PlaceContext,
  type PlaceContextImage,
} from "../src/lib/placeContext";

const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const REQUEST_HEADERS = {
  Accept: "application/json",
  "User-Agent": "HistoricMapViewer/1.0 (https://historicmapviewer.vercel.app)",
};

interface WikipediaResponse {
  query?: { pages?: ContextCandidate[] };
}

interface CommonsResponse {
  query?: {
    pages?: Array<{
      imageinfo?: Array<{
        url?: string;
        descriptionurl?: string;
        extmetadata?: Record<string, { value?: string }>;
      }>;
    }>;
  };
}

export async function GET(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return Response.json(
      { error: "Method not allowed" },
      { status: 405, headers: { Allow: "GET" } },
    );
  }

  const params = new URL(request.url).searchParams;
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const label =
    params.get("label")?.replace(/\+/g, " ").trim().slice(0, 160) || undefined;
  if (!isIrishCoordinate(lat, lng)) {
    return Response.json({ error: "Invalid Irish map coordinate" }, { status: 400 });
  }

  try {
    const wikipediaUrl = new URL(WIKIPEDIA_API);
    wikipediaUrl.search = new URLSearchParams({
      action: "query",
      generator: "geosearch",
      ggscoord: `${lat}|${lng}`,
      ggsradius: "8000",
      ggslimit: "12",
      prop: "extracts|pageimages|info|pageprops|coordinates",
      exintro: "1",
      explaintext: "1",
      exsentences: "3",
      piprop: "name",
      inprop: "url",
      format: "json",
      formatversion: "2",
    }).toString();

    const exactUrl = label ? exactTitleUrl(label) : undefined;
    const responses = await Promise.all([
      fetch(wikipediaUrl, {
        headers: REQUEST_HEADERS,
        signal: AbortSignal.timeout(6_000),
      }),
      exactUrl
        ? fetch(exactUrl, {
            headers: REQUEST_HEADERS,
            signal: AbortSignal.timeout(6_000),
          })
        : undefined,
    ]);
    if (!responses[0].ok) throw new Error(`Wikipedia ${responses[0].status}`);
    const wikipedia = (await responses[0].json()) as WikipediaResponse;
    const exactResponse = responses[1];
    const exact =
      exactResponse?.ok
        ? ((await exactResponse.json()) as WikipediaResponse)
        : undefined;
    const selection = selectContextCandidate(
      [
        ...(exact?.query?.pages ?? []),
        ...(wikipedia.query?.pages ?? []),
      ],
      label,
      [lat, lng],
    );

    if (!selection) {
      return Response.json(
        { context: null },
        { headers: contextCacheHeaders("none") },
      );
    }

    const { candidate, distanceMeters, matchedBy } = selection;
    const image = candidate.pageimage
      ? await fetchCommonsImage(candidate.pageimage)
      : undefined;
    const context: PlaceContext = {
      title: candidate.title,
      summary: candidate.extract ?? "",
      pageUrl: candidate.fullurl ?? "",
      wikidataUrl: candidate.pageprops?.wikibase_item
        ? `https://www.wikidata.org/wiki/${candidate.pageprops.wikibase_item}`
        : undefined,
      distanceMeters: Math.round(distanceMeters),
      matchedBy,
      image,
    };
    return Response.json(
      { context },
      { headers: contextCacheHeaders("wikipedia") },
    );
  } catch (error) {
    console.error("Place context request failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json(
      { error: "Place context is temporarily unavailable" },
      { status: 502 },
    );
  }
}

function exactTitleUrl(label: string): URL {
  const url = new URL(WIKIPEDIA_API);
  const title = label.split(",")[0]?.trim() || label;
  url.search = new URLSearchParams({
    action: "query",
    titles: title,
    redirects: "1",
    prop: "extracts|pageimages|info|pageprops|coordinates",
    exintro: "1",
    explaintext: "1",
    exsentences: "3",
    piprop: "name",
    inprop: "url",
    format: "json",
    formatversion: "2",
  }).toString();
  return url;
}

async function fetchCommonsImage(filename: string): Promise<PlaceContextImage | undefined> {
  const commonsUrl = new URL(COMMONS_API);
  commonsUrl.search = new URLSearchParams({
    action: "query",
    titles: filename.startsWith("File:") ? filename : `File:${filename}`,
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "1200",
    format: "json",
    formatversion: "2",
  }).toString();
  const response = await fetch(commonsUrl, {
    headers: REQUEST_HEADERS,
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) return undefined;
  const body = (await response.json()) as CommonsResponse;
  const info = body.query?.pages?.[0]?.imageinfo?.[0];
  const metadata = info?.extmetadata;
  const licence = plainText(metadata?.LicenseShortName?.value);
  const licenceUrl = safeHttpsUrl(metadata?.LicenseUrl?.value);
  const artist = plainText(metadata?.Artist?.value);
  const url = safeHttpsUrl(info?.url);
  const sourceUrl = safeHttpsUrl(info?.descriptionurl);
  if (!licence || !licenceUrl || !artist || !url || !sourceUrl) return undefined;
  return {
    url,
    sourceUrl,
    artist,
    credit: plainText(metadata?.Credit?.value) || undefined,
    licence,
    licenceUrl,
  };
}

function plainText(value?: string): string {
  return (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

function safeHttpsUrl(value?: string): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function isIrishCoordinate(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 51 && lat <= 56 && lng >= -11 && lng <= -5;
}

function contextCacheHeaders(provider: string): HeadersInit {
  return {
    "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    "X-Context-Provider": provider,
  };
}
