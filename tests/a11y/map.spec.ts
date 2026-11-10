import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// WCAG 2.2 AA on the map spike, after the map has drawn and with a selection open.
// Without /data (CI) the "not built yet" state is scanned instead.

test.describe.configure({ timeout: 90_000 });

async function hasData(request: APIRequestContext): Promise<boolean> {
  const res = await request.get("/data/geo/languages.geojson");
  return res.ok() && !(res.headers()["content-type"] ?? "").includes("html");
}

async function scan(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(" | ")})`);
}

const ready = (page: Page) => page.locator('[data-testid="map"][data-ready="true"]');

for (const scheme of ["dark", "light"] as const) {
  test(`map spike with a selection is axe clean (${scheme})`, async ({ page, request }) => {
    await page.emulateMedia({ colorScheme: scheme });
    if (!(await hasData(request))) {
      await page.goto("/spike/map");
      await expect(page.getByRole("status").filter({ hasText: "Data not built yet" })).toBeVisible();
      expect(await scan(page)).toEqual([]);
      return;
    }
    await page.goto("/spike/map");
    await expect(ready(page)).toBeVisible({ timeout: 60_000 });
    expect(await scan(page)).toEqual([]);

    await page.getByRole("combobox", { name: "Find a language" }).fill("hindi");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("selection").getByRole("table")).toBeVisible();
    await page.getByRole("slider", { name: "Year" }).focus();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByText("No data for this period")).toBeVisible();
    expect(await scan(page)).toEqual([]);
  });
}

test("map spike is axe clean in Persian (right to left) and on a phone", async ({ page, request }) => {
  test.skip(!(await hasData(request)), "data is not built");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/spike/map?lang=fa");
  await expect(ready(page)).toBeVisible({ timeout: 60_000 });
  await page.getByLabel("Pick a country").selectOption("c:FR");
  await expect(page.getByTestId("selection").getByRole("table")).toBeVisible();
  expect(await scan(page)).toEqual([]);
});
