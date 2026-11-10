import { render } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import "@/i18n";
import { ScriptSpecimen } from "./ScriptSpecimen";

describe("ScriptSpecimen", () => {
  it("gives every sample an explicit lang and dir, never inherited from the page", async () => {
    const Stub = createRoutesStub([{ path: "/", Component: () => <ScriptSpecimen /> }]);
    const { container, findByRole } = render(<Stub initialEntries={["/"]} />);
    await findByRole("navigation");
    const samples = Array.from(container.querySelectorAll("[data-sample]"));
    expect(samples.length).toBeGreaterThan(20);
    for (const sample of samples) {
      expect(sample.getAttribute("lang"), sample.textContent ?? "").toBeTruthy();
      expect(["ltr", "rtl"], sample.textContent ?? "").toContain(sample.getAttribute("dir"));
    }
    // Persian samples are RTL, everything else LTR.
    for (const sample of samples) {
      const persian = /^fa$/.test(sample.getAttribute("lang") ?? "");
      expect(sample.getAttribute("dir")).toBe(persian ? "rtl" : "ltr");
    }
  });
});
