import { expect, test, type Page } from "@playwright/test";

// Prerendered entity pages must hydrate without a mismatch (React #418 in production builds,
// a readable console error in dev). The first case found: country names from Intl.DisplayNames
// differed between the Node that prerendered and the browser (Hong Kong, Macao). Pages skip when
// data/build is not served (CI has no data).

async function hasData(page: Page): Promise<boolean> {
  const res = await page.request.get("/data/bundles/stan1293.json");
  return res.ok() && (res.headers()["content-type"] ?? "").includes("json");
}

const PAGES = [
  "/language/stan1293", // English: spoken in HK and MO
  "/language/stan1293?lang=fa",
  "/language/yuec1235", // Cantonese: HK and MO
  "/language/port1283", // Portuguese: MO
  "/language/nucl1301",
  "/language/west2369",
  "/family/indo1319",
];

test.describe.configure({ timeout: 60_000 });

for (const path of PAGES) {
  test(`${path} hydrates with no console errors`, async ({ page }) => {
    test.skip(!(await hasData(page)), "data/build is not served");
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.goto(path);
    await page.locator(".tt-shell[data-hydrated]").waitFor();
    await expect(page.getByTestId("inspector")).toBeVisible();
    // Recoverable hydration errors are reported after the commit; give them a moment.
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });
}
