import { expect, test } from "@playwright/test";

const pages = ["/", "/design", "/spike/tree", "/spike/map"];

for (const path of pages) {
  test(`${path} renders without console errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      // The tree spike asks for /data/tree.json, which is absent in CI; its 404 is expected there.
      if (msg.type() === "error" && !msg.location().url.includes("/data/")) errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("home links are reachable by keyboard", async ({ page }) => {
  await page.goto("/");
  const targets = ["/design", "/spike/tree", "/spike/map"];
  for (const href of targets) {
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toHaveAttribute("href", href);
  }
});
