import { expect, test } from "@playwright/test";

const pages = ["/", "/design", "/spike/tree", "/spike/map"];

for (const path of pages) {
  test(`${path} renders without console errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      // Pages ask for /data/*, which is absent in CI; those 404s are expected there.
      if (msg.type() === "error" && !msg.location().url.includes("/data/") && !msg.text().includes("404")) errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("the workbenches stay reachable from the shell footer", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Workbenches" });
  await expect(nav.getByRole("link")).toHaveCount(3);
  const hrefs = await nav.getByRole("link").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  expect(hrefs).toEqual(["/design", "/spike/tree", "/spike/map"]);
});
