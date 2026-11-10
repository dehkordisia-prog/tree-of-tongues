import { expect, test, type Page } from "@playwright/test";

// The speaker glyph in the tree lens (docs/specs/app-shell.md 5.3): the legend and the screen-reader
// text. Needs data/build (tree.json and the Turkish bundle); skipped when /data is not served (CI).

async function hasData(page: Page): Promise<boolean> {
  for (const url of ["/data/tree.json", "/data/bundles/nucl1301.json"]) {
    const res = await page.request.get(url);
    if (!res.ok() || !(res.headers()["content-type"] ?? "").includes("json")) return false;
  }
  return true;
}

async function openTree(page: Page, path: string) {
  await page.goto(path);
  await page.locator(".tt-shell[data-hydrated]").waitFor();
  await expect(page.locator('[data-testid="tree-lens"][data-ready="true"]')).toBeVisible({ timeout: 45_000 });
}

test.describe.configure({ timeout: 90_000 });

test.describe("speaker glyph", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!(await hasData(page)), "data/build is not available");
  });

  test("the legend toggles, names every part in text and states the sizing rule", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await openTree(page, "/language/nucl1301");
    const toggle = page.getByTestId("tree-legend-toggle");
    const legend = page.getByTestId("tree-legend");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(legend).toHaveCount(0);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(legend).toBeVisible();
    for (const text of [
      /Inner disc: first-language speakers/,
      /Ring: total speakers/,
      /Translucent band: sources disagree/,
      /Dashed ring: speakers, kind not stated/,
      /Dotted ring: no speaker figure.*size means nothing/,
      /number of entries below, not speakers/,
      /area is proportional to the figure/,
      /never average/,
    ]) {
      await expect(legend).toContainText(text);
    }
    expect(await legend.textContent()).not.toContain("—");
    await toggle.click();
    await expect(legend).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("the live region reads the speaker description of a language, built from data", async ({ page }) => {
    await openTree(page, "/language/nucl1301");
    const canvas = page.getByRole("application", { name: /Language family tree/ });
    await canvas.focus();
    // Escape zooms out to the parent with the cursor on Turkish; Enter focuses it and announces it.
    await page.keyboard.press("Escape");
    await page.keyboard.press("Enter");
    const live = page.getByTestId("live-region");
    await expect(live).toContainText("Focused Turkish, language", { timeout: 15_000 });
    await expect(live).toContainText("First-language speakers: 71.4 to 82.2 million, 5 sources, 2006 to 2021.");
  });

  test("a family is announced without a speaker total", async ({ page }) => {
    await openTree(page, "/family/turk1311");
    const canvas = page.getByRole("application", { name: /Language family tree/ });
    await canvas.focus();
    await page.keyboard.press("Home");
    const live = page.getByTestId("live-region");
    await expect(live).toContainText("Focused World");
    await expect(live).not.toContainText("speakers");
  });
});
