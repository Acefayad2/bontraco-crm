import { createClient } from "@supabase/supabase-js";

const jsonHeaders = { "content-type": "application/json", "cache-control": "no-store" };

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function safeError(error) {
  return (error instanceof Error ? error.message : "Unknown monitor error")
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, 800);
}

export function buildDeliveryPayload(incidents, environment = "production") {
  const counts = {};
  const severities = {};
  for (const incident of incidents) {
    counts[incident.kind] = (counts[incident.kind] || 0) + 1;
    severities[incident.severity] = (severities[incident.severity] || 0) + 1;
  }
  return {
    event: "bontraco_operations_alert",
    environment,
    incident_count: incidents.length,
    counts,
    severities,
    oldest_detected_at: incidents[0]?.detected_at || null,
  };
}

export function incidentCandidates({
  leadRuns = [],
  billingEvents = [],
  urgentCalls = [],
  deletionRequests = [],
}) {
  return [
    ...leadRuns.map((row) => ({
      fingerprint: `lead_scan:${row.id}`,
      kind: "lead_scan_failed",
      severity: "warning",
      source_record_id: row.id,
      payload: { account_id: row.account_id },
      detected_at: row.started_at,
    })),
    ...billingEvents.map((row) => ({
      fingerprint: `billing_webhook:${row.stripe_event_id}`,
      kind: "billing_webhook_failed",
      severity: "critical",
      source_record_id: row.stripe_event_id,
      payload: { event_type: row.event_type },
      detected_at: row.updated_at,
    })),
    ...urgentCalls.map((row) => ({
      fingerprint: `urgent_call:${row.id}`,
      kind: "urgent_call",
      severity: "critical",
      source_record_id: row.id,
      payload: { account_id: row.account_id },
      detected_at: row.created_at,
    })),
    ...deletionRequests.map((row) => ({
      fingerprint: `account_purge:${row.id}`,
      kind: "account_purge_failed",
      severity: "critical",
      source_record_id: row.id,
      payload: {},
      detected_at: row.updated_at,
    })),
  ];
}

export default async () => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPERATIONS_ALERT_WEBHOOK_URL } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
    return json(503, { error: "Supabase service configuration is missing" });
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const since = new Date(Date.now() - 20 * 60_000).toISOString();
  const [leadResult, billingResult, callResult, deletionResult] = await Promise.all([
    supabase
      .from("lead_scan_runs")
      .select("id,account_id,started_at")
      .eq("status", "failed")
      .gte("started_at", since)
      .limit(100),
    supabase
      .from("billing_webhook_events")
      .select("stripe_event_id,event_type,updated_at")
      .eq("processing_status", "failed")
      .gte("updated_at", since)
      .limit(100),
    supabase
      .from("calls")
      .select("id,account_id,created_at")
      .eq("emergency_flag", true)
      .gte("created_at", since)
      .limit(100),
    supabase
      .from("account_deletion_requests")
      .select("id,updated_at")
      .eq("status", "failed")
      .gte("updated_at", since)
      .limit(100),
  ]);
  const queryError =
    leadResult.error || billingResult.error || callResult.error || deletionResult.error;
  if (queryError) return json(500, { error: "Operations source query failed" });

  const candidates = incidentCandidates({
    leadRuns: leadResult.data,
    billingEvents: billingResult.data,
    urgentCalls: callResult.data,
    deletionRequests: deletionResult.data,
  });
  if (candidates.length) {
    const { error } = await supabase
      .from("operational_incidents")
      .upsert(candidates, { onConflict: "fingerprint", ignoreDuplicates: true });
    if (error) return json(500, { error: "Operations incident recording failed" });
  }

  const { data: pending, error: pendingError } = await supabase
    .from("operational_incidents")
    .select("id,kind,severity,detected_at,attempts")
    .is("delivered_at", null)
    .lt("attempts", 10)
    .order("detected_at")
    .limit(20);
  if (pendingError) return json(500, { error: "Operations delivery queue failed" });
  if (!pending?.length)
    return json(200, { discovered: candidates.length, pending: 0, delivered: 0 });
  if (!OPERATIONS_ALERT_WEBHOOK_URL)
    return json(200, {
      discovered: candidates.length,
      pending: pending.length,
      delivered: 0,
      delivery_configured: false,
    });

  let webhookUrl;
  try {
    webhookUrl = new URL(OPERATIONS_ALERT_WEBHOOK_URL);
  } catch {
    return json(500, { error: "Operations webhook URL is invalid" });
  }
  if (webhookUrl.protocol !== "https:")
    return json(500, { error: "Operations webhook must use HTTPS" });

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      signal: AbortSignal.timeout(8000),
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildDeliveryPayload(pending, process.env.CONTEXT || "production")),
    });
    if (!response.ok) throw new Error(`Operations webhook returned ${response.status}`);
    const deliveredAt = new Date().toISOString();
    const { error } = await supabase
      .from("operational_incidents")
      .update({ delivered_at: deliveredAt, last_error: null })
      .in(
        "id",
        pending.map((incident) => incident.id),
      );
    if (error) throw new Error("Could not mark incidents delivered");
    return json(200, {
      discovered: candidates.length,
      pending: pending.length,
      delivered: pending.length,
    });
  } catch (error) {
    const message = safeError(error);
    await Promise.all(
      pending.map((incident) =>
        supabase
          .from("operational_incidents")
          .update({ attempts: Math.min(10, incident.attempts + 1), last_error: message })
          .eq("id", incident.id),
      ),
    );
    return json(502, { error: "Operations alert delivery failed", pending: pending.length });
  }
};

export const config = { schedule: "*/5 * * * *" };
