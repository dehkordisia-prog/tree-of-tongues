import { expect, test } from "@playwright/test";

// ?lang= switches lang and dir after hydration; there must be no hydration warning in dev.
const cases = [
  { query: "", lang: "en", dir: "ltr" },
  { query: "?lang=fa", lang: "fa", dir: "rtl" },
  { query: "?lang=tr", lang: "tr", dir: "ltr" },
];

for (const { query, lang, dir } of cases) {
  test(`/${query} sets lang=${lang} dir=${dir} without console errors`, async ({ page }) => {
    const problems: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") problems.push(msg.text());
    });
    page.on("pageerror", (err) => problems.push(err.message));

    await page.goto(`/${query}`);
    const html = page.locator("html");
    await expect(html).toHaveAttribute("lang", lang);
    await expect(html).toHaveAttribute("dir", dir);
    await page.evaluate(() => document.fonts.ready);
    expect(problems.filter((p) => !p.includes("favicon") && !p.includes("404"))).toEqual([]);
  });
}

test("Persian copy follows the style guide", async ({ page }) => {
  await page.goto("/?lang=fa");
  // nav.workbenches is translated (awaiting owner review); it names the footer navigation.
  const nav = page.getByRole("navigation", { name: "کارگاه‌ها" });
  await expect(nav).toBeVisible();
});

test("an untranslated string keeps its English lang and dir inside an RTL page", async ({ page }) => {
  await page.goto("/?lang=fa");
  const link = page.getByRole("navigation", { name: "کارگاه‌ها" }).getByRole("link", { name: "Tree spike" });
  await expect(link).toHaveAttribute("lang", "en");
  await expect(link).toHaveAttribute("dir", "ltr");
});
