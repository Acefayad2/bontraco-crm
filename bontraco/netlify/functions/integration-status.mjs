import { createClient } from "@supabase/supabase-js";
import { selectedWorkspaceId } from "./_shared/workspace-request.mjs";

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export function configuredIntegrations(environment = {}) {
  return {
    public_web_search: Boolean(environment.TAVILY_API_KEY),
    google_places: Boolean(environment.GOOGLE_PLACES_API_KEY || environment.GOOGLE_MAPS_API_KEY),
    stripe: Boolean(
      environment.STRIPE_SECRET_KEY &&
        environment.STRIPE_WEBHOOK_SECRET &&
        environment.STRIPE_PRICE_STARTER &&
        environment.STRIPE_PRICE_GROWTH &&
        environment.STRIPE_PRICE_PRO,
    ),
    retell: Boolean(environment.RETELL_API_KEY),
    operations_alerts: Boolean(environment.OPERATIONS_ALERT_WEBHOOK_URL),
  };
}

export default async (request) => {
  if (request.method !== "GET") return json(405, { error: "Method not allowed" });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "Sign in required" });
  const accountId = selectedWorkspaceId(request);
  if (!accountId) return json(400, { error: "Workspace selection is required" });
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
    return json(503, { error: "Platform is not configured" });
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
  if (!membership) return json(403, { error: "Only owners and admins can view integrations" });
  const { data: receptionist } = await supabase
    .from("receptionist_settings")
    .select("enabled, provider, phone_number, transfer_number")
    .eq("account_id", membership.account_id)
    .maybeSingle();
  return json(200, {
    providers: configuredIntegrations(process.env),
    receptionist_workspace: Boolean(
      receptionist?.enabled &&
        receptionist.provider === "retell" &&
        receptionist.phone_number &&
        receptionist.transfer_number,
    ),
  });
};
