import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// The map reads pipeline output from /data/ (data/build), which CI does not have. Every test here
// passes without data (the "not built yet" state) and the data tests skip themselves.

async function hasData(request: APIRequestContext): Promise<boolean> {
  const res = await request.get("/data/geo/languages.geojson");
  return res.ok() && !(res.headers()["content-type"] ?? "").includes("html");
}

function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

// Software WebGL in CI and on laptops is slow to start; the map is the heaviest page.
test.describe.configure({ timeout: 90_000 });

const ready = (page: Page) => page.locator('[data-testid="map"][data-ready="true"]');

test("without data, the page says so and offers the next step", async ({ page, request }) => {
  test.skip(await hasData(request), "data is built");
  const errors = watchConsole(page);
  await page.goto("/spike/map");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Map spike");
  await expect(page.getByRole("status").filter({ hasText: "Data not built yet. Run uv run pipeline build." })).toBeVisible();
  expect(errors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
});

test("with data, the map draws and the page is quiet", async ({ page, request }) => {
  test.skip(!(await hasData(request)), "data is not built");
  const errors = watchConsole(page);
  const foreign: string[] = [];
  page.on("request", (r) => {
    const url = new URL(r.url());
    if (url.protocol.startsWith("http") && url.hostname !== "localhost") foreign.push(r.url());
  });
  await page.goto("/spike/map");
  await expect(ready(page)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("region", { name: /World map of languages/ }).first()).toBeVisible();
  await expect(page.getByTestId("borders-note")).toHaveText(
    "Borders are approximate and do not imply any position on disputed territory.",
  );
  expect(foreign).toEqual([]);
  expect(errors).toEqual([]);
});

test("picking a language lists CLDR territories with source, and says so when there are none", async ({ page, request }) => {
  test.skip(!(await hasData(request)), "data is not built");
  await page.goto("/spike/map");
  await expect(ready(page)).toBeVisible({ timeout: 60_000 });

  const search = page.getByRole("combobox", { name: "Find a language" });
  await search.fill("hindi");
  await expect(page.getByRole("option", { name: /^Hindi/ })).toBeVisible();
  await page.keyboard.press("Enter");
  const panel = page.getByTestId("selection");
  await expect(panel.getByRole("heading", { name: "Hindi" })).toBeVisible();
  await expect(panel.getByRole("table", { name: "Territories where CLDR records this language" })).toBeVisible();
  await expect(panel.getByRole("row", { name: /India.*41%.*Official/ })).toBeVisible();
  await expect(panel).toContainText("Source: Unicode CLDR 49, estimate, no year given.");

  // Persian has no territory rows in this build: say so, do not guess.
  await search.fill("persian");
  await expect(page.getByRole("option", { name: /^Persian/ })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(panel.getByRole("heading", { name: "Persian" })).toBeVisible();
  await expect(panel).toContainText("No territory data yet");
  await expect(panel).toContainText("Western Farsi"); // Glottolog name
  await expect(panel.getByRole("table")).toHaveCount(0);
});

test("picking a country lists its languages, and a disputed area gets no owner", async ({ page, request }) => {
  test.skip(!(await hasData(request)), "data is not built");
  await page.goto("/spike/map");
  await expect(ready(page)).toBeVisible({ timeout: 60_000 });

  const country = page.getByLabel("Pick a country");
  await country.selectOption("c:PG");
  const panel = page.getByTestId("selection");
  await expect(panel.getByRole("heading", { name: "Papua New Guinea" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Tok Pisin" })).toBeVisible();

  // A language row leads on to the language.
  await panel.getByRole("button", { name: "Tok Pisin" }).click();
  await expect(panel.getByRole("heading", { name: "Tok Pisin" })).toBeVisible();

  await country.selectOption("d:B89");
  await expect(panel.getByRole("heading", { name: "Crimean Peninsula" })).toBeVisible();
  await expect(panel).toContainText("Disputed or breakaway area");
  await expect(panel).toContainText("Not filled and not counted toward any state");
  await expect(panel.getByRole("table")).toHaveCount(0);
});

test("the time slider is keyboard operable and admits there is no data", async ({ page, request }) => {
  test.skip(!(await hasData(request)), "data is not built");
  await page.goto("/spike/map");
  await expect(ready(page)).toBeVisible({ timeout: 60_000 });

  const year = new Date().getFullYear();
  const slider = page.getByRole("slider", { name: "Year" });
  await expect(slider).toHaveValue(String(year));
  await expect(page.getByText("No data for this period")).toHaveCount(0);

  await slider.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(slider).toHaveValue(String(year - 1));
  await expect(page.getByText("No data for this period")).toBeVisible();

  await page.keyboard.press("PageDown");
  await expect(slider).toHaveValue(String(year - 101));
  await page.keyboard.press("Home");
  await expect(slider).toHaveValue("1500");

  await page.getByRole("button", { name: "Present day" }).click();
  await expect(slider).toHaveValue(String(year));
  await expect(page.getByText("No data for this period")).toHaveCount(0);
});

test("controls are reachable by keyboard", async ({ page, request }) => {
  test.skip(!(await hasData(request)), "data is not built");
  await page.goto("/spike/map");
  await expect(ready(page)).toBeVisible({ timeout: 60_000 });
  const reachable = new Set<string>();
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const label = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el ? `${el.tagName}:${el.getAttribute("aria-label") ?? el.textContent?.slice(0, 24) ?? ""}` : "";
    });
    reachable.add(label);
  }
  const names = await page.evaluate(() => [...document.querySelectorAll("button[aria-pressed]")].length);
  expect(names).toBe(12);
  // search, country, dialects, map canvas, slider and the legend buttons all took focus
  expect(reachable.size).toBeGreaterThan(10);
});

test("?lang=fa mirrors the panel and controls, not the map", async ({ page, request }) => {
  test.skip(!(await hasData(request)), "data is not built");
  await page.goto("/spike/map?lang=fa");
  await expect(ready(page)).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  const map = await page.getByTestId("map").boundingBox();
  const panel = await page.locator("aside").boundingBox();
  expect(panel!.x).toBeLessThan(map!.x);
  await expect(page.getByTestId("map")).toHaveAttribute("dir", "ltr");
});

test("?bench=1 exposes the benchmark handle", async ({ page, request }) => {
  test.skip(!(await hasData(request)), "data is not built");
  await page.goto("/spike/map?bench=1");
  await page.waitForFunction(() => typeof window.__bench?.run === "function");
  await page.evaluate(() => window.__bench!.ready);
  await expect(ready(page)).toBeVisible();
});
