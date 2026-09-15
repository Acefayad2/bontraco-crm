import { createClient } from "@supabase/supabase-js";
import { selectedWorkspaceId } from "./_shared/workspace-request.mjs";

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "Sign in required" });
  const accountId = selectedWorkspaceId(request);
  if (!accountId) return json(400, { error: "Workspace selection is required" });
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY.length < 32)
    return json(503, { error: "Platform backend is not configured" });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: "Session is invalid" });

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("account_id")
    .eq("user_id", authData.user.id)
    .eq("account_id", accountId)
    .eq("role", "owner")
    .eq("active", true)
    .maybeSingle();
  if (membershipError) return json(500, { error: "Workspace membership could not be verified" });
  if (!membership) return json(403, { error: "Only the workspace owner can import legacy leads" });

  const { data, error } = await supabase.rpc("import_bontraco_legacy_leads", {
    target_account_id: membership.account_id,
    target_actor_id: authData.user.id,
  });
  if (error) return json(500, { error: "Legacy lead import could not be completed safely" });
  return json(200, { imported: data });
};
