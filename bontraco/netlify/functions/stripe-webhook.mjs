import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
const iso = (seconds) => (seconds ? new Date(seconds * 1000).toISOString() : null);

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } =
    process.env;
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
    return json(503, { error: "Webhook is not configured" });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return json(400, { error: "Missing signature" });
  const stripe = new Stripe(STRIPE_SECRET_KEY);
  let event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, STRIPE_WEBHOOK_SECRET);
  } catch {
    return json(400, { error: "Invalid signature" });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: claimed, error: claimError } = await supabase.rpc("claim_billing_webhook", {
    target_event_id: event.id,
    target_event_type: event.type,
  });
  if (claimError) return json(500, { error: "Could not claim webhook event" });
  if (!claimed) return json(200, { received: true, duplicate: true });

  try {
    const object = event.data.object;
    if (event.type === "checkout.session.completed") {
      await supabase.from("account_subscriptions").upsert(
        {
          account_id: object.metadata?.account_id,
          stripe_customer_id:
            typeof object.customer === "string" ? object.customer : object.customer?.id,
          stripe_subscription_id:
            typeof object.subscription === "string" ? object.subscription : object.subscription?.id,
          plan_slug: object.metadata?.plan_slug || "starter",
        },
        { onConflict: "account_id" },
      );
    }
    if (event.type.startsWith("customer.subscription.")) {
      const periodEnd = object.current_period_end || object.items?.data?.[0]?.current_period_end;
      await supabase.from("account_subscriptions").upsert(
        {
          account_id: object.metadata?.account_id,
          stripe_customer_id:
            typeof object.customer === "string" ? object.customer : object.customer?.id,
          stripe_subscription_id: object.id,
          plan_slug: object.metadata?.plan_slug || "starter",
          status: object.status,
          trial_ends_at: iso(object.trial_end),
          current_period_ends_at: iso(periodEnd),
          cancel_at_period_end: Boolean(object.cancel_at_period_end),
        },
        { onConflict: "account_id" },
      );
    }
    await supabase
      .from("billing_webhook_events")
      .update({
        processing_status: "processed",
        processed_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("stripe_event_id", event.id);
    return json(200, { received: true });
  } catch (error) {
    await supabase
      .from("billing_webhook_events")
      .update({
        processing_status: "failed",
        last_error: error instanceof Error ? error.message.slice(0, 1000) : "Unknown error",
      })
      .eq("stripe_event_id", event.id);
    return json(500, { error: "Webhook processing failed" });
  }
};
