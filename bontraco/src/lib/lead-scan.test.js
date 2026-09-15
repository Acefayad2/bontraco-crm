/* global Request */
import { describe, expect, it } from "vitest";
import {
  assessResultFreshness,
  buildGooglePlacesQueries,
  buildQuery,
  defaultIntentTerms,
  domainFor,
  extractContact,
  hasLeadEngineAccess,
  normalizePhone,
  normalizeLeaseToken,
  selectScheduledProfiles,
  summarizeDailyScanUsage,
  mapGooglePlaceToLead,
  normalizeAllowedDomains,
  publicCollectorErrorMessage,
} from "../../netlify/functions/lead-scan.mjs";
import manualScanHandler, { validProfileId } from "../../netlify/functions/lead-scan-now.mjs";

describe("lead scan normalization", () => {
  it("accepts only RFC-compatible profile identifiers for manual scans", () => {
    expect(validProfileId("0d141279-3cef-4ee5-9fe6-477d1e65a979")).toBe(true);
    expect(validProfileId("someone-elses-profile")).toBe(false);
    expect(validProfileId(123)).toBe(false);
  });

  it("refuses unauthenticated manual scans before touching provider configuration", async () => {
    const response = await manualScanHandler(
      new Request("https://bontraco.example/.netlify/functions/lead-scan-now", {
        method: "POST",
      }),
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Sign in required" });
  });

  it("allows only POST for the manual scan endpoint", async () => {
    const response = await manualScanHandler(
      new Request("https://bontraco.example/.netlify/functions/lead-scan-now"),
    );
    expect(response.status).toBe(405);
  });

  it("normalizes US phone numbers and rejects incomplete values", () => {
    expect(normalizePhone("+1 (630) 555-0186")).toBe("6305550186");
    expect(normalizePhone("555-0186")).toBeNull();
  });

  it("extracts contact details without inventing them", () => {
    expect(extractContact("Call (312) 555-0139 or email Work@Example.com")).toEqual({
      phone: "3125550139",
      email: "work@example.com",
    });
    expect(extractContact("No contact details published")).toEqual({ phone: null, email: null });
  });

  it("builds a geography-qualified intent query", () => {
    expect(
      buildQuery({
        search_terms: ["need a roofer", "roof leak"],
        trades: ["roofing"],
        geography: { city: "Chicago", region: "IL", country: "US" },
      }),
    ).toBe('"need a roofer" OR "roof leak" Chicago IL US');
  });

  it("builds trade-aware fallback queries when a profile has no phrases", () => {
    expect(
      buildQuery({
        search_terms: [],
        trades: ["plumbing"],
        geography: { city: "Chicago", region: "IL", country: "US" },
      }),
    ).toContain('"need a plumber" OR "burst pipe"');
    expect(defaultIntentTerms(["electrical"])).toContain("electrical panel upgrade");
  });

  it("uses a stable source domain", () => {
    expect(domainFor("https://www.reddit.com/r/chicago/comments/example")).toBe("reddit.com");
    expect(domainFor("not a url")).toBe("web_search");
  });

  it("keeps provider domain filters bounded and valid", () => {
    expect(normalizeAllowedDomains(["Reddit.com", "www.reddit.com", "facebook.com/path"])).toEqual([
      "reddit.com",
    ]);
  });

  it("stores only safe collector failure messages", () => {
    expect(
      publicCollectorErrorMessage(new Error("Tavily request failed (429): private"), "tavily"),
    ).toBe("The lead provider request limit was reached. Bontraco will retry later.");
    expect(
      publicCollectorErrorMessage(
        new Error("Google Places request failed (403): private"),
        "google_places",
      ),
    ).toBe("The lead provider rejected its server credential. Review the integration in Settings.");
    expect(
      publicCollectorErrorMessage(new Error("Database request failed (500): private"), "tavily"),
    ).toBe("Bontraco could not save this scan. It will retry on the next scheduled run.");
    expect(
      publicCollectorErrorMessage(new Error("provider response secret-42"), "google_places"),
    ).toBe("Google Places failed. Bontraco will retry on the next scheduled run.");
  });

  it("enforces Growth/Pro lead-engine billing including the past-due grace window", () => {
    const now = new Date("2026-09-09T12:00:00.000Z");
    expect(hasLeadEngineAccess({ plan_slug: "starter", status: "active" }, now)).toBe(false);
    expect(hasLeadEngineAccess({ plan_slug: "growth", status: "active" }, now)).toBe(true);
    expect(hasLeadEngineAccess({ plan_slug: "pro", status: "trialing" }, now)).toBe(true);
    expect(
      hasLeadEngineAccess(
        { plan_slug: "growth", status: "past_due", grace_ends_at: "2026-09-10T12:00:00Z" },
        now,
      ),
    ).toBe(true);
    expect(
      hasLeadEngineAccess(
        { plan_slug: "growth", status: "past_due", grace_ends_at: "2026-09-08T12:00:00Z" },
        now,
      ),
    ).toBe(false);
  });

  it("bounds paid scheduled work while retaining preceding ineligible profiles for bookkeeping", () => {
    const entries = [
      { id: "inactive-1", eligible: false },
      { id: "paid-1", eligible: true },
      { id: "inactive-2", eligible: false },
      { id: "paid-2", eligible: true },
      { id: "paid-3", eligible: true },
    ];
    expect(selectScheduledProfiles(entries, 2).map((entry) => entry.id)).toEqual([
      "inactive-1",
      "paid-1",
      "inactive-2",
      "paid-2",
    ]);
  });

  it("counts successful and failed provider attempts against the daily request budget", () => {
    expect(
      summarizeDailyScanUsage([
        { found_count: 4, request_count: 2 },
        { found_count: 0, request_count: 3 },
        { found_count: -1, request_count: -1 },
      ]),
    ).toEqual({ results: 4, requests: 5 });
  });

  it("accepts only generated v4 scan-lease tokens", () => {
    expect(normalizeLeaseToken("B339B8EE-84CF-46F4-A2A5-E170CC832C99")).toBe(
      "b339b8ee-84cf-46f4-a2a5-e170cc832c99",
    );
    expect(normalizeLeaseToken("not-a-token")).toBeNull();
    expect(normalizeLeaseToken(null)).toBeNull();
  });

  it("requires public social posts to carry a recent publish date", () => {
    const now = new Date("2026-09-09T12:00:00.000Z");
    expect(
      assessResultFreshness(
        { url: "https://reddit.com/r/chicago/comments/new", published_date: "2026-09-08" },
        7,
        now,
      ),
    ).toMatchObject({ accepted: true, basis: "published_date" });
    expect(assessResultFreshness({ url: "https://nextdoor.com/p/example" }, 7, now)).toEqual({
      accepted: false,
      postedAt: null,
      basis: "missing_post_date",
    });
  });

  it("rejects stale, invalid, and implausibly future dates", () => {
    const now = new Date("2026-09-09T12:00:00.000Z");
    expect(
      assessResultFreshness(
        { url: "https://reddit.com/example", published_date: "2023-01-01" },
        7,
        now,
      ).basis,
    ).toBe("stale_post_date");
    expect(
      assessResultFreshness(
        { url: "https://reddit.com/example", published_date: "not-a-date" },
        7,
        now,
      ).basis,
    ).toBe("invalid_post_date");
    expect(
      assessResultFreshness(
        { url: "https://reddit.com/example", published_date: "2026-09-12" },
        7,
        now,
      ).basis,
    ).toBe("future_post_date");
  });

  it("retains undated non-post pages only under the provider date filter", () => {
    expect(
      assessResultFreshness(
        { url: "https://example.com/property-management" },
        7,
        new Date("2026-09-09T12:00:00.000Z"),
      ),
    ).toEqual({ accepted: true, postedAt: null, basis: "provider_date_filter" });
  });

  it("builds bounded, geography-qualified Google Places queries", () => {
    expect(
      buildGooglePlacesQueries({
        search_terms: ["property management company", "HOA management company"],
        geography: { city: "Chicago", region: "IL" },
      }),
    ).toEqual([
      "property management company in Chicago, IL",
      "HOA management company in Chicago, IL",
    ]);
  });

  it("maps only attributable Google Places businesses into leads", () => {
    const collectedAt = "2026-09-09T12:00:00.000Z";
    const lead = mapGooglePlaceToLead(
      {
        id: "place-123",
        displayName: { text: "Lakeshore Property Management" },
        formattedAddress: "100 N State St, Chicago, IL 60602",
        nationalPhoneNumber: "(312) 555-0144",
        googleMapsUri: "https://maps.google.com/example",
        websiteUri: "https://example.com",
        businessStatus: "OPERATIONAL",
        primaryType: "real_estate_agency",
      },
      { account_id: "account-1", id: "profile-1", trades: ["roofing"] },
      collectedAt,
    );
    expect(lead).toMatchObject({
      source: "google_places",
      source_external_id: "place-123",
      contact_name: "Lakeshore Property Management",
      contact_phone: "3125550144",
      score: 90,
      dedup_key: "google_places:place-123",
    });
    expect(lead.evidence.refresh_by).toBe("2026-10-09T12:00:00.000Z");
    expect(
      mapGooglePlaceToLead(
        { id: "closed", displayName: { text: "Closed Co" }, businessStatus: "CLOSED_PERMANENTLY" },
        { account_id: "account-1", id: "profile-1", trades: ["roofing"] },
      ),
    ).toBeNull();
  });
});
