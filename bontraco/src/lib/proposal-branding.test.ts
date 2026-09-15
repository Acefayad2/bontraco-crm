import { describe, expect, it } from "vitest";
import { config } from "./config";
import { proposalLogoUrl } from "./proposal-branding";

describe("proposalLogoUrl", () => {
  it("creates a public branding URL only for a constrained tenant path", () => {
    const path =
      "20000000-0000-4000-8000-000000000001/branding/30000000-0000-4000-8000-000000000001";
    const result = proposalLogoUrl(path);
    if (config.supabaseUrl) {
      expect(result).toBe(
        `${config.supabaseUrl}/storage/v1/object/public/bontraco-branding/${path}`,
      );
    } else {
      expect(result).toBeNull();
    }
    expect(proposalLogoUrl("../../private/logo.png")).toBeNull();
    expect(
      proposalLogoUrl("20000000-0000-4000-8000-000000000001/branding/not-a-valid-identifier"),
    ).toBeNull();
  });
});
