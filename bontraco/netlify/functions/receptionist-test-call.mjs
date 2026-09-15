import { createClient } from "@supabase/supabase-js";
import Retell from "retell-sdk";
import { selectedWorkspaceId } from "./_shared/workspace-request.mjs";

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
const e164 = /^\+[1-9]\d{7,14}$/;

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const {
    RETELL_API_KEY,
    RETELL_AGENT_ID,
    RETELL_FROM_NUMBER,
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
  } = process.env;
  if (!token) return json(401, { error: "Sign in required" });
  const accountId = selectedWorkspaceId(request);
  if (!accountId) return json(400, { error: "Workspace selection is required" });
  if (!RETELL_API_KEY || !RETELL_AGENT_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
    return json(503, { error: "Retell test calls are not configured" });
  const body = await request.json().catch(() => ({}));
  if (!e164.test(body.to_number || ""))
    return json(400, { error: "Enter a phone number in +15551234567 format" });
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError) return json(503, { error: "Could not verify this request" });
  if (!authData.user) return json(401, { error: "Session is invalid" });
  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("account_id")
    .eq("user_id", authData.user.id)
    .eq("account_id", accountId)
    .eq("active", true)
    .in("role", ["owner", "admin"])
    .maybeSingle();
  if (membershipError) return json(503, { error: "Could not verify workspace access" });
  if (!membership) return json(403, { error: "Only owners and admins can place test calls" });
  const { data: isSuppressed, error: suppressionError } = await supabase.rpc(
    "is_communication_suppressed",
    {
      target_account_id: membership.account_id,
      target_channel: "voice",
      target_destination: body.to_number,
    },
  );
  if (suppressionError)
    return json(503, { error: "Do-not-contact safeguards are temporarily unavailable" });
  if (isSuppressed)
    return json(409, { error: "This number is marked do not call in this workspace" });
  const { data: settings, error: settingsError } = await supabase
    .from("receptionist_settings")
    .select("provider, phone_number")
    .eq("account_id", membership.account_id)
    .maybeSingle();
  if (settingsError) return json(503, { error: "Could not load receptionist settings" });
  if (settings?.provider !== "retell")
    return json(409, { error: "Select Retell AI in receptionist settings first" });
  const fromNumber = settings.phone_number || RETELL_FROM_NUMBER;
  if (!e164.test(fromNumber || ""))
    return json(503, { error: "A Retell phone number is required" });
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const { count, error: countError } = await supabase
    .from("calls")
    .select("id", { count: "exact", head: true })
    .eq("account_id", membership.account_id)
    .eq("provider", "retell")
    .eq("direction", "outbound")
    .gte("started_at", start.toISOString());
  if (countError) return json(503, { error: "Could not verify test-call limit" });
  if ((count || 0) >= 5) return json(429, { error: "Daily test-call limit reached" });
  const retell = new Retell({ apiKey: RETELL_API_KEY });
  let call;
  try {
    call = await retell.call.createPhoneCall({
      from_number: fromNumber,
      to_number: body.to_number,
      override_agent_id: RETELL_AGENT_ID,
      metadata: {
        account_id: membership.account_id,
        test_call: "true",
        requested_by: authData.user.id,
      },
      retell_llm_dynamic_variables: { customer_name: body.customer_name || "Bontraco test caller" },
    });
  } catch {
    return json(502, { error: "Test-call provider could not start the call" });
  }
  if (!call?.call_id) return json(502, { error: "Test-call provider could not start the call" });
  const { error: callError } = await supabase.from("calls").upsert(
    {
      account_id: membership.account_id,
      provider: "retell",
      provider_call_id: call.call_id,
      direction: "outbound",
      status: "ringing",
      from_number: fromNumber,
      to_number: body.to_number,
      caller_name: body.customer_name || "Bontraco test caller",
      disposition: "Test call",
      started_at: new Date().toISOString(),
    },
    { onConflict: "provider,provider_call_id" },
  );
  if (callError) return json(202, { call_id: call.call_id, status: "started", tracked: false });
  return json(200, { call_id: call.call_id, status: "started", tracked: true });
};
