import { expect, test, type Page } from "@playwright/test";

// Profile prose in the Inspector (content/languages/*.md) and the Lumper/Splitter slot. Both come
// from content/, so every test here runs with or without data/build: without it, the Inspector
// shows the "Could not load the details." state with the profile tabs under it.

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.location().url.includes("/data/") && !m.text().includes("404"))
      errors.push(m.text());
  });
  return errors;
}

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.locator(".tt-shell[data-hydrated]").waitFor();
  await page.locator("article[data-entity]").waitFor();
}

const inspector = (page: Page) => page.getByTestId("inspector");
const visiblePanel = (page: Page) => page.locator('[role="tabpanel"]:not([hidden])');

test.describe.configure({ timeout: 60_000 });

test("Turkish: draft banner, a citation with its access note, and an Unverified chip", async ({ page }) => {
  const errors = watchErrors(page);
  await open(page, "/language/nucl1301");

  const banner = page.getByTestId("draft-banner");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("Draft. Under review by linguists and the project owner.");

  // The Hook leads Overview, with a numbered citation.
  const hook = visiblePanel(page).getByTestId("profile-hook");
  await expect(hook).toContainText("1928");
  const chip = hook.locator('[data-citation="profile"]').first();
  await expect(chip).toHaveText("[1]");
  await expect(chip).toHaveAccessibleName(/^Source 1: .+\. Show details$/);
  await chip.click();
  const pop = page.locator(".tt-popover");
  await expect(pop).toBeVisible();
  await expect(pop).toContainText("Source 1");
  for (const label of ["Author", "Title", "Year", "Link", "Retrieved", "Access"])
    await expect(pop).toContainText(label);
  await expect(pop.locator("[data-access]")).toHaveText(/^(Opened|Catalog only|Not opened)$/);
  await expect(pop.getByRole("link")).toHaveAttribute("href", /^https:\/\//);
  await page.keyboard.press("Escape");
  await expect(pop).toBeHidden();
  // Keyboard opens it too.
  await chip.focus();
  await page.keyboard.press("Enter");
  await expect(pop).toBeVisible();
  await page.keyboard.press("Escape");

  // TODO(verify) never shows raw: it is an Unverified chip with its own accessible name.
  const unverified = inspector(page).getByRole("link", { name: "This claim has not been verified yet" });
  expect(await unverified.count()).toBeGreaterThan(0);
  await expect(unverified.first()).toHaveText("Unverified");
  const before = page.url();
  await unverified.first().click();
  await expect(page.locator("#profile-unverified")).toBeFocused();
  await expect(page.locator("#profile-unverified")).toContainText("What Unverified means");
  expect(page.url()).toBe(before);
  await expect(inspector(page)).not.toContainText("TODO(verify)");
  await expect(inspector(page)).not.toContainText("<!--");

  // The profile's own sections sit on the spec's tabs; Sources lists the citations by number.
  await page.getByRole("tab", { name: "Writing" }).click();
  await expect(visiblePanel(page).getByRole("heading", { name: "Writing", level: 2 })).toBeVisible();
  await page.getByRole("tab", { name: "Sources" }).click();
  const list = visiblePanel(page).getByTestId("profile-sources");
  await expect(list).toContainText("Sources cited in the profile");
  await expect(list.locator("li").first()).toContainText("[1]");
  await expect(list.locator("[data-access]").first()).toHaveText(/^(Opened|Catalog only|Not opened)$/);
  expect(errors).toEqual([]);
});

test("Iranian Persian: Persian spans keep lang and dir, transcriptions are tagged", async ({ page }) => {
  await open(page, "/language/west2369");
  const fa = inspector(page).locator('bdi[lang="fa"][dir="rtl"]');
  expect(await fa.count()).toBeGreaterThan(0);
  await expect(fa.first()).toHaveText(/[\u0600-\u06FF]/);
  const ipa = inspector(page).locator('[lang="und-fonipa"]');
  expect(await ipa.count()).toBeGreaterThan(0);
  await expect(ipa.first()).toHaveText(/^[[/].+[\]/]$/);
  // The prose is English inside any interface language.
  await expect(inspector(page).locator('[data-testid="profile-hook"]')).toHaveAttribute("lang", "en");
});

test("Why linguists disagree: note, label, members and the Split or Grouped control", async ({ page }) => {
  const errors = watchErrors(page);
  await open(page, "/language/west2369");
  const slot = page.getByTestId("lump-slot");
  await expect(slot.getByRole("heading", { name: "Why linguists disagree" })).toBeVisible();
  await expect(slot).toContainText("three standards"); // inspector_note from the scope list
  await expect(slot.getByTestId("lump-label")).toContainText("Atlas grouping");
  await expect(slot.getByTestId("owner-pending")).toContainText("Owner decision pending");
  await expect(slot.getByRole("link", { name: "Dari" })).toHaveAttribute("href", "/language/dari1249");
  await expect(slot.getByRole("link", { name: "Tajik" })).toHaveAttribute("href", "/language/taji1245");
  await expect(slot).toContainText("The tree and map get grouped views in a later update.");

  const split = slot.getByRole("radio", { name: "Split (Glottolog)" });
  const grouped = slot.getByRole("radio", { name: "Grouped" });
  await expect(split).toBeChecked();
  await grouped.click();
  await expect(page).toHaveURL(/\/language\/west2369\?lump=persian$/);
  await expect(grouped).toBeChecked();
  await expect(slot).toContainText("Grouped view");
  // The choice was pushed: Back returns to the split view.
  await page.goBack();
  await expect(page).toHaveURL(/\/language\/west2369$/);
  await expect(page.getByTestId("lump-slot").getByRole("radio", { name: "Split (Glottolog)" })).toBeChecked();
  // A shared link restores the grouped view, and the D-022 ISO alias reads as the same group.
  await open(page, "/language/west2369?lump=fas");
  await expect(page).toHaveURL(/lump=persian/);
  await expect(page.getByTestId("lump-slot").getByRole("radio", { name: "Grouped" })).toBeChecked();
  expect(errors).toEqual([]);
});

test("a language without a profile or a lumper group shows neither", async ({ page }) => {
  await open(page, "/language/stan1290");
  await expect(page.getByTestId("draft-banner")).toHaveCount(0);
  await expect(page.getByTestId("lump-slot")).toHaveCount(0);
  await expect(page.getByTestId("profile-hook")).toHaveCount(0);
});
