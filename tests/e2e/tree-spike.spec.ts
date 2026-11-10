import { expect, test, type Page } from "@playwright/test";

// /spike/tree reads /data/tree.json, which is gitignored and absent in CI.
// Data assertions run only when the file is served; the "not built" state is tested with a 404 stub.

async function dataIsServed(page: Page): Promise<boolean> {
  const res = await page.request.get("/data/tree.json", { headers: { accept: "application/json" } });
  if (!res.ok()) return false;
  return (res.headers()["content-type"] ?? "").includes("json");
}

test("shows a clear state when the data is not built", async ({ page }) => {
  await page.route("**/data/tree.json", (route) => route.fulfill({ status: 404, body: "not found" }));
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await page.goto("/spike/tree");
  await expect(page.locator("h1")).toHaveText("Tree spike");
  const status = page.getByRole("status").filter({ hasText: "Data not built yet" });
  await expect(status).toContainText("Run uv run pipeline build.");
  await expect(page.locator("canvas")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("a dev server answering 200 with HTML counts as not built", async ({ page }) => {
  await page.route("**/data/tree.json", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>x</title>" }),
  );
  await page.goto("/spike/tree");
  await expect(page.getByRole("status").filter({ hasText: "Data not built yet" })).toBeVisible();
});

test("bench=1 installs window.__bench that rejects cleanly without data", async ({ page }) => {
  await page.route("**/data/tree.json", (route) => route.fulfill({ status: 404, body: "" }));
  await page.goto("/spike/tree?bench=1");
  await page.waitForFunction(() => !!(window as unknown as { __bench?: unknown }).__bench);
  const outcome = await page.evaluate(async () => {
    const b = (window as unknown as { __bench: { ready: Promise<void>; run: unknown } }).__bench;
    try {
      await b.ready;
      return "resolved";
    } catch {
      return typeof b.run === "function" ? "rejected" : "no run";
    }
  });
  expect(outcome).toBe("rejected");
});

for (const renderer of ["pixi", "deck"] as const) {
  test.describe(`with data, ${renderer}`, () => {
    test.beforeEach(async ({ page }) => {
      test.skip(!(await dataIsServed(page)), "data/build/tree.json is not available");
    });

    test("draws, names the canvas and works from the keyboard", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await page.goto(`/spike/tree?renderer=${renderer}`);
      const canvas = page.getByRole("application", { name: /Language family tree/ });
      await expect(canvas).toBeVisible();
      await expect(page.getByTestId("tree-stats")).toContainText("languoids loaded", { timeout: 30_000 });
      await expect(page.getByTestId("tree-stats")).toContainText(/circles and \d+ labels drawn/, { timeout: 30_000 });

      await canvas.focus();
      const live = page.locator("[aria-live=polite]");
      await page.keyboard.press("ArrowRight"); // reveals the cursor on the first child
      await expect(live).toContainText(/family|language/);
      await page.keyboard.press("ArrowRight");
      await expect(live).toContainText(/2 of \d/);
      await page.keyboard.press("Enter");
      await expect(live).toContainText("Focused");
      const crumbs = page.getByRole("navigation", { name: "Focused path" }).getByRole("button");
      await expect(crumbs).toHaveCount(2);
      await expect(page).toHaveURL(/focus=/);

      await page.keyboard.press("Escape");
      await expect(live).toContainText("Zoomed out to");
      await expect(crumbs).toHaveCount(1);
      await expect(page).not.toHaveURL(/focus=/);

      await page.keyboard.press("Escape");
      await expect(live).toContainText("Already showing the whole tree");
      expect(errors).toEqual([]);
    });

    test("click flies to a node and a breadcrumb flies back", async ({ page }) => {
      await page.goto(`/spike/tree?renderer=${renderer}`);
      await expect(page.getByTestId("tree-stats")).toContainText("circles", { timeout: 30_000 });
      const box = (await page.locator("canvas").boundingBox())!;
      // The world is centered; the largest child sits left of center. Click the center of the canvas.
      await page.mouse.click(box.x + box.width / 2 - 120, box.y + box.height / 2);
      await expect(page.getByRole("navigation", { name: "Focused path" }).getByRole("button")).not.toHaveCount(1);
      await page.getByRole("navigation", { name: "Focused path" }).getByRole("button", { name: "World" }).click();
      await expect(page.getByRole("navigation", { name: "Focused path" }).getByRole("button")).toHaveCount(1);
    });

    test("reduced motion cuts instead of flying", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(`/spike/tree?renderer=${renderer}`);
      await expect(page.getByTestId("tree-stats")).toContainText("circles", { timeout: 30_000 });
      await page.locator("canvas").focus();
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("Enter");
      // Opacity crossfade only: 200 ms, no camera flight. The state is final within a short wait.
      await expect(page.getByRole("navigation", { name: "Focused path" }).getByRole("button")).toHaveCount(2);
    });

    test("bench=1 exposes window.__bench with the shared contract", async ({ page }) => {
      await page.goto(`/spike/tree?renderer=${renderer}&bench=1`);
      await page.waitForFunction(() => !!(window as unknown as { __bench?: unknown }).__bench);
      await page.evaluate(() => (window as unknown as { __bench: { ready: Promise<void> } }).__bench.ready);
      const shape = await page.evaluate(() => {
        const b = (window as unknown as { __bench: { ready: unknown; run: unknown } }).__bench;
        return { ready: b.ready instanceof Promise, run: typeof b.run };
      });
      expect(shape).toEqual({ ready: true, run: "function" });
    });
  });
}
