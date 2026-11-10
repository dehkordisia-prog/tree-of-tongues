import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// The generic scan in axe.spec.ts can run before the data loads. This one waits for the drawn tree,
// opens the list of what is inside, and scans both renderers in both themes.
// Skipped when /data/tree.json is not served (it is gitignored and absent in CI).

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

for (const renderer of ["pixi", "deck"] as const) {
  for (const scheme of ["dark", "light"] as const) {
    test(`/spike/tree with data is axe clean, ${renderer}, ${scheme}`, async ({ page }) => {
      const res = await page.request.get("/data/tree.json");
      test.skip(!res.ok() || !(res.headers()["content-type"] ?? "").includes("json"), "data/build/tree.json is not available");
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(`/spike/tree?renderer=${renderer}`);
      await expect(page.getByTestId("tree-stats")).toContainText(/circles/, { timeout: 30_000 });
      await page.getByText(/^Inside World/).click();
      await page.locator("canvas").focus();
      await page.keyboard.press("ArrowRight");
      const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.help} ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    });
  }
}
