import { createClient } from "@supabase/supabase-js";
import Retell from "retell-sdk";
import { parseJsonObject } from "./_shared/json-payload.mjs";

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export function buildTradeIntakeGuidance(trades = []) {
  const rules = {
    roofing: {
      required_questions: [
        "Is water actively entering the building?",
        "Was the damage caused by a recent storm or falling object?",
        "What type of building and roof is affected?",
      ],
      urgent_signals: [
        "active interior leak",
        "collapsed roof",
        "tree impact",
        "electrical contact",
      ],
    },
    plumbing: {
      required_questions: [
        "Is water flowing now, and can the main shutoff be reached safely?",
        "Is sewage backing up or is there no usable toilet?",
        "Which fixture, pipe, or appliance is affected?",
      ],
      urgent_signals: ["uncontrolled leak", "sewage backup", "burst pipe", "gas smell"],
    },
    electrical: {
      required_questions: [
        "Is there smoke, fire, sparking, or a burning smell?",
        "Is anyone shocked or in contact with energized equipment?",
        "Is the outage limited to one circuit or the entire property?",
      ],
      urgent_signals: [
        "fire",
        "smoke",
        "sparking",
        "burning smell",
        "electric shock",
        "downed line",
      ],
    },
    general: {
      required_questions: [
        "What is happening now?",
        "Is anyone in immediate danger?",
        "What is the service address and best callback number?",
      ],
      urgent_signals: ["immediate danger", "fire", "medical emergency"],
    },
  };
  const selected = (trades.length ? trades : ["general"])
    .filter((trade) => rules[trade])
    .map((trade) => ({ trade, ...rules[trade] }));
  return {
    rules: selected.length ? selected : [{ trade: "general", ...rules.general }],
    universal_actions: [
      "Never claim to be a licensed technician or diagnose beyond the caller's facts.",
      "For immediate danger, fire, gas odor, electrical contact, or medical risk, instruct the caller to hang up and call 911 or the appropriate utility emergency line.",
      "Do not book an ordinary appointment as a substitute for emergency services.",
      "Confirm the caller's name, callback number, service address, and permission before booking.",
    ],
  };
}

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
  const call = payload.call || payload;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  let settingsQuery = supabase
    .from("receptionist_settings")
    .select("account_id, emergency_instructions, accounts!inner(trades)")
    .eq("provider", "retell")
    .eq("enabled", true);
  if (call.metadata?.account_id)
    settingsQuery = settingsQuery.eq("account_id", call.metadata.account_id);
  else if (call.to_number) settingsQuery = settingsQuery.eq("phone_number", call.to_number);
  else return json(400, { error: "Missing workspace mapping" });
  const { data: settings, error } = await settingsQuery.maybeSingle();
  if (error) return json(500, { error: "Could not load receptionist settings" });
  if (!settings) return json(409, { error: "No enabled workspace is mapped to this call" });
  return json(200, {
    ...buildTradeIntakeGuidance(settings.accounts?.trades || []),
    emergency_instructions: settings.emergency_instructions,
  });
};
