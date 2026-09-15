import { createHash } from "node:crypto";
import {
  bodyWithinLimit,
  estimateService,
  json,
  normalizeAcceptance,
  publicEstimateAcceptanceError,
  validShareToken,
} from "./_shared/estimate-share.mjs";

export default async (request, context) => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  if (!bodyWithinLimit(request, 10_000)) return json(413, { error: "Request is too large" });
  const body = await request.json().catch(() => ({}));
  if (!validShareToken(body.token)) return json(404, { error: "Estimate link is unavailable" });
  const acceptance = normalizeAcceptance(body);
  if (acceptance.error) return json(400, { error: acceptance.error });
  const supabase = estimateService();
  if (!supabase) return json(503, { error: "Estimate sharing is not configured" });
  const networkHash = context?.ip
    ? createHash("sha256").update(`${body.token}\0${context.ip}`).digest("hex")
    : null;
  const { data, error } = await supabase.rpc("accept_bontraco_estimate_share", {
    raw_token: body.token,
    signer_name_input: acceptance.signerName,
    signer_email_input: acceptance.signerEmail || null,
    acknowledged: true,
    user_agent_input: (request.headers.get("user-agent") || "").slice(0, 500) || null,
    network_hash_input: networkHash,
  });
  if (error) {
    const rejected = ["22023", "23514"].includes(error.code);
    return json(rejected ? 409 : 503, { error: publicEstimateAcceptanceError(error) });
  }
  return json(200, { estimate: data });
};
