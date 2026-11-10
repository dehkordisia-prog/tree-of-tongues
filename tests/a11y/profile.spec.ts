import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// The profile area (draft banner, prose, citation popovers, Unverified chips, sources list) and the
// Why linguists disagree slot. Runs with or without data/build: both come from content/.

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.locator(".tt-shell[data-hydrated]").waitFor();
  await page.locator("article[data-entity]").waitFor();
  await page.waitForTimeout(300);
}

/** Scan the Inspector only: the canvas has its own scans (shell.spec.ts, tree.spec.ts). */
async function scan(page: Page, include = '[data-testid="inspector"]') {
  const results = await new AxeBuilder({ page }).include(include).withTags(TAGS).analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.help} ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
  ).toEqual([]);
}

test.describe.configure({ timeout: 60_000 });

for (const path of [
  "/language/nucl1301",
  "/language/west2369",
  "/language/west2369?lang=fa",
  "/language/stan1293",
]) {
  test(`${path}: the profile Overview is axe clean`, async ({ page }) => {
    await open(page, path);
    await expect(page.getByTestId("draft-banner")).toBeVisible();
    await scan(page);
  });
}

test("an open profile citation popover is axe clean", async ({ page }) => {
  await open(page, "/language/nucl1301");
  await page.getByTestId("profile-hook").locator('[data-citation="profile"]').first().click();
  await page.locator(".tt-popover").waitFor();
  await scan(page, ".tt-popover");
});

test("the profile tabs and the Sources list are axe clean", async ({ page }) => {
  await open(page, "/language/west2369");
  for (const name of ["Writing", "Sounds", "Words", "Family", "Sources"]) {
    await page.getByRole("tab", { name }).click();
    await scan(page);
  }
});

test("the grouped view of Why linguists disagree is axe clean", async ({ page }) => {
  await open(page, "/language/west2369?lump=persian");
  await expect(page.getByTestId("lump-slot").getByRole("radio", { name: "Grouped" })).toBeChecked();
  await scan(page, '[data-testid="lump-slot"]');
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test("the profile in the sheet at full is axe clean", async ({ page }) => {
    await open(page, "/language/nucl1301");
    const handle = page.getByTestId("sheet-handle");
    await handle.click();
    await handle.click();
    await expect(page.locator(".tt-sheet")).toHaveAttribute("data-stop", "full");
    await expect(page.getByTestId("draft-banner")).toBeVisible();
    await scan(page);
  });
});
