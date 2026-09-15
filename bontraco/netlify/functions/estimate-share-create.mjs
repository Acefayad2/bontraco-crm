import { createHash, randomBytes } from "node:crypto";
import {
  bodyWithinLimit,
  estimateService,
  json,
  validEstimateId,
} from "./_shared/estimate-share.mjs";
import { selectedWorkspaceId } from "./_shared/workspace-request.mjs";

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  if (!bodyWithinLimit(request, 2048)) return json(413, { error: "Request is too large" });
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!bearer) return json(401, { error: "Sign in required" });
  const accountId = selectedWorkspaceId(request);
  if (!accountId) return json(400, { error: "Workspace selection is required" });
  const body = await request.json().catch(() => ({}));
  if (!validEstimateId(body.estimate_id)) return json(400, { error: "Select a valid estimate" });
  const supabase = estimateService();
  if (!supabase) return json(503, { error: "Estimate sharing is not configured" });

  const { data: authData, error: authError } = await supabase.auth.getUser(bearer);
  if (authError || !authData.user) return json(401, { error: "Session is invalid" });
  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("account_id")
    .eq("account_id", accountId)
    .eq("user_id", authData.user.id)
    .eq("active", true)
    .maybeSingle();
  if (membershipError) return json(503, { error: "Workspace access could not be checked" });
  if (!membership) return json(403, { error: "This workspace is unavailable" });

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const { data: shareId, error } = await supabase.rpc("create_bontraco_estimate_share", {
    target_account_id: accountId,
    target_estimate_id: body.estimate_id.trim(),
    target_token_hash: tokenHash,
    actor_id: authData.user.id,
  });
  if (error) {
    const denied = error.code === "42501";
    const invalid = ["22023", "23514"].includes(error.code);
    return json(denied ? 403 : invalid ? 409 : 503, {
      error: denied || invalid ? error.message : "Customer link creation failed",
    });
  }

  const shareUrl = new URL("/estimate", request.url);
  shareUrl.hash = rawToken;
  return json(201, { share_id: shareId, share_url: shareUrl.toString() });
};
