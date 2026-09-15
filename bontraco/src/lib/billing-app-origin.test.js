import { describe, expect, it } from "vitest";
import { billingAppOrigin } from "../../netlify/functions/_shared/billing-app-origin.mjs";

describe("billingAppOrigin", () => {
  it("prefers the exact HTTPS deploy URL over the production site URL", () => {
    expect(
      billingAppOrigin({
        DEPLOY_PRIME_URL: "https://deploy-preview--bontraco.netlify.app",
        URL: "https://bontraco.netlify.app",
      }),
    ).toBe("https://deploy-preview--bontraco.netlify.app");
    expect(billingAppOrigin({ URL: "https://bontraco.example" })).toBe("https://bontraco.example");
  });

  it("rejects missing, insecure, credentialed, or non-origin values", () => {
    expect(billingAppOrigin({})).toBeNull();
    expect(billingAppOrigin({ URL: "http://bontraco.example" })).toBeNull();
    expect(billingAppOrigin({ URL: "https://user:pass@bontraco.example" })).toBeNull();
    expect(billingAppOrigin({ URL: "https://bontraco.example/app" })).toBeNull();
    expect(billingAppOrigin({ URL: "https://bontraco.example?next=evil" })).toBeNull();
    expect(billingAppOrigin({ URL: "not a URL" })).toBeNull();
  });
});
