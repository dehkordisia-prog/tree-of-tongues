import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// The app shell (docs/specs/app-shell.md, acceptance 27): axe on the world view, a language and a
// family, in English and Persian, at desktop and phone sizes, with the palette open and at each
// sheet stop. Entity routes without data show their error state, which is scanned as well.

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.locator(".tt-shell[data-hydrated]").waitFor();
  // Let the Inspector settle (loader data, then the lens chunk).
  await page.locator("h1").waitFor();
  await page.waitForTimeout(300);
}

async function scan(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.help} ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
  ).toEqual([]);
}

test.describe.configure({ timeout: 60_000 });

const routes = ["/", "/language/nucl1301", "/family/turk1311"];

for (const lang of ["", "lang=fa"]) {
  for (const route of routes) {
    const path = lang ? `${route}?${lang}` : route;
    test(`${path} is axe clean at 1440`, async ({ page }) => {
      await open(page, path);
      await scan(page);
    });
  }
}

test("the language Speakers tab and an open citation are axe clean", async ({ page }) => {
  await open(page, "/language/stan1290?tab=speakers");
  const chip = page.locator('[role="tabpanel"]:not([hidden]) [data-citation]').first();
  if (await chip.count()) {
    await chip.click();
    await page.locator(".tt-popover").waitFor();
  }
  await scan(page);
});

test("the search palette is axe clean with results", async ({ page }) => {
  await open(page, "/");
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox").fill("tur");
  await page.waitForTimeout(400);
  await scan(page);
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  for (const lang of ["", "?lang=fa"]) {
    test(`the sheet at every stop is axe clean${lang ? " in Persian" : ""}`, async ({ page }) => {
      await open(page, `/language/nucl1301${lang}`);
      await scan(page);
      const handle = page.getByTestId("sheet-handle");
      await handle.click();
      await expect(page.locator(".tt-sheet")).toHaveAttribute("data-stop", "half");
      await scan(page);
      await handle.click();
      await expect(page.locator(".tt-sheet")).toHaveAttribute("data-stop", "full");
      await scan(page);
    });
  }
});
