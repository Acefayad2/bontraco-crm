import { createClient } from "@supabase/supabase-js";
import Retell from "retell-sdk";
import { parseJsonObject } from "./_shared/json-payload.mjs";
import { isoFromMilliseconds } from "./_shared/retell-timing.mjs";

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function publicBookingError(error) {
  const message = error instanceof Error ? error.message : String(error?.message || "");
  if (message.includes("outside the allowed booking window"))
    return "Appointment time is outside the allowed booking window";
  if (message.includes("Appointment duration is invalid")) return "Appointment duration is invalid";
  if (message.includes("Appointment title is invalid")) return "Appointment title is invalid";
  if (message.includes("Customer phone is invalid")) return "Customer phone is invalid";
  if (message.includes("Verified call not found"))
    return "This call is no longer available for booking";
  return "Appointment could not be booked";
}

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  const { RETELL_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!RETELL_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
    return json(503, { error: "Receptionist is not configured" });
  const rawBody = await request.text();
  if (!Retell.verify(rawBody, RETELL_API_KEY, request.headers.get("x-retell-signature") || ""))
    return json(401, { error: "Invalid signature" });
  const payload = parseJsonObject(rawBody);
  if (!payload) return json(400, { error: "Request body must be a JSON object" });
  const call = payload.call || {};
  const args = payload.args || {};
  if (!call.call_id) return json(400, { error: "Missing call identifier" });
  const sourceStartedAt = isoFromMilliseconds(call.start_timestamp);
  if (sourceStartedAt === undefined) return json(400, { error: "Call timestamps are invalid" });
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  let settings = null;
  if (uuidPattern.test(call.metadata?.account_id || "")) {
    const result = await supabase
      .from("receptionist_settings")
      .select("account_id,appointment_duration_minutes")
      .eq("account_id", call.metadata.account_id)
      .eq("provider", "retell")
      .eq("enabled", true)
      .maybeSingle();
    if (result.error) return json(500, { error: "Could not load receptionist settings" });
    settings = result.data;
  }
  if (!settings && call.to_number) {
    const result = await supabase
      .from("receptionist_settings")
      .select("account_id,appointment_duration_minutes")
      .eq("phone_number", call.to_number)
      .eq("provider", "retell")
      .eq("enabled", true)
      .maybeSingle();
    if (result.error) return json(500, { error: "Could not load receptionist settings" });
    settings = result.data;
  }
  if (!settings) return json(409, { error: "This workspace receptionist is not enabled" });
  const startsAt = new Date(args.start_time);
  if (Number.isNaN(startsAt.getTime()))
    return json(400, { error: "A valid start_time is required" });
  const endsAt = new Date(startsAt.getTime() + settings.appointment_duration_minutes * 60000);
  const phone = String(args.customer_phone || call.from_number || "").trim();
  const { error: callError } = await supabase.from("calls").upsert(
    {
      account_id: settings.account_id,
      provider: "retell",
      provider_call_id: call.call_id,
      direction: call.direction === "outbound" ? "outbound" : "inbound",
      status: "in_progress",
      from_number: call.from_number || null,
      to_number: call.to_number || null,
      caller_name: args.customer_name || call.retell_llm_dynamic_variables?.customer_name || null,
      started_at: sourceStartedAt || new Date().toISOString(),
    },
    { onConflict: "provider,provider_call_id" },
  );
  if (callError) return json(500, { error: "Could not prepare the call record" });
  const { data: appointmentId, error } = await supabase.rpc("book_receptionist_appointment", {
    target_account_id: settings.account_id,
    target_provider_call_id: call.call_id,
    customer_name: String(args.customer_name || "Caller"),
    customer_phone: phone,
    appointment_title: String(args.title || "Contractor service appointment"),
    appointment_starts_at: startsAt.toISOString(),
    appointment_ends_at: endsAt.toISOString(),
    appointment_notes: args.notes ? String(args.notes) : null,
  });
  if (error) return json(409, { error: publicBookingError(error) });
  return json(200, {
    success: true,
    appointment_id: appointmentId,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
  });
};
