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
