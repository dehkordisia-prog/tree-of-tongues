import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// WCAG 2.2 AA (docs/SPEC.md, section 8).
const pages = ["/", "/design", "/spike/tree", "/spike/map"];

for (const path of pages) {
  test(`${path} has no WCAG 2.2 AA violations`, async ({ page }) => {
    await page.goto(path);
    await page.locator("h1").waitFor();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
}
