import { describe, expect, it } from "vitest";
import { configuredIntegrations } from "../../netlify/functions/integration-status.mjs";

describe("integration readiness", () => {
  it("returns booleans without exposing credential values", () => {
    const status = configuredIntegrations({
      TAVILY_API_KEY: "search-secret",
      GOOGLE_MAPS_API_KEY: "maps-secret",
      STRIPE_SECRET_KEY: "stripe-secret",
      STRIPE_WEBHOOK_SECRET: "webhook-secret",
      STRIPE_PRICE_STARTER: "starter",
      STRIPE_PRICE_GROWTH: "growth",
      STRIPE_PRICE_PRO: "pro",
      RETELL_API_KEY: "retell-secret",
      OPERATIONS_ALERT_WEBHOOK_URL: "https://alerts.example.test/bontraco",
    });
    expect(status).toEqual({
      public_web_search: true,
      google_places: true,
      stripe: true,
      retell: true,
      operations_alerts: true,
    });
    expect(JSON.stringify(status)).not.toContain("secret");
  });

  it("requires the complete Stripe configuration", () => {
    expect(configuredIntegrations({ STRIPE_SECRET_KEY: "only-one-value" }).stripe).toBe(false);
  });
});
