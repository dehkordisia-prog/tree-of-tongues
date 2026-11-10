import { expect, test, type Page } from "@playwright/test";

// docs/specs/persian.md section 4.4 (D-032). Pending (test.fixme) until section 4.2 lands.
// Chromium reports which font drew a node's glyphs (CDP CSS.getPlatformFontsForNode). Persian
// Nastaliq digits must come from Noto Naskh Arabic (Persian forms); Urdu Nastaliq digits must stay
// with Noto Nastaliq Urdu (Urdu forms); Persian Nastaliq letters stay Nastaliq.

async function fontsFor(page: Page, id: string): Promise<Record<string, number>> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: `#${id}` });
  const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
  return Object.fromEntries(fonts.map((f) => [f.familyName, f.glyphCount]));
}

async function sample(page: Page, id: string, lang: string, text: string) {
  await page.evaluate(
    ({ id, lang, text }) => {
      const p = document.createElement("p");
      p.id = id;
      p.lang = lang;
      p.dir = "rtl";
      p.className = "script-nastaliq";
      p.textContent = text;
      document.body.append(p);
    },
    { id, lang, text },
  );
  await page.evaluate(() => document.fonts.ready);
}

test.describe("Persian digits in Nastaliq (D-032)", () => {
  test.fixme("Persian Nastaliq digits come from Naskh, letters from Nastaliq", async ({ page }) => {
    await page.goto("/design?lang=fa");
    await sample(page, "fa-digits", "fa", "۴۶۷");
    await sample(page, "fa-word", "fa", "فارسی");
    expect(Object.keys(await fontsFor(page, "fa-digits"))).toEqual(["Noto Naskh Arabic"]);
    expect(Object.keys(await fontsFor(page, "fa-word"))).toEqual(["Noto Nastaliq Urdu"]);
  });

  test.fixme("Urdu Nastaliq digits keep the Urdu font", async ({ page }) => {
    await page.goto("/design");
    await sample(page, "ur-digits", "ur", "۴۶۷");
    expect(Object.keys(await fontsFor(page, "ur-digits"))).toEqual(["Noto Nastaliq Urdu"]);
  });
});
