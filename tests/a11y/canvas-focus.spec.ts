import { expect, test, type Page } from "@playwright/test";

// WCAG 2.4.7: a keyboard user must see which canvas has focus. deck.gl and MapLibre reset outlines,
// which axe does not catch, so this checks the computed style directly.
// Skipped when pipeline data is not served (it is gitignored and absent in CI).

async function dataAvailable(page: Page, file: string) {
  const res = await page.request.get(file);
  return res.ok() && (res.headers()["content-type"] ?? "").includes("json");
}

async function outlineOf(page: Page, selector: string) {
  const canvas = page.locator(selector).first();
  await canvas.waitFor({ state: "attached", timeout: 30_000 });
  await page.keyboard.press("Tab"); // last interaction was the keyboard, so focus() matches :focus-visible
  await canvas.focus();
  return canvas.evaluate((el) => {
    const s = getComputedStyle(el);
    return { matches: el.matches(":focus-visible"), style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
  });
}

for (const renderer of ["pixi", "deck"] as const) {
  test(`tree canvas shows a focus ring, ${renderer}`, async ({ page }) => {
    test.skip(!(await dataAvailable(page, "/data/tree.json")), "data/build/tree.json is not available");
    await page.goto(`/spike/tree?renderer=${renderer}`);
    await expect(page.getByTestId("tree-stats")).toContainText(/circles/, { timeout: 30_000 });
    const o = await outlineOf(page, "canvas[role=application]");
    expect(o.matches).toBe(true);
    expect(o.style).not.toBe("none");
    expect(o.width).toBeGreaterThanOrEqual(2);
  });
}

test("map canvas shows a focus ring", async ({ page }) => {
  test.skip(!(await dataAvailable(page, "/data/tree.json")), "pipeline data is not available");
  await page.goto("/spike/map");
  const o = await outlineOf(page, ".maplibregl-canvas");
  expect(o.matches).toBe(true);
  expect(o.style).not.toBe("none");
  expect(o.width).toBeGreaterThanOrEqual(2);
});
