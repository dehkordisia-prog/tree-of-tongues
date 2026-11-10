import { describe, expect, it } from "vitest";

import { loadRegionNames, regionName, regionNameOrNull } from "./regions";

describe("pinned region names (CLDR 49)", () => {
  it("does not depend on the runtime's Intl data", () => {
    // These four differ between Node 26 ICU and Chromium; the pinned table decides.
    expect(regionName("en", "HK")).toBe("Hong Kong SAR China");
    expect(regionName("en", "mo")).toBe("Macao SAR China");
    expect(regionName("en", "FK")).toBe("Falkland Islands");
    expect(regionName("en", "PS")).toBe("Palestinian Territories");
  });

  it("falls back to English, then to the code", async () => {
    expect(regionNameOrNull("tr", "TR")).toBeNull(); // not loaded yet
    expect(regionName("tr", "TR")).toBe("Türkiye");
    await loadRegionNames("tr");
    expect(regionName("tr", "DE")).toBe("Almanya");
    expect(regionName("en", "ZZZ")).toBe("ZZZ");
  });

  it("loads Persian names", async () => {
    await loadRegionNames("fa");
    expect(regionName("fa", "IR")).toBe("ایران");
  });
});
