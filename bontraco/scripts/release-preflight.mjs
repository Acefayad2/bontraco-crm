/* global process, URL, console */
import { pathToFileURL } from "node:url";

const PLACEHOLDER = /replace|your[-_ ]|example(?:\.|$)|changeme|placeholder/i;

function present(value, minimum = 1) {
  return typeof value === "string" && value.trim().length >= minimum && !PLACEHOLDER.test(value);
}

function httpsUrl(value) {
  if (!present(value)) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function validateReleaseEnvironment(environment = {}) {
  const errors = [];
  const requireValue = (name, minimum = 1) => {
    if (!present(environment[name], minimum))
      errors.push(`${name} is missing, incomplete, or a placeholder`);
  };

  if (environment.CONTEXT !== "production") errors.push("CONTEXT must be production");
  if (environment.VITE_DEMO_MODE !== "false") errors.push("VITE_DEMO_MODE must be exactly false");
  if (environment.ACCOUNT_PURGE_ENABLED !== "false")
    errors.push("ACCOUNT_PURGE_ENABLED must remain false during promotion");

  requireValue("VITE_SUPABASE_URL");
  requireValue("VITE_SUPABASE_PUBLISHABLE_KEY", 24);
  requireValue("SUPABASE_URL");
  requireValue("SUPABASE_SERVICE_ROLE_KEY", 32);
  if (present(environment.VITE_SUPABASE_URL) && !httpsUrl(environment.VITE_SUPABASE_URL))
    errors.push("VITE_SUPABASE_URL must be HTTPS");
  if (present(environment.SUPABASE_URL) && !httpsUrl(environment.SUPABASE_URL))
    errors.push("SUPABASE_URL must be HTTPS");
  if (
    present(environment.VITE_SUPABASE_URL) &&
    present(environment.SUPABASE_URL) &&
    environment.VITE_SUPABASE_URL.replace(/\/$/, "") !== environment.SUPABASE_URL.replace(/\/$/, "")
  )
    errors.push("Browser and server Supabase URLs must match");

  requireValue("TAVILY_API_KEY", 16);
  requireValue("GOOGLE_PLACES_API_KEY", 24);
  requireValue("STRIPE_SECRET_KEY", 24);
  requireValue("STRIPE_WEBHOOK_SECRET", 24);
  requireValue("STRIPE_PRICE_STARTER", 12);
  requireValue("STRIPE_PRICE_GROWTH", 12);
  requireValue("STRIPE_PRICE_PRO", 12);

  const retellNames = ["RETELL_API_KEY", "RETELL_AGENT_ID", "RETELL_FROM_NUMBER"];
  const retellConfigured = retellNames.some((name) => present(environment[name]));
  if (retellConfigured)
    retellNames.forEach((name) => requireValue(name, name === "RETELL_FROM_NUMBER" ? 10 : 12));

  if (!httpsUrl(environment.OPERATIONS_ALERT_WEBHOOK_URL))
    errors.push("OPERATIONS_ALERT_WEBHOOK_URL must be a configured HTTPS endpoint");

  return {
    ready: errors.length === 0,
    errors,
    capabilities: {
      lead_generation:
        present(environment.TAVILY_API_KEY, 16) && present(environment.GOOGLE_PLACES_API_KEY, 24),
      billing: [
        "STRIPE_SECRET_KEY",
        "STRIPE_WEBHOOK_SECRET",
        "STRIPE_PRICE_STARTER",
        "STRIPE_PRICE_GROWTH",
        "STRIPE_PRICE_PRO",
      ].every((name) => present(environment[name], 12)),
      ai_receptionist: retellNames.every((name) =>
        present(environment[name], name === "RETELL_FROM_NUMBER" ? 10 : 12),
      ),
      external_alerts: httpsUrl(environment.OPERATIONS_ALERT_WEBHOOK_URL),
    },
  };
}

function run() {
  const result = validateReleaseEnvironment(process.env);
  if (result.ready) {
    console.log(JSON.stringify({ ready: true, capabilities: result.capabilities }, null, 2));
    return;
  }
  console.error("Bontraco production preflight failed:");
  result.errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run();
