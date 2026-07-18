import { chromium } from "@playwright/test";

const baseUrl = (process.env.PERFORMANCE_URL ??
  "http://127.0.0.1:5173").replace(/\/$/, "");

const scenarios = [
  {
    name: "default overview",
    path: "/",
  },
  {
    name: "six-inch composite",
    path: "/#53.50000,-8.00000,10,6inch-1st,osm,0.70,overlay,normal",
  },
];

const browser = await chromium.launch();
const results = [];

try {
  for (const scenario of scenarios) {
    results.push(await measureScenario(browser, scenario));
  }
} finally {
  await browser.close();
}

console.log(
  JSON.stringify(
    {
      measuredAt: new Date().toISOString(),
      baseUrl,
      scenarios: results,
    },
    null,
    2,
  ),
);

if (results.some((result) => !result.ready || !result.heritageSettled)) {
  process.exitCode = 1;
}

async function measureScenario(browserInstance, scenario) {
  const context = await browserInstance.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");

  await page.addInitScript(() => {
    window.__historicMapLongTasks = [];
    if ("PerformanceObserver" in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.__historicMapLongTasks.push({
              duration: entry.duration,
              startTime: entry.startTime,
            });
          }
        });
        observer.observe({ type: "longtask", buffered: true });
      } catch {
        // Long-task observation is diagnostic and browser-dependent.
      }
    }
  });

  const requests = [];
  const failedRequests = [];
  page.on("request", (request) => {
    const url = request.url();
    if (!url.startsWith("blob:") && !url.startsWith("data:")) {
      requests.push(url);
    }
  });
  page.on("requestfailed", (request) => {
    failedRequests.push({
      url: request.url(),
      error: request.failure()?.errorText,
    });
  });

  const startedAt = performance.now();
  await page.goto(`${baseUrl}${scenario.path}`, {
    waitUntil: "domcontentloaded",
    timeout: 15_000,
  });
  await page.waitForFunction(
    () => {
      const dossier = document.querySelector(".place-dossier, .dossier-peek");
      return (
        dossier?.dataset.historicalStatus !== "idle" &&
        dossier?.dataset.historicalStatus !== "loading"
      );
    },
    undefined,
    { timeout: 15_000 },
  );
  const historicalReadyMs = Math.round(performance.now() - startedAt);
  let heritageSettled = true;
  try {
    await page.waitForFunction(
      () => {
        const dossier = document.querySelector(".place-dossier, .dossier-peek");
        return ["ready", "error"].includes(
          dossier?.dataset.heritageStatus ?? "",
        );
      },
      undefined,
      { timeout: 10_000 },
    );
  } catch {
    heritageSettled = false;
  }
  const settledMs = Math.round(performance.now() - startedAt);

  const pageDiagnostics = await page.evaluate(() => {
    const longTasks = window.__historicMapLongTasks ?? [];
    const measures = performance
      .getEntriesByType("measure")
      .filter((entry) => entry.name.startsWith("historic-map:"));
    const status = document
      .querySelector(
        '.place-dossier [role="status"], .dossier-peek > small',
      )
      ?.textContent?.trim();

    return {
      status,
      longTasks: {
        count: longTasks.length,
        totalMs: Math.round(
          longTasks.reduce((total, entry) => total + entry.duration, 0),
        ),
        maxMs: Math.round(
          Math.max(0, ...longTasks.map((entry) => entry.duration)),
        ),
      },
      measures: Object.fromEntries(
        [...new Set(measures.map((entry) => entry.name))].map((name) => {
          const durations = measures
            .filter((entry) => entry.name === name)
            .map((entry) => entry.duration);
          return [
            name,
            {
              count: durations.length,
              totalMs: Math.round(
                durations.reduce((total, duration) => total + duration, 0),
              ),
              maxMs: Math.round(Math.max(0, ...durations)),
            },
          ];
        }),
      ),
    };
  });

  const performanceMetrics = await cdp.send("Performance.getMetrics");
  const metrics = Object.fromEntries(
    performanceMetrics.metrics
      .filter((metric) =>
        [
          "TaskDuration",
          "ScriptDuration",
          "LayoutDuration",
          "RecalcStyleDuration",
          "JSHeapUsedSize",
        ].includes(metric.name),
      )
      .map((metric) => [
        metric.name,
        metric.name === "JSHeapUsedSize"
          ? Math.round(metric.value)
          : Math.round(metric.value * 1000),
      ]),
  );

  const result = {
    name: scenario.name,
    ready: Boolean(pageDiagnostics.status),
    historicalReadyMs,
    heritageSettled,
    settledMs,
    status: pageDiagnostics.status,
    requestCount: requests.length,
    requestsByHost: countByHost(requests),
    failedRequests,
    longTasks: pageDiagnostics.longTasks,
    measures: pageDiagnostics.measures,
    metrics,
  };
  await context.close();
  return result;
}

function countByHost(urls) {
  return Object.fromEntries(
    [...urls.reduce((counts, url) => {
      const host = new URL(url).host;
      counts.set(host, (counts.get(host) ?? 0) + 1);
      return counts;
    }, new Map())].sort(([left], [right]) => left.localeCompare(right)),
  );
}
