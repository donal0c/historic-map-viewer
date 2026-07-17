#!/usr/bin/env node

const probes = {
  "six-inch-first":
    "https://mapseries-tilesets.s3.amazonaws.com/os/roscommon/10/488/330.png",
  "six-inch-second":
    "https://mapseries-tilesets.s3.amazonaws.com/os/roscommon_2nd/10/488/330.png",
  "one-inch-first":
    "https://mapseries-tilesets.s3.amazonaws.com/os/ireland_1inch_1st_hills/8/122/82.png",
  "one-inch-second":
    "https://mapseries-tilesets.s3.amazonaws.com/os/ireland_1inch_2nd_contours/8/122/82.png",
  "war-office":
    "https://mapseries-tilesets.s3.amazonaws.com/ireland/gsgs4136/8/122/82.png",
  bartholomew:
    "https://mapseries-tilesets.s3.amazonaws.com/ireland/bartholomew/8/122/82.png",
};

async function probe([id, url]) {
  const started = performance.now();
  try {
    const response = await fetch(url, {
      headers: { Range: "bytes=0-63" },
      signal: AbortSignal.timeout(8000),
    });
    const contentType = response.headers.get("content-type") ?? "";
    const ok =
      (response.status === 200 || response.status === 206) &&
      contentType.includes("image/png");
    return {
      id,
      ok,
      status: response.status,
      contentType,
      latencyMs: Math.round(performance.now() - started),
      url,
    };
  } catch (error) {
    return {
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      latencyMs: Math.round(performance.now() - started),
      url,
    };
  }
}

const results = await Promise.all(Object.entries(probes).map(probe));
const failures = results.filter((result) => !result.ok);
console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      summary: {
        series: results.length,
        healthy: results.length - failures.length,
        failed: failures.length,
      },
      results,
    },
    null,
    2,
  ),
);
process.exitCode = failures.length ? 1 : 0;
