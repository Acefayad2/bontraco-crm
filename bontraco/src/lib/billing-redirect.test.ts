import { describe, expect, it } from "vitest";
import { verifiedBillingRedirect } from "./billing-redirect";

describe("verifiedBillingRedirect", () => {
  it("accepts only Stripe Checkout and Customer Portal HTTPS URLs", () => {
    expect(verifiedBillingRedirect("https://checkout.stripe.com/c/pay/session-one")).toBe(
      "https://checkout.stripe.com/c/pay/session-one",
    );
    expect(verifiedBillingRedirect("https://billing.stripe.com/p/session/session-two")).toBe(
      "https://billing.stripe.com/p/session/session-two",
    );
  });

  it("rejects untrusted schemes, hosts, credentials, and malformed values", () => {
    expect(verifiedBillingRedirect("javascript:alert(1)")).toBeNull();
    expect(verifiedBillingRedirect("https://checkout.stripe.com.evil.example/session")).toBeNull();
    expect(verifiedBillingRedirect("https://stripe.com/session")).toBeNull();
    expect(verifiedBillingRedirect("http://checkout.stripe.com/session")).toBeNull();
    expect(verifiedBillingRedirect("https://user:pass@checkout.stripe.com/session")).toBeNull();
    expect(verifiedBillingRedirect("not a URL")).toBeNull();
    expect(verifiedBillingRedirect(null)).toBeNull();
  });
});
