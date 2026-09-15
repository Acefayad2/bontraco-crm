import { createClient } from "@supabase/supabase-js";
import Retell from "retell-sdk";
import { parseJsonObject } from "./_shared/json-payload.mjs";

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const e164 = /^\+[1-9]\d{7,14}$/;

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
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  let query = supabase
    .from("receptionist_settings")
    .select("transfer_number,emergency_instructions")
    .eq("provider", "retell")
    .eq("enabled", true);
  query = uuidPattern.test(call.metadata?.account_id || "")
    ? query.eq("account_id", call.metadata.account_id)
    : query.eq("phone_number", call.to_number || "");
  const { data: settings, error } = await query.maybeSingle();
  if (error) return json(500, { error: "Could not load receptionist settings" });
  const transferNumber = settings?.transfer_number?.replace(/[\s()-]/g, "");
  if (!e164.test(transferNumber || ""))
    return json(409, {
      available: false,
      message:
        "A human transfer number is not configured. Take a voicemail and mark the call urgent.",
    });
  return json(200, {
    available: true,
    transfer_number: transferNumber,
    emergency_instructions: settings.emergency_instructions,
  });
};
