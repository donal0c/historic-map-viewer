import { expect, test, type Page } from "@playwright/test";
import axe from "axe-core";

const TRANSPARENT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlIoAAAAASUVORK5CYII=",
  "base64",
);

async function mockPublicSources(
  page: Page,
  options: { featuresPerSource?: number; failSource?: RegExp } = {},
) {
  let heritageRequests = 0;

  await page.route(/(tile\.openstreetmap|basemaps\.cartocdn|server\.arcgisonline|mapseries-tilesets)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: TRANSPARENT_PNG,
    });
  });

  await page.route(/arcgis\/rest\/services\/.+\/query/, async (route) => {
    heritageRequests += 1;
    const requestUrl = route.request().url();
    if (options.failSource?.test(requestUrl)) {
      await route.fulfill({ status: 503, body: "Upstream unavailable" });
      return;
    }
    const geometry = requestUrl.includes("Canals")
      || requestUrl.includes("Disused_Railways")
      ? {
          type: "LineString",
          coordinates: [
            [-8.01, 53.49],
            [-8, 53.5],
            [-7.99, 53.51],
          ],
        }
      : requestUrl.includes("Navigable_Waterways")
        ? {
            type: "Polygon",
            coordinates: [[
              [-8.01, 53.49],
              [-7.99, 53.49],
              [-7.99, 53.51],
              [-8.01, 53.51],
              [-8.01, 53.49],
            ]],
          }
        : null;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        type: "FeatureCollection",
        features: Array.from(
          { length: options.featuresPerSource ?? 1 },
          (_, index) => ({
            type: "Feature",
            geometry: geometry ?? {
              type: "Point",
              coordinates: [-8 + index * 0.00003, 53.5 + index * 0.00003],
            },
            properties: {
              OBJECTID: `${heritageRequests}-${index}`,
              NAME: "Test evidence",
              MONUMENT_CLASS: "Recorded site",
              Wreck_Name: "Test wreck",
              SMRS: `TEST-${heritageRequests}-${index}`,
              WEBSITE_LINK: "https://example.com/public-record",
            },
          }),
        ),
      }),
    });
  });

  return () => heritageRequests;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
});

test("searches for an Irish place and restores it from the share URL", async ({
  page,
}) => {
  await mockPublicSources(page);
  await page.route(/nominatim\.openstreetmap\.org\/search/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          place_id: 14583995,
          display_name: "Ballinasloe, County Galway, Connacht, Ireland",
          lat: "53.3302722",
          lon: "-8.2213760",
        },
      ]),
    });
  });

  await page.goto("/");
  await page.getByRole("combobox", { name: "Search place" }).fill("Ballinasloe");
  await page.getByRole("button", { name: "Search beyond townlands" }).click();
  await expect(
    page.getByRole("button", { name: /Ballinasloe, County Galway/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Ballinasloe, County Galway/ })
    .click();

  await expect(page.getByRole("combobox", { name: "Search place" })).toHaveValue(
    "Ballinasloe, County Galway",
  );
  await expect(page).toHaveURL(/53\.33027,-8\.22138/);
  await expect(page).toHaveURL(/Ballinasloe%2C%20County%20Galway/);

  const sharedUrl = page.url();
  await page.reload();
  await expect(page).toHaveURL(sharedUrl);
  await expect(page.getByRole("combobox", { name: "Search place" })).toHaveValue(
    "Ballinasloe, County Galway",
  );
});

