import { createClient } from "@supabase/supabase-js";
import { runProfile } from "./lead-scan.mjs";
import { selectedWorkspaceId } from "./_shared/workspace-request.mjs";

const profileIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const profileFields = [
  "id",
  "account_id",
  "provider",
  "trades",
  "search_terms",
  "geography",
  "allowed_domains",
  "cadence_minutes",
  "max_age_days",
  "max_results_per_run",
  "daily_result_limit",
  "daily_request_limit",
].join(",");

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export function validProfileId(value) {
  return typeof value === "string" && profileIdPattern.test(value.trim());
}

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "Sign in required" });
  const accountId = selectedWorkspaceId(request);
  if (!accountId) return json(400, { error: "Workspace selection is required" });
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
    return json(503, { error: "Lead scanning is not configured" });
  const body = await request.json().catch(() => ({}));
  if (!validProfileId(body.profile_id))
    return json(400, { error: "Select a valid search profile" });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: "Session is invalid" });
  const { data: membership } = await supabase
    .from("memberships")
    .select("account_id")
    .eq("user_id", authData.user.id)
    .eq("account_id", accountId)
    .eq("active", true)
    .in("role", ["owner", "admin"])
    .maybeSingle();
  if (!membership) return json(403, { error: "Only owners and admins can run lead scans" });

  const { data: profile, error: profileError } = await supabase
    .from("lead_source_profiles")
    .select(profileFields)
    .eq("account_id", membership.account_id)
    .eq("id", body.profile_id.trim())
    .maybeSingle();
  if (profileError) return json(503, { error: "Search profile lookup failed" });
  if (!profile) return json(404, { error: "Search profile not found in this workspace" });

  const cooldownStart = new Date(Date.now() - 60_000).toISOString();
  const { data: recentRun, error: recentRunError } = await supabase
    .from("lead_scan_runs")
    .select("id")
    .eq("account_id", membership.account_id)
    .eq("source_profile_id", profile.id)
    .gte("started_at", cooldownStart)
    .limit(1)
    .maybeSingle();
  if (recentRunError) return json(503, { error: "Scan cooldown check failed" });
  if (recentRun)
    return json(429, {
      error: "This search ran within the last minute. Review that result first.",
    });

  try {
    const result = await runProfile(profile);
    return json(200, { result });
  } catch {
    return json(503, { error: "Bontraco could not initialize this scan" });
  }
};
