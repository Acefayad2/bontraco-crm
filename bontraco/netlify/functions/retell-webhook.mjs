import { createClient } from "@supabase/supabase-js";
import Retell from "retell-sdk";
import { parseJsonObject } from "./_shared/json-payload.mjs";
import { normalizeCallTiming } from "./_shared/retell-timing.mjs";

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  const { RETELL_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!RETELL_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
    return json(503, { error: "Receptionist is not configured" });
  const rawBody = await request.text();
  const signature = request.headers.get("x-retell-signature") || "";
  if (!Retell.verify(rawBody, RETELL_API_KEY, signature))
    return json(401, { error: "Invalid signature" });
  const payload = parseJsonObject(rawBody);
  if (!payload) return json(400, { error: "Request body must be a JSON object" });
  const call = payload.call || {};
  if (!call.call_id) return json(400, { error: "Missing call identifier" });
  const timing = normalizeCallTiming(call);
  if (!timing) return json(400, { error: "Call timestamps are invalid" });
  const status =
    payload.event === "call_started"
      ? "in_progress"
      : payload.event === "call_ended" || payload.event === "call_analyzed"
        ? "completed"
        : call.call_status === "error"
          ? "failed"
          : "ringing";
  const analysis = call.call_analysis || {};
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  let accountId = call.metadata?.account_id;
  if (uuidPattern.test(accountId || "")) {
    const { data: configured, error: settingsError } = await supabase
      .from("receptionist_settings")
      .select("account_id")
      .eq("account_id", accountId)
      .eq("provider", "retell")
      .maybeSingle();
    if (settingsError) return json(500, { error: "Could not load receptionist settings" });
    if (!configured) accountId = null;
  }
  if (!accountId && call.to_number) {
    const { data: configured, error: settingsError } = await supabase
      .from("receptionist_settings")
      .select("account_id")
      .eq("provider", "retell")
      .eq("phone_number", call.to_number)
      .maybeSingle();
    if (settingsError) return json(500, { error: "Could not load receptionist settings" });
    accountId = configured?.account_id;
  }
  if (!uuidPattern.test(accountId || ""))
    return json(409, { error: "No Bontraco workspace is mapped to this call" });
  const row = {
    account_id: accountId,
    assigned_to: uuidPattern.test(call.metadata?.assigned_to || "")
      ? call.metadata.assigned_to
      : null,
    provider: "retell",
    provider_call_id: call.call_id,
    direction: call.direction === "outbound" ? "outbound" : "inbound",
    status,
    from_number: call.from_number || null,
    to_number: call.to_number || null,
    caller_name: call.retell_llm_dynamic_variables?.customer_name || null,
    emergency_flag: Boolean(analysis.custom_analysis_data?.emergency_flag),
    consent_recorded: Boolean(analysis.custom_analysis_data?.recording_consent),
    duration_seconds: timing.durationSeconds,
    disposition: analysis.custom_analysis_data?.disposition || call.disconnection_reason || null,
    summary: analysis.call_summary || null,
    transcript: call.transcript || null,
    recording_url: call.recording_url || null,
    started_at: timing.startedAt,
    ended_at: timing.endedAt,
  };
  const { data: savedCall, error } = await supabase
    .from("calls")
    .upsert(row, { onConflict: "provider,provider_call_id" })
    .select("id")
    .single();
  if (error) return json(500, { error: "Could not save call" });
  const billableSeconds = Number(
    call.call_cost?.total_duration_seconds ?? row.duration_seconds ?? 0,
  );
  if (payload.event === "call_analyzed" && Number.isFinite(billableSeconds)) {
    const { error: usageError } = await supabase.from("call_usage").upsert(
      {
        account_id: accountId,
        call_id: savedCall.id,
        provider: "retell",
        external_usage_id: call.call_id,
        billable_seconds: Math.max(0, Math.round(billableSeconds)),
        provider_cost_cents: Number.isFinite(Number(call.call_cost?.combined_cost))
          ? Math.max(0, Math.round(Number(call.call_cost.combined_cost)))
          : null,
        recorded_at: row.ended_at || new Date().toISOString(),
        metadata: { product_costs: call.call_cost?.product_costs || [] },
      },
      { onConflict: "provider,external_usage_id" },
    );
    if (usageError) return json(500, { error: "Could not record call usage" });
  }
  const eventId = `${call.call_id}:${payload.event}:${call.end_timestamp || call.start_timestamp || 0}`;
  const { error: eventError } = await supabase.from("call_events").upsert(
    {
      account_id: accountId,
      call_id: savedCall.id,
      provider_event_id: eventId,
      event_type: payload.event || "unknown",
      occurred_at: new Date().toISOString(),
      payload,
    },
    { onConflict: "provider_event_id" },
  );
  if (eventError) return json(500, { error: "Could not record call event" });
  return json(200, { received: true });
};