test("autocompletes Irish and English townland names without an external request", async ({
  page,
}) => {
  await mockPublicSources(page);
  let externalSearches = 0;
  await page.route("**/data/places/b.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        [
          "40641",
          "Ballymore",
          "An Baile Mór",
          "Cork",
          "Corcaigh",
          51.98,
          -8.26,
        ],
      ]),
    });
  });
  await page.route(/nominatim\.openstreetmap\.org\/search/, async (route) => {
    externalSearches += 1;
    await route.fulfill({ status: 200, body: "[]" });
  });

  await page.goto("/");
  const input = page.getByRole("combobox", { name: "Search place" });
  await input.fill("Baile Mór");
  await expect(page.locator(".search-results-label")).toContainText(
    "Irish townlands",
  );
  await input.press("ArrowDown");
  await expect(
    page.getByRole("button", { name: /An Baile Mór Ballymore/ }),
  ).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(input).toHaveValue("An Baile Mór");
  expect(externalSearches).toBe(0);
  await expect(page).toHaveURL(/51\.98000,-8\.26000/);
});

test("opens a curated place and uses geolocation only after an explicit action", async ({
  page,
}) => {
  await mockPublicSources(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (
          success: (position: GeolocationPosition) => void,
        ) =>
          success({
            coords: {
              latitude: 52.6541,
              longitude: -7.2448,
              accuracy: 50,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
              toJSON: () => ({}),
            },
            timestamp: Date.now(),
            toJSON: () => ({}),
          }),
      },
    });
  });

  await page.goto("/");
  await expect(
    page.getByRole("complementary", { name: "Explore the atlas" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "1839–1900 Kilkenny", exact: true })
    .click();
  await expect(page.getByRole("combobox", { name: "Search place" })).toHaveValue(
    "Kilkenny",
  );

  await page.getByRole("button", { name: "Open atlas" }).click();
  await page
    .getByRole("button", {
      name: "Explore near me Your location stays in this browser",
      exact: true,
    })
    .click();
  await expect(page.getByRole("combobox", { name: "Search place" })).toHaveValue(
    "Near you",
  );
  await expect(page).toHaveURL(/52\.65410,-7\.24480/);
});

