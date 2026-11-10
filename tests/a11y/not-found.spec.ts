import { expect, test } from "@playwright/test";

test("unknown paths show a titled not-found page with a way back", async ({ page }) => {
  await page.goto("/no-such-page");
  await expect(page).toHaveTitle(/Tree of Tongues/);
  await expect(page.locator("h1")).toHaveText("Page not found");
  await expect(page.getByRole("link", { name: "Back to the start" })).toHaveAttribute("href", "/");
});
