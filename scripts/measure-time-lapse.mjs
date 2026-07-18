import { chromium } from "@playwright/test";

const baseUrl = (process.env.PERFORMANCE_URL ??
  "http://127.0.0.1:5173").replace(/\/$/, "");
const path =
  "/#53.34980,-6.26030,12,6inch-1st,light,0.58,overlay,multiply";
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

const browser = await chromium.launch();
const results = [];

try {
  for (const viewport of viewports) {
    results.push(await measureTimeLapse(browser, viewport));
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

if (results.some((result) => !result.ready || result.maxHistoricalLayers > 2)) {
  process.exitCode = 1;
}

async function measureTimeLapse(browserInstance, viewport) {
  const context = await browserInstance.newContext({ viewport });
  const page = await context.newPage();
  const failedRequests = [];
  page.on("requestfailed", (request) => {
    failedRequests.push({
      url: request.url(),
      error: request.failure()?.errorText,
    });
  });
  await page.addInitScript(() => {
    window.__historicMapLongTasks = [];
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__historicMapLongTasks.push(entry.duration);
        }
      });
      observer.observe({ type: "longtask", buffered: true });
    } catch {
      // Long-task diagnostics are optional in older engines.
    }
  });

  await page.goto(`${baseUrl}${path}`, {
    waitUntil: "domcontentloaded",
    timeout: 15_000,
  });
  await page.waitForSelector('.timeline-console[data-playback-state="idle"]');
  await page
    .getByRole("combobox", { name: "Time travel speed" })
    .selectOption("fast");

  const startedAt = performance.now();
  await page.getByRole("button", { name: "Play time travel" }).click();
  let maxHistoricalLayers = 0;
  const layerSample = setInterval(async () => {
    try {
      maxHistoricalLayers = Math.max(
        maxHistoricalLayers,
        await page.locator(".leaflet-historical-pane .leaflet-layer").count(),
      );
    } catch {
      // The page can close after the final sample.
    }
  }, 50);

  await page.waitForFunction(
    () =>
      ["available", "partial"].includes(
        document.querySelector(".timeline-console")?.getAttribute(
          "data-preload-status",
        ) ?? "",
      ),
    undefined,
    { timeout: 15_000 },
  );
  const preloadReadyMs = Math.round(performance.now() - startedAt);
  await page
    .getByRole("button", { name: "1859–1917", exact: true })
    .waitFor({ state: "attached", timeout: 5_000 });
  await page.waitForFunction(
    () =>
      document
        .querySelector('.timeline-rail button[aria-current="true"]')
        ?.textContent?.trim() === "1859–1917",
    undefined,
    { timeout: 5_000 },
  );
  const firstTransitionMs = Math.round(performance.now() - startedAt);
  clearInterval(layerSample);
  await page.getByRole("button", { name: "Pause time travel" }).click();

  const diagnostics = await page.evaluate(() => {
    const tasks = window.__historicMapLongTasks ?? [];
    const player = document
      .querySelector(".time-lapse-player")
      ?.getBoundingClientRect();
    return {
      longTasks: {
        count: tasks.length,
        totalMs: Math.round(tasks.reduce((total, value) => total + value, 0)),
        maxMs: Math.round(Math.max(0, ...tasks)),
      },
      playerWithinViewport: Boolean(
        player &&
          player.left >= 0 &&
          player.right <= innerWidth &&
          player.bottom <= innerHeight,
      ),
    };
  });

  const abortedRequests = failedRequests.filter((request) =>
    request.error?.includes("ERR_ABORTED"),
  );
  const unexpectedFailures = failedRequests.filter(
    (request) => !request.error?.includes("ERR_ABORTED"),
  );
  await context.close();
  return {
    viewport: viewport.name,
    ready: true,
    preloadReadyMs,
    firstTransitionMs,
    maxHistoricalLayers,
    abortedStaleRequestCount: abortedRequests.length,
    unexpectedFailureCount: unexpectedFailures.length,
    unexpectedFailures,
    ...diagnostics,
  };
}
