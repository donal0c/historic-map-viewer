import { expect, test, type Page } from "@playwright/test";
import axe from "axe-core";

const TRANSPARENT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlIoAAAAASUVORK5CYII=",
  "base64",
);

async function mockPublicSources(page: Page) {
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
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [-8, 53.5] },
            properties: {
              OBJECTID: heritageRequests,
              NAME: "Test evidence",
              MONUMENT_CLASS: "Recorded site",
              Wreck_Name: "Test wreck",
              SMRS: `TEST-${heritageRequests}`,
            },
          },
        ],
      }),
    });
  });

  return () => heritageRequests;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
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
  await page.waitForTimeout(250);
  const settledRequests = requestCount();

  for (const mode of ["Swipe", "Side", "Lens", "Overlay"]) {
    await page.getByRole("button", { name: mode, exact: true }).click();
    await expect(page.getByTestId("map-runtime")).toHaveCount(1);
  }

  expect(requestCount()).toBe(settledRequests);
  expect(consoleErrors).toEqual([]);
});

test("loads optional public evidence only after a preset is enabled", async ({
  page,
}) => {
  const requestCount = await mockPublicSources(page);
  await page.goto(
    "/#53.50000,-8.00000,10,6inch-1st,osm,0.70,overlay,normal",
  );
  await expect(page.getByRole("button", { name: /Evidence 3/ })).toBeVisible();
  const initialRequests = requestCount();

  await page.getByRole("button", { name: /Evidence/ }).click();
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

declare global {
  interface Window {
    axe: typeof axe;
  }
}
