const PHOTON_SEARCH = "https://photon.komoot.io/api/";

interface PhotonFeature {
  properties?: {
    osm_type?: string;
    osm_id?: number | string;
    name?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    countrycode?: string;
  };
  geometry?: {
    type?: string;
    coordinates?: unknown;
  };
}

interface PhotonResponse {
  features?: PhotonFeature[];
}

export async function GET(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return Response.json(
      { error: "Method not allowed" },
      { status: 405, headers: { Allow: "GET" } },
    );
  }

  const query =
    new URL(request.url, "https://historicmapviewer.vercel.app").searchParams
      .get("q")
      ?.replace(/\+/g, " ")
      ?.trim() ?? "";
  if (query.length < 2 || query.length > 120) {
    return Response.json({ error: "Enter at least two characters" }, { status: 400 });
  }

  const params = new URLSearchParams({
    q: `${query}, Ireland`,
    limit: "10",
    lang: "en",
  });

  try {
    const response = await fetch(`${PHOTON_SEARCH}?${params}`, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "HistoricMapViewer/1.0 (https://historicmapviewer.vercel.app)",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      console.error("Photon place search failed", { status: response.status });
      return Response.json(
        { error: "Place search is temporarily unavailable" },
        { status: 502 },
      );
    }
    const body = (await response.json()) as PhotonResponse;
    const rows = (body.features ?? [])
      .filter((feature) => feature.properties?.countrycode === "IE")
      .map(normalisePhotonFeature)
      .filter((row): row is NonNullable<typeof row> => row !== undefined)
      .slice(0, 6);

    return Response.json(rows, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        "X-Geocoder-Provider": "photon",
      },
    });
  } catch (error) {
    console.error("Photon place search timed out", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json(
      { error: "Place search timed out" },
      { status: 504 },
    );
  }
}

function normalisePhotonFeature(feature: PhotonFeature) {
  const coordinates = feature.geometry?.coordinates;
  const properties = feature.properties;
  if (
    feature.geometry?.type !== "Point" ||
    !Array.isArray(coordinates) ||
    coordinates.length < 2 ||
    !properties?.name
  ) {
    return undefined;
  }

  const [lon, lat] = coordinates;
  if (typeof lat !== "number" || typeof lon !== "number") return undefined;

  const parts = [
    properties.name,
    properties.city !== properties.name ? properties.city : undefined,
    properties.county,
    properties.state,
    properties.country,
  ].filter(
    (part, index, all): part is string =>
      Boolean(part) && all.indexOf(part) === index,
  );

  return {
    place_id: `${properties.osm_type ?? "osm"}-${properties.osm_id ?? `${lat}-${lon}`}`,
    display_name: parts.join(", "),
    lat: String(lat),
    lon: String(lon),
  };
}
