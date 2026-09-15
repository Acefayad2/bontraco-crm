import { createClient } from "@supabase/supabase-js";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const shareToken = /^[A-Za-z0-9_-]{43}$/;
const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
    },
  });

export function environment(name) {
  return globalThis.Netlify?.env?.get(name) || process.env[name] || "";
}

export function estimateService() {
  const url = environment("SUPABASE_URL");
  const key = environment("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export function validEstimateId(value) {
  return typeof value === "string" && uuid.test(value.trim());
}

export function validShareToken(value) {
  return typeof value === "string" && shareToken.test(value);
}

export function normalizeAcceptance(body) {
  const signerName = typeof body?.signer_name === "string" ? body.signer_name.trim() : "";
  const signerEmail =
    typeof body?.signer_email === "string" ? body.signer_email.trim().toLowerCase() : "";
  if (signerName.length < 2 || signerName.length > 120)
    return { error: "Enter the full name of the person accepting this estimate." };
  if (signerEmail && (signerEmail.length > 254 || !email.test(signerEmail)))
    return { error: "Enter a valid email address or leave it blank." };
  if (body?.acknowledged !== true)
    return { error: "Confirm that you reviewed and accept the estimate." };
  return { signerName, signerEmail };
}

export function publicEstimateAcceptanceError(error) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("acknowledgment"))
    return "Confirm that you reviewed and accept the estimate.";
  if (message.includes("signer name"))
    return "Enter the full name of the person accepting this estimate.";
  if (message.includes("signer email")) return "Enter a valid email address or leave it blank.";
  if (message.includes("no longer open")) return "This estimate link is unavailable or expired.";
  return "Estimate acceptance failed";
}

export function bodyWithinLimit(request, maximumBytes) {
  const length = Number(request.headers.get("content-length") || 0);
  return Number.isFinite(length) && length <= maximumBytes;
}
