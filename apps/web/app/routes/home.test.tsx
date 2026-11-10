import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import Home from "./home";

describe("Home", () => {
  it("links to every Phase 0 workbench", async () => {
    const Stub = createRoutesStub([{ path: "/", Component: Home }]);
    render(<Stub initialEntries={["/"]} />);
    const nav = await screen.findByRole("navigation", { name: "Workbenches" });
    const hrefs = Array.from(nav.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/design", "/spike/tree", "/spike/map"]);
  });
});
