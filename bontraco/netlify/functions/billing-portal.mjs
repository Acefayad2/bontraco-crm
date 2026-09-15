import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { billingAppOrigin } from "./_shared/billing-app-origin.mjs";
import { selectedWorkspaceId } from "./_shared/workspace-request.mjs";

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const { STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!token) return json(401, { error: "Sign in required" });
  const accountId = selectedWorkspaceId(request);
  if (!accountId) return json(400, { error: "Workspace selection is required" });
  if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
    return json(503, { error: "Billing is not configured yet" });
  const appOrigin = billingAppOrigin();
  if (!appOrigin) return json(503, { error: "Billing return address is not configured" });
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: authData } = await supabase.auth.getUser(token);
  if (!authData.user) return json(401, { error: "Session is invalid" });
  const { data: membership } = await supabase
    .from("memberships")
    .select("account_id")
    .eq("user_id", authData.user.id)
    .eq("account_id", accountId)
    .eq("active", true)
    .in("role", ["owner", "admin"])
    .maybeSingle();
  if (!membership) return json(403, { error: "Only account owners and admins can manage billing" });
  const { data: subscription } = await supabase
    .from("account_subscriptions")
    .select("stripe_customer_id")
    .eq("account_id", membership.account_id)
    .maybeSingle();
  if (!subscription?.stripe_customer_id)
    return json(409, { error: "Start a subscription before opening the billing portal" });
  const stripe = new Stripe(STRIPE_SECRET_KEY);
  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: `${appOrigin}/app`,
  });
  return json(200, { url: session.url });
};
