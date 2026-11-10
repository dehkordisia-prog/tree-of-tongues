// Rendering of language marks and the automatic Arabic-script fallback.

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import "@/i18n";
import { parseInline } from "@/data/profile/markdown";

import { Inlines } from "./Profile";

const AR = "كتاب";
const AR2 = "باب";
const CYR = "слово";

describe("Inlines: language marks", () => {
  it("renders a mark as <bdi lang dir>, nested inside emphasis, and keeps the fa fallback for unmarked runs", () => {
    const nodes = parseInline(`*[${AR}]{lang=ar}* [${CYR} *x*]{lang=tg-Cyrl} ${AR2}`);
    const { container } = render(
      <p>
        <Inlines nodes={nodes} />
      </p>,
    );
    const bdis = Array.from(container.querySelectorAll("bdi"));
    expect(bdis.map((b) => [b.getAttribute("lang"), b.getAttribute("dir"), b.textContent])).toEqual([
      ["ar", "rtl", AR],
      ["tg-Cyrl", "ltr", `${CYR} x`],
      ["fa", "rtl", AR2],
    ]);
    expect(bdis[0]!.parentElement!.tagName).toBe("EM");
    expect(bdis[1]!.querySelector("em")?.textContent).toBe("x");
  });
});
