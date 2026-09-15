import { createClient } from "@supabase/supabase-js";
import Retell from "retell-sdk";

export const reconciliationFailureMessage = "Call reconciliation failed";

export default async () => {
  const { RETELL_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!RETELL_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ skipped: true, reason: "Retell is not configured" }), {
      status: 200,
    });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: calls, error } = await supabase
    .from("calls")
    .select("id,account_id,provider_call_id")
    .eq("provider", "retell")
    .eq("status", "completed")
    .gte("started_at", since)
    .limit(200);
  if (error)
    return new Response(JSON.stringify({ error: reconciliationFailureMessage }), { status: 500 });
  const ids = (calls || []).map((call) => call.provider_call_id);
  if (!ids.length)
    return new Response(JSON.stringify({ checked: 0, reconciled: 0 }), { status: 200 });
  const { data: existing, error: existingError } = await supabase
    .from("call_usage")
    .select("external_usage_id")
    .eq("provider", "retell")
    .in("external_usage_id", ids);
  if (existingError)
    return new Response(JSON.stringify({ error: reconciliationFailureMessage }), { status: 500 });
  const recorded = new Set((existing || []).map((item) => item.external_usage_id));
  const missing = (calls || []).filter((call) => !recorded.has(call.provider_call_id));
  const retell = new Retell({ apiKey: RETELL_API_KEY });
  let reconciled = 0;
  for (const callRow of missing.slice(0, 50)) {
    try {
      const call = await retell.call.retrieve(callRow.provider_call_id);
      const seconds = Number(
        call.call_cost?.total_duration_seconds ??
          (call.end_timestamp && call.start_timestamp
            ? (call.end_timestamp - call.start_timestamp) / 1000
            : 0),
      );
      const cost = Number(call.call_cost?.combined_cost);
      const { error: usageError } = await supabase.from("call_usage").upsert(
        {
          account_id: callRow.account_id,
          call_id: callRow.id,
          provider: "retell",
          external_usage_id: callRow.provider_call_id,
          billable_seconds: Math.max(0, Math.round(seconds)),
          provider_cost_cents: Number.isFinite(cost) ? Math.max(0, Math.round(cost)) : null,
          metadata: { reconciled: true },
        },
        { onConflict: "provider,external_usage_id" },
      );
      if (!usageError) reconciled += 1;
    } catch {
      // A later scheduled run retries temporarily unavailable provider records.
    }
  }
  return new Response(
    JSON.stringify({ checked: calls?.length || 0, missing: missing.length, reconciled }),
    { status: 200, headers: { "content-type": "application/json", "cache-control": "no-store" } },
  );
};

export const config = { schedule: "17 * * * *" };
