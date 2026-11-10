import { expect, test, type Page } from "@playwright/test";

// The app shell (docs/specs/app-shell.md, section 11). Tests that need pipeline output skip when
// /data is not served (CI); the rest pass with or without data.

async function hasData(page: Page): Promise<boolean> {
  const res = await page.request.get("/data/bundles/nucl1301.json");
  return res.ok() && (res.headers()["content-type"] ?? "").includes("json");
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.location().url.includes("/data/") && !m.text().includes("404"))
      errors.push(m.text());
  });
  return errors;
}

/** Navigate and wait until the shell has hydrated (handlers and the URL store are live). */
async function open(page: Page, path: string) {
  await page.goto(path);
  await page.locator(".tt-shell[data-hydrated]").waitFor();
}

const inspector = (page: Page) => page.getByTestId("inspector");
const heading = (page: Page) => page.getByRole("heading", { level: 1 });
const visiblePanel = (page: Page) => page.locator('[role="tabpanel"]:not([hidden])');

test.describe.configure({ timeout: 60_000 });

test("the world view has one h1, landmarks, skip links and three Go deeper exits", async ({ page }) => {
  const errors = watchErrors(page);
  await open(page, "/");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(heading(page)).toHaveText("Explore the world's languages");
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("complementary")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Path" })).toBeVisible();
  const cards = page.getByTestId("go-deeper").getByRole("link");
  expect(await cards.count()).toBeGreaterThanOrEqual(3);
  const hrefs = new Set(await cards.evaluateAll((as) => as.map((a) => a.getAttribute("href"))));
  expect(hrefs.size).toBeGreaterThanOrEqual(3);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to details" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(heading(page)).toBeFocused();
  await expect(page.getByTestId("time-strip")).toContainText("Time travel comes in a later update.");
  await expect(page.getByTestId("time-strip").locator("input, button, a, [tabindex]")).toHaveCount(0);
  expect(errors, errors.join(" | ")).toEqual([]);
});

test("invalid params are dropped with replace, no extra history entry", async ({ page }) => {
  await open(page, "/?lens=time&tz=abc&year=0&lump=xyz&lang=xx");
  await expect(page).toHaveURL(/\/$/);
  // about:blank plus this page: the rewrite replaced the entry instead of adding one.
  expect(await page.evaluate(() => history.length)).toBe(2);
  await open(page, "/?lens=map&year=1500");
  await expect(page).toHaveURL(/\/\?lens=map$/);
});

test("Ctrl+K opens search from the canvas region, the Inspector and a text field; the button too", async ({
  page,
}) => {
  await open(page, "/");
  const dialog = page.getByRole("dialog", { name: "Search the atlas" });
  await page
    .getByRole("button", { name: /Search/ })
    .first()
    .click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await heading(page).focus();
  await page.keyboard.press("Control+k");
  await expect(dialog).toBeVisible();
  const input = dialog.getByRole("combobox");
  await expect(input).toBeFocused();
  await input.fill("tu");
  await page.keyboard.press("Escape"); // clears
  await expect(input).toHaveValue("");
  await page.keyboard.press("Escape"); // closes
  await expect(dialog).toBeHidden();
  await expect(heading(page)).toBeFocused(); // focus returns to the opener
});

test("single-key shortcuts do nothing outside the canvas", async ({ page }) => {
  await open(page, "/");
  await heading(page).focus();
  await page.keyboard.press("2");
  await expect(page).toHaveURL(/\/$/);
  await page
    .getByRole("button", { name: /Search/ })
    .first()
    .click();
  await page.getByRole("combobox").fill("2");
  await expect(page).toHaveURL(/\/$/);
});