test("deep-links every story step and restores it through browser history", async ({
  page,
}) => {
  await mockPublicSources(page);
  await page.goto("/?story=dublin-redrawn&step=1");

  await expect(
    page.getByRole("heading", { name: "A city fixed on paper" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Overlay", exact: true })).toHaveClass(
    /active/,
  );
  await page.getByRole("button", { name: "Next stop →" }).click();
  await expect(
    page.getByRole("heading", { name: "The revised city" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/story=dublin-redrawn&step=2/);
  await expect(page.getByRole("button", { name: "Swipe", exact: true })).toHaveClass(
    /active/,
  );

  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "A city fixed on paper" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/story=dublin-redrawn&step=1/);
});

test("keeps one map runtime and does not refetch evidence across modes", async ({
  page,
}) => {
  const requestCount = await mockPublicSources(page);
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto(
    "/#53.50000,-8.00000,10,6inch-1st,osm,0.70,overlay,normal",
  );
  await expect(page.getByTestId("map-runtime")).toBeVisible();
  await expect(page.getByText("Historical map ready.")).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Evidence 3/ })).toBeVisible();
  await page.getByRole("button", { name: /Evidence 3/ }).click();
  await expect(
    page.getByRole("checkbox", { name: /Sites and Monuments Record 1 in view/ }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Close evidence layers" }).click();
  // Let React's development-only strict-effect replay settle before measuring
  // mode-induced network activity.
  await page.waitForTimeout(1200);
  const settledRequests = requestCount();

  for (const mode of ["Swipe", "Side", "Lens", "Overlay"]) {
    const modeButton = page.getByRole("button", { name: mode, exact: true });
    if (!(await modeButton.isVisible())) {
      await page.locator(".compare-more summary").click();
    }
    await modeButton.click();
    await expect(page.getByTestId("map-runtime")).toHaveCount(1);
    await page.waitForTimeout(400);
    expect(requestCount(), `${mode} must not refetch evidence`).toBe(
      settledRequests,
    );
  }

  expect(consoleErrors).toEqual([]);
});

test("preloads, advances, and interrupts the time-travel sequence", async ({
  page,
}) => {
  await mockPublicSources(page);
  await page.goto(
    "/#53.50000,-8.00000,10,6inch-1st,osm,0.70,overlay,normal",
  );
  await expect(page.getByText("Historical map ready.")).toHaveCount(1);

  const console = page.locator(".timeline-console");
  await page.getByRole("combobox", { name: "Time travel speed" }).selectOption(
    "fast",
  );
  await page.getByRole("button", { name: "Play time travel" }).click();

  await expect(console).toHaveAttribute("data-playback-state", "playing");
  await expect(console).toHaveAttribute(
    "data-preload-status",
    /available|partial/,
  );
  await expect(
    page.getByRole("button", { name: "1859–1917", exact: true }),
  ).toHaveClass("active", { timeout: 4_000 });

  await page.getByRole("button", { name: "Pause time travel" }).click();
  await expect(console).toHaveAttribute("data-playback-state", "paused");
  await expect(console).toHaveAttribute("data-preload-status", "idle");

  const swipe = page.getByRole("button", { name: "Swipe", exact: true });
  if (!(await swipe.isVisible())) {
    await page.locator(".compare-more summary").click();
  }
  await swipe.click();
  await expect(page.getByRole("button", { name: "Play time travel" })).toBeDisabled();
  await expect(page.locator(".time-lapse-edition small")).toHaveText(
    "Switch to Overlay mode to play",
  );
});

test("skips editions outside the current scale without leaving a spinner", async ({
  page,
}) => {
  await mockPublicSources(page);
  await page.goto(
    "/#53.50000,-8.00000,17,6inch-1st,osm,0.70,overlay,normal",
  );
  await page.getByRole("button", { name: "Play time travel" }).click();
  await expect(page.locator(".timeline-console")).toHaveAttribute(
    "data-playback-state",
    "complete",
  );
  await expect(page.locator(".time-lapse-edition small")).toHaveText(
    /Sequence complete.*unavailable at this scale or location/,
  );
});

test("keeps time-travel controls legible with reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockPublicSources(page);
  await page.goto(
    "/#53.50000,-8.00000,10,6inch-1st,osm,0.70,overlay,normal",
  );

  await expect(page.locator(".time-lapse-edition small")).toHaveText(
    "Reduced motion · instant transitions",
  );
  const playerBox = await page.locator(".time-lapse-player").boundingBox();
  const timelineBox = await page.locator(".timeline-rail").boundingBox();
  expect(playerBox).not.toBeNull();
  expect(timelineBox).not.toBeNull();
  expect(playerBox!.x).toBeGreaterThanOrEqual(0);
  expect(playerBox!.x + playerBox!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  expect(timelineBox!.y + timelineBox!.height).toBeLessThanOrEqual(
    page.viewportSize()!.height,
  );
});

test("operates the complete desktop map control surface", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "Desktop exposes every control without the compact More menu",
  );
  await mockPublicSources(page);
  await page.goto(
    "/#53.33027,-8.22138,14,ireland-1inch-1st,osm,0.70,overlay,normal",
  );

  for (const era of [
    "1829–1842",
    "1859–1917",
    "1888–1913",
    "1898–1902",
    "c. 1940",
    "1940–42",
  ]) {
    const button = page.getByRole("button", { name: era, exact: true });
    await button.click();
    await expect(button).toHaveClass("active");
  }

  for (const basemap of ["OSM", "Light", "Dark", "Sat"]) {
    const button = page.getByRole("button", { name: basemap, exact: true });
    await button.click();
    await expect(button).toHaveClass("active");
  }

  const overlay = page
    .locator(".compare-desktop")
    .getByRole("button", { name: "Overlay", exact: true });
  await overlay.click();
  const blend = page.locator(".toolbar-group.blend select");
  for (const option of [
    "normal",
    "multiply",
    "screen",
    "overlay",
    "soft-light",
  ]) {
    await blend.selectOption(option);
    await expect(blend).toHaveValue(option);
  }
  const opacity = page.getByRole("slider", {
    name: "Historical map opacity",
  });
  await opacity.fill("0.42");
  await expect(opacity).toHaveValue("0.42");
  await expect(page.locator(".opacity-control output")).toHaveText("42%");

  const swipe = page
    .locator(".compare-desktop")
    .getByRole("button", { name: "Swipe", exact: true });
  await swipe.click();
  const reveal = page.getByRole("slider", {
    name: "Historical map reveal position",
  });
  await reveal.fill("64");
  await expect(reveal).toHaveValue("64");
  await expect(page.getByTestId("swipe-divider")).toHaveAttribute(
    "style",
    /left: 64%/,
  );

  await page
    .locator(".compare-desktop")
    .getByRole("button", { name: "Side", exact: true })
    .click();
  await expect(page.locator(".map-runtime-secondary")).toBeVisible();

  await page
    .locator(".compare-desktop")
    .getByRole("button", { name: "Lens", exact: true })
    .click();
  await expect(page.getByTestId("map-runtime")).toHaveClass(
    /map-runtime-spyglass/,
  );

  await page.getByRole("button", { name: /Evidence 3/ }).click();
  const presetCounts: Record<string, number> = {
    Archaeology: 7,
    "Built heritage": 5,
    Maritime: 5,
    Military: 5,
    "Sacred landscape": 5,
    Transport: 3,
  };
  for (const [preset, count] of Object.entries(presetCounts)) {
    await page.getByRole("button", { name: preset, exact: true }).click();
    await expect(page.locator(".layer-catalogue-trigger em")).toHaveText(
      String(count),
    );
  }
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.locator(".layer-catalogue-trigger em")).toHaveText("0");
});

