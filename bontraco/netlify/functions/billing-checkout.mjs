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
  if (!token) return json(401, { error: "Sign in required" });
  const accountId = selectedWorkspaceId(request);
  if (!accountId) return json(400, { error: "Workspace selection is required" });
  const {
    STRIPE_SECRET_KEY,
    STRIPE_PRICE_STARTER,
    STRIPE_PRICE_GROWTH,
    STRIPE_PRICE_PRO,
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
  } = process.env;
  if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
    return json(503, { error: "Billing is not configured yet" });
  const appOrigin = billingAppOrigin();
  if (!appOrigin) return json(503, { error: "Billing return address is not configured" });
  const prices = {
    starter: STRIPE_PRICE_STARTER,
    growth: STRIPE_PRICE_GROWTH,
    pro: STRIPE_PRICE_PRO,
  };
  const body = await request.json().catch(() => ({}));
  const plan = typeof body.plan === "string" ? body.plan : "";
  if (!prices[plan]) return json(400, { error: "That plan is unavailable" });
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: "Session is invalid" });
  const { data: membership } = await supabase
    .from("memberships")
    .select("account_id, role, accounts!inner(name)")
    .eq("user_id", authData.user.id)
    .eq("account_id", accountId)
    .eq("active", true)
    .in("role", ["owner", "admin"])
    .maybeSingle();
  if (!membership) return json(403, { error: "Only account owners and admins can manage billing" });
  const stripe = new Stripe(STRIPE_SECRET_KEY);
  const { data: subscription } = await supabase
    .from("account_subscriptions")
    .select("stripe_customer_id, plan_slug, status")
    .eq("account_id", membership.account_id)
    .maybeSingle();
  let customerId = subscription?.stripe_customer_id;
  if (!customerId) {
    const account = membership.accounts;
    const customer = await stripe.customers.create(
      {
        email: authData.user.email,
        name: account?.name,
        metadata: { account_id: membership.account_id },
      },
      { idempotencyKey: `bontraco-customer-${membership.account_id}` },
    );
    customerId = customer.id;
    const { error } = await supabase.from("account_subscriptions").upsert(
      {
        account_id: membership.account_id,
        stripe_customer_id: customerId,
        plan_slug: subscription?.plan_slug || plan,
        status: subscription?.status || "incomplete",
      },
      { onConflict: "account_id" },
    );
    if (error) return json(500, { error: "Could not initialize billing" });
  }
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: prices[plan], quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${appOrigin}/app?billing=success`,
    cancel_url: `${appOrigin}/app?billing=cancelled`,
    metadata: { account_id: membership.account_id, plan_slug: plan },
    subscription_data: { metadata: { account_id: membership.account_id, plan_slug: plan } },
  });
  return json(200, { url: session.url });
};
