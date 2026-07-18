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
  await page.getByRole("textbox", { name: "Search place" }).fill("Ballinasloe");
  await page.getByRole("button", { name: "Search for place" }).click();
  await expect(
    page.getByRole("button", { name: /Ballinasloe, County Galway/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Ballinasloe, County Galway/ })
    .click();

  await expect(page.getByRole("textbox", { name: "Search place" })).toHaveValue(
    "Ballinasloe, County Galway",
  );
  await expect(page).toHaveURL(/53\.33027,-8\.22138/);
  await expect(page).toHaveURL(/Ballinasloe%2C%20County%20Galway/);

  const sharedUrl = page.url();
  await page.reload();
  await expect(page).toHaveURL(sharedUrl);
  await expect(page.getByRole("textbox", { name: "Search place" })).toHaveValue(
    "Ballinasloe, County Galway",
  );
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
    "1829-1842",
    "1888-1913",
    "Early OS",
    "Contours",
    "1941-43",
    "1940",
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
    await expect(handle).toHaveAttribute("aria-valuetext", "half");
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
    const describe = (selector: string, normalizeTextHeight = false) => {
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
          normalizeTextHeight
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
      atlasBar: describe(".top-left-stack"),
      dossier: describe(".place-dossier"),
      evidenceTrigger: describe(".layer-catalogue-trigger", true),
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