test("Persian mirrors the shell (Inspector at the inline end, so on the left), not the canvas", async ({
  page,
}) => {
  await open(page, "/?lang=fa");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  const aside = await inspector(page).boundingBox();
  const main = await page.getByRole("main").boundingBox();
  expect(aside!.x).toBeLessThan(main!.x);
  await open(page, "/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  const aside2 = await inspector(page).boundingBox();
  const main2 = await page.getByRole("main").boundingBox();
  expect(aside2!.x).toBeGreaterThan(main2!.x);
});

test("a language page without data still has a heading, an error and Go deeper exits", async ({ page }) => {
  test.skip(await hasData(page), "data is built");
  await open(page, "/language/nucl1301");
  await expect(heading(page)).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Could not load the details.");
  expect(await page.getByTestId("go-deeper").getByRole("link").count()).toBeGreaterThanOrEqual(3);
});

test.describe("with data", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!(await hasData(page)), "data/build is not served");
  });

  test("a language shows At a glance with citations, and every tab has content", async ({ page }) => {
    const errors = watchErrors(page);
    await open(page, "/language/nucl1301");
    await expect(page).toHaveTitle("Turkish, language · Tree of Tongues");
    await expect(heading(page)).toHaveText("Turkish");
    const glance = visiblePanel(page).getByTestId("at-a-glance");
    await expect(glance).toContainText("First language (L1)");
    const chip = glance.locator("[data-citation]").first();
    await expect(chip).toBeVisible();
    await chip.click();
    const pop = page.locator(".tt-popover");
    await expect(pop).toContainText("Locator");
    await expect(pop).toContainText("Retrieved");
    await expect(pop).toContainText("License");
    await expect(pop).toContainText("Confidence");
    await page.keyboard.press("Escape");
    await expect(pop).toBeHidden();
    await chip.focus();
    await page.keyboard.press("Enter");
    await expect(pop).toBeVisible();
    await page.keyboard.press("Escape");

    const tabs = page.getByRole("tablist").getByRole("tab");
    await expect(tabs).toHaveCount(8);
    const empties: Record<string, string> = {
      Writing: "No script data yet.",
      Sounds: "No recording yet.",
      Words: "No word list yet.",
    };
    for (const name of ["Overview", "Speakers", "Where", "Writing", "Sounds", "Words", "Family", "Sources"]) {
      await page.getByRole("tab", { name }).click();
      await expect(page.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true");
      const panel = visiblePanel(page);
      await expect(panel).not.toBeEmpty();
      if (empties[name]) await expect(panel).toContainText(empties[name]);
      expect(await panel.getByTestId("go-deeper").getByRole("link").count()).toBeGreaterThanOrEqual(3);
    }
    // The tab is in the URL, written with replace.
    await expect(page).toHaveURL(/tab=sources/);
    await page.getByRole("tab", { name: "Sources" }).focus();
    await page.keyboard.press("Home");
    await expect(page.getByRole("tab", { name: "Overview" })).toBeFocused();
    await expect(page).not.toHaveURL(/tab=/);
    expect(errors).toEqual([]);
  });

  test("the Speakers tab groups kinds, lists each source and year, and folds nothing into a mean", async ({
    page,
  }) => {
    await open(page, "/language/stan1290?tab=speakers");
    const panel = visiblePanel(page);
    await expect(panel.locator('table[data-kind="l1"] caption')).toContainText("First language (L1)");
    await expect(panel.locator('table[data-kind="unstated"] caption')).toContainText("Kind not stated");
    const rows = panel.locator('table[data-kind="l1"] tbody tr');
    expect(await rows.count()).toBeGreaterThan(1);
    await expect(rows.first()).toContainText("Wikidata");
  });

  test("a family shows its path, members and Glottolog counts, never a speaker total", async ({ page }) => {
    await open(page, "/family/turk1311");
    await expect(heading(page)).toHaveText("Turkic");
    const glance = visiblePanel(page).getByTestId("at-a-glance");
    await expect(glance).toContainText(/\d+ languages/);
    await expect(glance).toContainText("We do not add up speaker figures across languages.");
    await page.getByRole("tab", { name: "Members" }).click();
    await expect(visiblePanel(page).getByTestId("members").getByRole("link").first()).toBeVisible();
  });

  test("level mismatch redirects with replace; an unknown code shows not found", async ({ page }) => {
    await open(page, "/language/indo1319?tab=members");
    await expect(page).toHaveURL(/\/family\/indo1319/);
    await expect(heading(page)).toHaveText("Indo-European");
    await open(page, "/language/zzzz9999");
    await expect(page.getByRole("alert")).toContainText("No language or family has the code zzzz9999.");
    await expect(page.getByRole("button", { name: "Search the atlas" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Go to the world view" })).toBeVisible();
  });

  test("search: alias, ISO code, Glottocode and endonyms; Enter opens and focuses the heading", async ({
    page,
  }) => {
    await open(page, "/");
    await page.keyboard.press("Control+k");
    const input = page.getByRole("combobox");
    const listbox = page.getByRole("listbox");
    await input.fill("Farsi"); // alias query
    await expect(listbox.locator('[data-result="west2369"]')).toContainText("Alias:"); // alias label
    await input.fill("tur");
    await expect(listbox.getByRole("option").first()).toContainText("ISO 639-3: tur");
    await input.fill("turkce");
    await expect(listbox.getByRole("option").first()).toContainText("Turkish");
    await input.fill("فارسی");
    await expect(listbox.locator('[data-result="west2369"]')).toBeVisible();
    await input.fill("west2369");
    await expect(listbox.getByRole("option").first()).toContainText("Iranian Persian");
    await expect(page.getByTestId("palette-count")).toContainText(/result/);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/language\/west2369$/);
    await expect(heading(page)).toHaveText("Iranian Persian");
    await expect(heading(page)).toBeFocused();
  });

  test("an out-of-scope languoid opens through search in three interactions", async ({ page }) => {
    await open(page, "/");
    await page.keyboard.press("Control+k");
    await page.getByRole("combobox").fill("acad1238");
    await expect(page.getByRole("option").first()).toContainText("Glottocode: acad1238");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/language\/acad1238$/);
    await expect(heading(page)).toHaveText("Acadian");
  });

  test("history: select, family, map; Back three times returns each view", async ({ page }) => {
    await open(page, "/");
    await open(page, "/language/nucl1301");
    await expect(heading(page)).toHaveText("Turkish");
    await page.getByRole("navigation", { name: "Path" }).getByRole("link", { name: "Turkic" }).click();
    await expect(page).toHaveURL(/\/family\/turk1311$/);
    await expect(heading(page)).toHaveText("Turkic");
    await page.locator("label").filter({ hasText: "Map" }).click();
    await expect(page).toHaveURL(/\/family\/turk1311\?lens=map$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/family\/turk1311$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/language\/nucl1301$/);
    await expect(heading(page)).toHaveText("Turkish");
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(heading(page)).toHaveText("Explore the world's languages");
  });

  test("switching to Persian survives Back", async ({ page }) => {
    await open(page, "/language/nucl1301");
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("radio", { name: "فارسی" }).click();
    await expect(page).toHaveURL(/lang=fa/);
    await page.keyboard.press("Escape");
    await open(page, "/language/stan1290?lang=fa");
    await page.getByTestId("go-deeper").first().getByRole("link").first().click();
    await expect(page).not.toHaveURL(/stan1290/);
    await expect(page).toHaveURL(/lang=fa/);
    await page.goBack();
    await expect(page).toHaveURL(/\/language\/stan1290\?lang=fa$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });

  test("a blocked bundle shows the error, and Try again works after unblocking", async ({ page }) => {
    await open(page, "/");
    let block = true;
    await page.route("**/data/bundles/stan1290.json", (route) =>
      block ? route.fulfill({ status: 500, body: "x" }) : route.continue(),
    );
    await page.keyboard.press("Control+k");
    await page.getByRole("combobox").fill("stan1290");
    await expect(page.getByRole("option").first()).toContainText("Glottocode: stan1290");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("alert")).toContainText("Could not load the details.");
    expect(await page.getByTestId("go-deeper").getByRole("link").count()).toBeGreaterThanOrEqual(3);
    block = false;
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(heading(page)).toHaveText("French");
  });

  test("the tree lens: the canvas selects, and a settled pan writes tz or tc with replace", async ({
    page,
  }) => {
    await open(page, "/family/turk1311");
    const canvas = page.getByRole("application", { name: /Language family tree/ });
    await expect(page.locator('[data-testid="tree-lens"][data-ready="true"]')).toBeVisible({
      timeout: 45_000,
    });
    const before = await page.evaluate(() => history.length);
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 40, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(600);
    await expect(page).toHaveURL(/tc=|tz=/);
    expect(await page.evaluate(() => history.length)).toBe(before);
    await canvas.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect(page).not.toHaveURL(/\/family\/turk1311(\?|$)/);
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/family\/turk1311/);
    await page.keyboard.press("2");
    await expect(page).toHaveURL(/lens=map/);
  });
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("the sheet opens at peek, cycles with the handle, and Esc from full returns to half", async ({
    page,
  }) => {
    await open(page, "/");
    const sheet = page.locator(".tt-sheet");
    await expect(sheet).toHaveAttribute("data-stop", "peek");
    const handle = page.getByTestId("sheet-handle");
    await handle.click();
    await expect(sheet).toHaveAttribute("data-stop", "half");
    await handle.click();
    await expect(sheet).toHaveAttribute("data-stop", "full");
    await expect(page.getByRole("main")).toHaveAttribute("inert", "");
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveAttribute("data-stop", "half");
    await handle.focus();
    await page.keyboard.press("ArrowDown");
    await expect(sheet).toHaveAttribute("data-stop", "peek");
    await page.keyboard.press("ArrowUp");
    await expect(sheet).toHaveAttribute("data-stop", "half");
  });
});