test("loads optional public evidence only after a preset is enabled", async ({
  page,
}) => {
  const requestCount = await mockPublicSources(page);
  await page.goto(
    "/#53.50000,-8.00000,10,6inch-1st,osm,0.70,overlay,normal",
  );
  await expect(page.getByRole("button", { name: /Evidence 3/ })).toBeVisible();
  const existingMarker = page.locator(".heritage-marker-smr");
  await expect(existingMarker).toHaveCount(1);
  await existingMarker.evaluate((element) => {
    element.setAttribute("data-render-identity", "preserved");
  });
  const initialRequests = requestCount();

  await page.getByRole("button", { name: /Evidence/ }).click();
  const wrecks = page.getByRole("checkbox", {
    name: /Wreck Inventory of Ireland/,
  });
  await wrecks.check();
  await expect(wrecks).toBeChecked();
  await expect(page.getByRole("button", { name: /Evidence 4/ })).toBeVisible();
  await expect(existingMarker).toHaveAttribute(
    "data-render-identity",
    "preserved",
  );

  await page.getByRole("button", { name: "Maritime", exact: true }).click();

  await expect(
    page.getByRole("checkbox", { name: /Wreck Inventory of Ireland 1 in view/ }),
  ).toBeChecked();
  await expect(page.getByRole("checkbox", { name: /Canals/ })).toBeChecked();
  await expect(page.getByRole("button", { name: /Evidence 5/ })).toBeVisible();
  expect(requestCount()).toBeGreaterThan(initialRequests);
});

