import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateReleaseEnvironment } from "../../scripts/release-preflight.mjs";

const netlifyConfig = readFileSync("netlify.toml", "utf8");
const packageScripts = JSON.parse(readFileSync("package.json", "utf8")).scripts;
const credentialSuffix = "abcdefghijklmnopqrstuvwxyz123456";

const validEnvironment = {
  CONTEXT: "production",
  VITE_DEMO_MODE: "false",
  ACCOUNT_PURGE_ENABLED: "false",
  VITE_SUPABASE_URL: "https://bontraco.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abcdefghijklmnopqrstuvwxyz",
  SUPABASE_URL: "https://bontraco.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: ["sb", "secret", credentialSuffix].join("_"),
  TAVILY_API_KEY: ["tvly", credentialSuffix].join("-"),
  GOOGLE_PLACES_API_KEY: ["AI", "za", credentialSuffix].join(""),
  STRIPE_SECRET_KEY: ["sk", "live", credentialSuffix].join("_"),
  STRIPE_WEBHOOK_SECRET: ["whsec", credentialSuffix].join("_"),
  STRIPE_PRICE_STARTER: "price_starter_123456",
  STRIPE_PRICE_GROWTH: "price_growth_123456",
  STRIPE_PRICE_PRO: "price_pro_123456789",
  OPERATIONS_ALERT_WEBHOOK_URL: "https://alerts.acme.test/bontraco",
};

describe("production release preflight", () => {
  it("runs the preflight before every Netlify production build", () => {
    expect(netlifyConfig).toMatch(
      /\[context\.production\]\s+command = "npm run preflight:production && npm run build"/,
    );
  });

  it("builds and audits an explicitly demo-free artifact during release verification", () => {
    expect(packageScripts["build:production-artifact"]).toMatch(/VITE_DEMO_MODE=false.*vite build/);
    expect(packageScripts["verify:production-artifact"]).toContain("CONTEXT=production");
    expect(packageScripts["verify:release"]).toContain("npm run verify:production-artifact");
  });

  it("accepts a complete production configuration with the optional receptionist disabled", () => {
    const result = validateReleaseEnvironment(validEnvironment);
    expect(result).toMatchObject({
      ready: true,
      errors: [],
      capabilities: { lead_generation: true, billing: true, ai_receptionist: false },
    });
  });

  it("rejects demo mode, mismatched projects, placeholders, and unsafe purge activation", () => {
    const result = validateReleaseEnvironment({
      ...validEnvironment,
      VITE_DEMO_MODE: "true",
      ACCOUNT_PURGE_ENABLED: "true",
      SUPABASE_URL: "https://another.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "replace-in-netlify-secret-store",
    });
    expect(result.ready).toBe(false);
    expect(result.errors.join(" ")).toMatch(/demo|purge|match|service_role_key/i);
  });

  it("requires every receptionist setting when the optional feature is partially configured", () => {
    const result = validateReleaseEnvironment({
      ...validEnvironment,
      RETELL_API_KEY: "retell-secret-123456",
    });
    expect(result.ready).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("RETELL_AGENT_ID"),
        expect.stringContaining("RETELL_FROM_NUMBER"),
      ]),
    );
  });
});
