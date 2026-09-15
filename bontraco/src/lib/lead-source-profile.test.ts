import { describe, expect, it } from "vitest";
import {
  defaultLeadTerms,
  formatLeadCadence,
  isLeadProviderConfigured,
  normalizeLeadDomains,
} from "./lead-source-profile";

describe("lead source domain allowlist", () => {
  it("normalizes and deduplicates hostnames", () => {
    expect(normalizeLeadDomains("Reddit.com, https://www.REDDIT.com/, patch.com")).toEqual({
      domains: ["reddit.com", "patch.com"],
      invalid: [],
    });
  });

  it("rejects paths, wildcards, and non-domain input", () => {
    expect(normalizeLeadDomains("reddit.com/r/chicago, *.facebook.com, localhost")).toEqual({
      domains: [],
      invalid: ["reddit.com/r/chicago", "*.facebook.com", "localhost"],
    });
  });
});

describe("trade-aware lead defaults", () => {
  it("starts plumbing and electrical workspaces with relevant intent phrases", () => {
    expect(defaultLeadTerms(["plumbing"])).toEqual(
      expect.arrayContaining(["need a plumber", "burst pipe", "water heater repair"]),
    );
    expect(defaultLeadTerms(["electrical"])).toEqual(
      expect.arrayContaining(["need an electrician", "electrical panel upgrade"]),
    );
    expect(defaultLeadTerms(["plumbing"])).not.toContain("need a roofer");
  });

  it("deduplicates bounded defaults for mixed and unknown trades", () => {
    expect(defaultLeadTerms(["roofing", "roofing"]).length).toBe(4);
    expect(defaultLeadTerms(["unknown"])).toEqual([
      "contractor needed",
      "property repair",
      "home repair estimate",
    ]);
  });
});

describe("lead provider readiness", () => {
  it("maps each source only to its own server-side integration", () => {
    const status = { public_web_search: true, google_places: false };
    expect(isLeadProviderConfigured("tavily", status)).toBe(true);
    expect(isLeadProviderConfigured("google_places", status)).toBe(false);
    expect(isLeadProviderConfigured("reddit_api", status)).toBe(false);
    expect(isLeadProviderConfigured("tavily", null)).toBe(false);
    expect(formatLeadCadence(15)).toBe("every 15 min");
    expect(formatLeadCadence(60)).toBe("hourly");
    expect(formatLeadCadence(240)).toBe("every 4 hours");
    expect(formatLeadCadence(1440)).toBe("daily");
  });
});