test("focuses selected evidence and opens the inspector", async ({ page }) => {
  await mockPublicSources(page);
  await page.goto(
    "/#53.50000,-8.00000,10,6inch-1st,osm,0.70,overlay,normal",
  );
  await page.getByRole("button", { name: /Evidence 3/ }).click();
  await expect(
    page.getByRole("checkbox", { name: /Sites and Monuments Record 1 in view/ }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Close evidence layers" }).click();

  await page
    .getByRole("button", { name: /Monuments: Recorded site/ })
    .first()
    .press("Enter");

  await expect(page.getByRole("heading", { name: "Recorded site" })).toBeVisible();
  await expect(page.locator(".selected-evidence-marker")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Open source record" })).toHaveAttribute(
    "href",
    "https://example.com/public-record",
  );

  if ((page.viewportSize()?.width ?? 0) <= 780) {
    const sheet = page.locator(".place-dossier");
    const handle = page.getByRole("slider", { name: "Evidence sheet height" });
    await expect(handle).toHaveAttribute(
      "aria-valuetext",
      "half-height evidence panel",
    );
    await handle.press("ArrowUp");
    await expect(sheet).toHaveClass(/sheet-full/);
    await handle.press("ArrowDown");
    await expect(sheet).toHaveClass(/sheet-half/);

    const handleBox = await handle.boundingBox();
    expect(handleBox).not.toBeNull();
    await page.mouse.move(
      handleBox!.x + handleBox!.width / 2,
      handleBox!.y + handleBox!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      handleBox!.x + handleBox!.width / 2,
      handleBox!.y + handleBox!.height / 2 + 90,
    );
    await page.mouse.up();
    await expect(sheet).toHaveClass(/sheet-collapsed/);
    await handle.press("ArrowUp");
    await expect(sheet).toHaveClass(/sheet-half/);

    const triggerBox = await page.locator(".layer-catalogue-trigger").boundingBox();
    const dossierBox = await page.locator(".place-dossier").boundingBox();

    expect(triggerBox).not.toBeNull();
    expect(dossierBox).not.toBeNull();
    expect(triggerBox!.y + triggerBox!.height).toBeLessThan(dossierBox!.y);
  }
});

test("browses, filters, exports, and map-selects the complete evidence register", async ({
  page,
}) => {
  await mockPublicSources(page, { featuresPerSource: 4 });
  await page.goto(
    "/#53.50000,-8.00000,10,6inch-1st,osm,0.70,overlay,normal",
  );

  await page.getByRole("button", { name: /Evidence 3/ }).click();
  await page.getByRole("button", { name: /Browse complete register/ }).click();

  const register = page.getByRole("dialog", {
    name: "Evidence in this view",
  });
  await expect(register).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Evidence in this view" }),
  ).toBeFocused();
  await expect(register.getByRole("status").first()).toContainText(
    "12of 12 loaded records",
  );
  await expect(register.getByText("View-radius snapshot.")).toBeVisible();

  await register.locator(".evidence-filter-grid select").first().selectOption("smr");
  await expect(register.getByRole("status").first()).toContainText(
    "4of 12 loaded records",
  );
  await register.locator(".evidence-filter-grid input[type=search]").fill("Recorded");
  await expect(register.getByRole("status").first()).toContainText(
    "4of 12 loaded records",
  );
  await register.getByRole("button", { name: "Clear filters" }).click();

  const [geoJsonDownload] = await Promise.all([
    page.waitForEvent("download"),
    register.getByRole("button", { name: "GeoJSON" }).click(),
  ]);
  expect(geoJsonDownload.suggestedFilename()).toMatch(
    /^historic-map-evidence-current-view\.geojson$/,
  );
  const [csvDownload] = await Promise.all([
    page.waitForEvent("download"),
    register.getByRole("button", { name: "CSV" }).click(),
  ]);
  expect(csvDownload.suggestedFilename()).toMatch(
    /^historic-map-evidence-current-view\.csv$/,
  );

  await page.addScriptTag({ content: axe.source });
  const serious = await page.evaluate(async () => {
    const results = await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
    });
    return results.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    );
  });
  expect(serious).toEqual([]);

  await register.locator(".evidence-record button").first().click();
  await expect(register).toBeHidden();
  await expect(page.locator(".selected-evidence-marker")).toHaveCount(1);
  await expect(page.locator(".feature-card h3")).toBeVisible();
});

test("restores compact share state and has no serious accessibility violations", async ({
  page,
}) => {
  await mockPublicSources(page);
  await page.goto(
    "/#53.34380,-6.26750,14,6inch-2nd,light,0.62,swipe,multiply,0.b.h",
  );

  await expect(page.getByRole("button", { name: "Swipe", exact: true })).toHaveClass(
    /active/,
  );
  await page.getByRole("button", { name: /Evidence/ }).click();
  await expect(page.getByRole("checkbox", { name: /Sites and Monuments/ })).toBeChecked();

  await page.addScriptTag({ content: axe.source });
  const results = await page.evaluate(async () => {
    return await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
    });
  });
  const serious = results.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  );
  expect(serious).toEqual([]);
});

