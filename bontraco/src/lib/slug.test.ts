import { describe, expect, it } from "vitest";
import { toWorkspaceSlug } from "./slug";

describe("toWorkspaceSlug", () => {
  it("normalizes a company name for account creation", () => {
    expect(toWorkspaceSlug("  Ace & Sons Roofing, LLC  ")).toBe("ace-sons-roofing-llc");
  });

  it("removes unsupported characters and surrounding separators", () => {
    expect(toWorkspaceSlug("***Bontraco Chicago!!!")).toBe("bontraco-chicago");
  });

  it("limits the database slug length", () => {
    expect(toWorkspaceSlug("A".repeat(100))).toHaveLength(54);
  });
});
