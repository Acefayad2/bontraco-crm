import {
  bodyWithinLimit,
  estimateService,
  json,
  validShareToken,
} from "./_shared/estimate-share.mjs";

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  if (!bodyWithinLimit(request, 2048)) return json(413, { error: "Request is too large" });
  const body = await request.json().catch(() => ({}));
  if (!validShareToken(body.token)) return json(404, { error: "Estimate link is unavailable" });
  const supabase = estimateService();
  if (!supabase) return json(503, { error: "Estimate sharing is not configured" });
  const { data, error } = await supabase.rpc("get_bontraco_estimate_share", {
    raw_token: body.token,
  });
  if (error) return json(503, { error: "Estimate could not be loaded" });
  if (!data) return json(404, { error: "Estimate link is unavailable or expired" });
  return json(200, { estimate: data });
};
