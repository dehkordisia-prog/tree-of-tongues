import { describe, expect, it } from "vitest";

import { checkAllProfiles, profileGlottocodes, readBib, readProfile } from "./profiles.server";

// The build runs checkAllProfiles in buildStart (vite.config.ts, profiles plugin): any error here
// fails `pnpm build`.
describe("profiles at build time", () => {
  it("finds the profile files by glottocode", () => {
    expect(profileGlottocodes()).toEqual(expect.arrayContaining(["nucl1301", "stan1293", "west2369"]));
  });
  it("builds every profile against content/sources.bib", () => {
    expect(() => checkAllProfiles()).not.toThrow();
  });
  it("fails, naming the key, when a cited key is missing from the bibliography", () => {
    const bib = readBib();
    bib.delete("tr_kanun1353_1928");
    expect(() => readProfile("nucl1301", bib)).toThrow(/content\/languages\/nucl1301\.md: unknown citation key "tr_kanun1353_1928"/);
  });
});
