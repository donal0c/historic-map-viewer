const NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search";

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
      ?.trim() ?? "";
  if (query.length < 2 || query.length > 120) {
    return Response.json({ error: "Enter at least two characters" }, { status: 400 });
  }

  const params = new URLSearchParams({
    q: `${query}, Ireland`,
    format: "jsonv2",
    addressdetails: "1",
    limit: "6",
    countrycodes: "ie",
  });

  try {
    const response = await fetch(`${NOMINATIM_SEARCH}?${params}`, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en",
        "User-Agent":
          "HistoricMapViewer/1.0 (https://historicmapviewer.vercel.app)",
      },
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) {
      return Response.json(
        { error: "Place search is temporarily unavailable" },
        { status: 502 },
      );
    }
    return new Response(await response.text(), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return Response.json(
      { error: "Place search timed out" },
      { status: 504 },
    );
  }
}
