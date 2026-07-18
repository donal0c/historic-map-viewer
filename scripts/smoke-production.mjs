const baseUrl = (process.env.PRODUCTION_URL ??
  "https://historicmapviewer.vercel.app").replace(/\/$/, "");

const checks = [];
const home = await timedFetch(`${baseUrl}/`);
const html = await home.response.text();
checks.push({
  name: "atlas document",
  ok:
    home.response.ok &&
    html.includes("Historic Map Viewer — Ireland's past, in place") &&
    /assets\/index-[^"]+\.js/.test(html),
  status: home.response.status,
  latencyMs: home.latencyMs,
});

// The probe query defeats the CDN cache so a stale success cannot hide a
// provider or serverless-function failure.
const search = await timedFetch(
  `${baseUrl}/api/search?q=Dublin&probe=${Date.now()}`,
);
const rows = await search.response.json().catch(() => []);
checks.push({
  name: "place search",
  ok:
    search.response.ok &&
    search.response.headers.get("x-geocoder-provider") === "photon" &&
    Array.isArray(rows) &&
    rows.some((row) => String(row.display_name ?? "").includes("Dublin")),
  status: search.response.status,
  latencyMs: search.latencyMs,
  provider: search.response.headers.get("x-geocoder-provider"),
});

const context = await timedFetch(
  `${baseUrl}/api/context?lat=53.3438&lng=-6.2675&label=Dublin&probe=${Date.now()}`,
);
const contextBody = await context.response.json().catch(() => ({}));
checks.push({
  name: "attributed place context",
  ok:
    context.response.ok &&
    context.response.headers.get("x-context-provider") === "wikipedia" &&
    contextBody.context?.title === "Dublin" &&
    String(contextBody.context?.pageUrl ?? "").includes("wikipedia.org/wiki/Dublin"),
  status: context.response.status,
  latencyMs: context.latencyMs,
  provider: context.response.headers.get("x-context-provider"),
});

const card = await timedFetch(
  `${baseUrl}/api/og?title=Explore+Dublin&layer=6-Inch+1st+Edition&mode=Overlay`,
);
const cardBytes = await card.response.arrayBuffer();
checks.push({
  name: "designed share card",
  ok:
    card.response.ok &&
    card.response.headers.get("content-type")?.startsWith("image/png") &&
    cardBytes.byteLength > 10_000,
  status: card.response.status,
  latencyMs: card.latencyMs,
  bytes: cardBytes.byteLength,
});

const share = await timedFetch(
  `${baseUrl}/share?title=Explore+Dublin&description=Historic+map+view&target=%2F%23smoke`,
);
const shareHtml = await share.response.text();
checks.push({
  name: "state-aware share route",
  ok:
    share.response.ok &&
    shareHtml.includes('property="og:title" content="Explore Dublin"') &&
    shareHtml.includes("/api/og?") &&
    shareHtml.includes("/#smoke"),
  status: share.response.status,
  latencyMs: share.latencyMs,
});

console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      baseUrl,
      healthy: checks.every((check) => check.ok),
      checks,
    },
    null,
    2,
  ),
);

if (checks.some((check) => !check.ok)) process.exitCode = 1;

async function timedFetch(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const started = performance.now();
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "HistoricMapViewer-ProductionSmoke/1.0" },
    });
    return {
      response,
      latencyMs: Math.round(performance.now() - started),
    };
  } finally {
    clearTimeout(timeout);
  }
}