test("keeps the welcome atlas and guided story free of serious accessibility violations", async ({
  page,
}) => {
  await mockPublicSources(page);
  await page.goto("/");
  await page.addScriptTag({ content: axe.source });

  const seriousViolations = async () =>
    page.evaluate(async () => {
      const results = await window.axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
      });
      return results.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact ?? ""),
      );
    });

  await expect(page.locator(".dossier-peek")).toBeHidden();
  expect(await seriousViolations()).toEqual([]);
  await page.locator(".featured-story").click();
  await expect(
    page.getByRole("heading", { name: "A city fixed on paper" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Share" })).toHaveCount(1);
  expect(await seriousViolations()).toEqual([]);
});

test("clusters dense points and renders route and area evidence", async ({
  page,
}) => {
  await mockPublicSources(page, { featuresPerSource: 4 });
  await page.goto(
    "/#53.50000,-8.00000,10,6inch-1st,osm,0.70,overlay,normal",
  );

  await expect(page.locator(".heritage-cluster").first()).toBeVisible();
  await page.getByRole("button", { name: /Evidence 3/ }).click();
  await page.getByRole("button", { name: "Transport", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: /Canals 4 in view/ })).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: /Navigable waterways 4 in view/ }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Close evidence layers" }).click();

  await expect(page.locator(".heritage-line")).toHaveCount(8);
  await expect(page.locator(".heritage-polygon")).toHaveCount(4);
});

test("keeps healthy evidence usable when one public source fails", async ({
  page,
}) => {
  await mockPublicSources(page, { failSource: /SMROpenData/ });
  await page.goto(
    "/#53.50000,-8.00000,10,6inch-1st,osm,0.70,overlay,normal",
  );

  await page.getByRole("button", { name: /Evidence 3/ }).click();
  await expect(
    page.getByRole("checkbox", {
      name: /Sites and Monuments Record Source unavailable/,
    }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", {
      name: /National Inventory of Architectural Heritage 1 in view/,
    }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: /Excavations.ie 1 in view/ }),
  ).toBeChecked();
});

test("matches the responsive atlas visual contract", async ({ page }, testInfo) => {
  await mockPublicSources(page);
  await page.goto(
    "/#53.50000,-8.00000,10,6inch-1st,osm,0.70,overlay,normal",
  );
  await expect(page.getByText("Historical map ready.")).toHaveCount(1);

  const contract = await page.evaluate(() => {
    const describe = (
      selector: string,
      heightMode: "exact" | "content" | "even" = "exact",
    ) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        display: style.display,
        rect: [
          Math.round(rect.x),
          Math.round(rect.y),
          Math.round(rect.width),
          heightMode === "content"
            ? "content"
            : heightMode === "even"
              ? Math.round(rect.height / 2) * 2
              : Math.round(rect.height),
        ],
        background: style.backgroundColor,
        radius: style.borderRadius,
      };
    };
    return {
      viewport: [innerWidth, innerHeight],
      map: describe(".map-runtime"),
      // The local macOS serif and CI's Linux fallback have different line
      // metrics. Preserve every structural value while excluding only this
      // content-driven height from the cross-platform contract.
      atlasBar: describe(".top-left-stack", "content"),
      dossier: describe(".place-dossier, .dossier-peek"),
      evidenceTrigger: describe(".layer-catalogue-trigger", "even"),
      timeline: describe(".timeline-rail"),
    };
  });

  expect(`${JSON.stringify(contract, null, 2)}\n`).toMatchSnapshot(
    "atlas-shell.json",
  );
});

declare global {
  interface Window {
    axe: typeof axe;
  }
}
