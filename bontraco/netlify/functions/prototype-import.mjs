import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { selectedWorkspaceId } from "./_shared/workspace-request.mjs";

const MAX_BODY_BYTES = 2_000_000;
const MAX_SOURCE_ROWS = 2_000;
const MAX_TARGET_JOBS = 5_000;
const tradeLabels = {
  roof: "Roofing",
  flat: "Flat roof",
  siding: "Siding",
  gutters: "Gutters",
  windows: "Windows",
  other: "General",
};

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const text = (value, maximum = 500) =>
  typeof value === "string" ? value.trim().slice(0, maximum) : "";

const nullableText = (value, maximum) => text(value, maximum) || null;

export function publicPrototypeImportError(action = "commit") {
  return action === "rollback"
    ? "Import rollback could not be completed safely"
    : "Import could not be completed safely";
}

const finiteMoney = (value) => {
  const number = Number(String(value ?? "").replace(/[$,]/g, ""));
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : null;
};

const safeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
};

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

function normalizeTrade(sourceTrade) {
  if (sourceTrade === "roof" || sourceTrade === "flat") return "roofing";
  return "general";
}

function clientName(client) {
  return (
    text(client.companyName || client.company, 120) ||
    [text(client.firstName || client.first_name, 80), text(client.lastName || client.last_name, 80)]
      .filter(Boolean)
      .join(" ") ||
    "Imported customer"
  );
}

export function normalizePrototypePayload(input) {
  const payload = input?.data && typeof input.data === "object" ? input.data : input;
  const sourceClients = Array.isArray(payload?.clients) ? payload.clients : [];
  const sourceJobs = Array.isArray(payload?.jobs) ? payload.jobs : [];
  const errors = [];
  const warnings = [];
  if (sourceClients.length > MAX_SOURCE_ROWS)
    errors.push(`The file contains more than ${MAX_SOURCE_ROWS} clients.`);
  if (sourceJobs.length > MAX_SOURCE_ROWS)
    errors.push(`The file contains more than ${MAX_SOURCE_ROWS} jobs.`);

  const clients = [];
  const clientIds = new Set();
  for (const [index, raw] of sourceClients.slice(0, MAX_SOURCE_ROWS).entries()) {
    if (!raw || typeof raw !== "object") {
      errors.push(`Client ${index + 1} is not an object.`);
      continue;
    }
    const sourceId = text(raw.id, 200);
    if (!sourceId) {
      errors.push(`Client ${index + 1} is missing an id.`);
      continue;
    }
    if (clientIds.has(sourceId)) {
      errors.push(`Client id ${sourceId} is duplicated.`);
      continue;
    }
    clientIds.add(sourceId);
    const firstName = text(raw.firstName || raw.first_name, 80);
    const lastName = nullableText(raw.lastName || raw.last_name, 80);
    const companyName = nullableText(raw.companyName || raw.company, 120);
    clients.push({
      sourceId,
      firstName: firstName || companyName || "Imported",
      lastName,
      companyName,
      phone: nullableText(raw.phone, 40),
      email: nullableText(raw.email, 254),
      address: nullableText(raw.address || raw.address_line_1, 200),
      city: nullableText(raw.city, 100),
      region: text(raw.state || raw.region, 30) || "IL",
      postalCode: nullableText(raw.zip || raw.postal_code, 20),
      name: clientName(raw),
    });
    if (raw.repId || raw.pmId)
      warnings.push(`Assignments for client ${sourceId} require manual remapping.`);
  }

  const jobs = [];
  const jobIds = new Set();
  for (const [index, raw] of sourceJobs.slice(0, MAX_SOURCE_ROWS).entries()) {
    if (!raw || typeof raw !== "object") {
      errors.push(`Job ${index + 1} is not an object.`);
      continue;
    }
    const baseId = text(raw.id, 160);
    const clientId = text(raw.clientId || raw.client_id, 200);
    if (!baseId || !clientId) {
      errors.push(`Job ${index + 1} is missing an id or clientId.`);
      continue;
    }
    if (!clientIds.has(clientId)) {
      errors.push(`Job ${baseId} references missing client ${clientId}.`);
      continue;
    }
    const tradeEntries = Object.entries(raw.trades || {});
    if (tradeEntries.length === 0) tradeEntries.push(["other", {}]);
    for (const [sourceTrade, details] of tradeEntries) {
      const sourceId = `${baseId}:${text(sourceTrade, 30) || "other"}`;
      if (jobIds.has(sourceId)) {
        errors.push(`Job id ${sourceId} is duplicated.`);
        continue;
      }
      jobIds.add(sourceId);
      const stage = text(details?.currentStage || raw.stage, 120) || "New";
      const client = clients.find((entry) => entry.sourceId === clientId);
      const financials = raw.financials || {};
      jobs.push({
        sourceId,
        clientId,
        title:
          text(raw.title, 200) ||
          `${client?.name || "Imported customer"} — ${tradeLabels[sourceTrade] || "General"}`,
        trade: normalizeTrade(sourceTrade),
        stage,
        status: /paid in full|work completed|complete$/i.test(stage) ? "completed" : "open",
        estimatedValue: finiteMoney(
          financials.contractAmount ?? financials.total ?? financials.rcv ?? raw.estimatedValue,
        ),
        scheduledStart: safeDate(raw.scheduledStart || raw.workDate || raw.scheduledDate),
      });
    }
    if (raw.repId || raw.pmId)
      warnings.push(`Assignments for job ${baseId} require manual remapping.`);
  }
  if (jobs.length > MAX_TARGET_JOBS)
    errors.push(`The file expands to more than ${MAX_TARGET_JOBS} Bontraco jobs.`);
  if (clients.length === 0 && jobs.length === 0) errors.push("The file has no clients or jobs.");

  const uniqueWarnings = [...new Set(warnings)].slice(0, 250);
  return {
    clients,
    jobs: jobs.slice(0, MAX_TARGET_JOBS),
    errors: [...new Set(errors)].slice(0, 250),
    warnings: uniqueWarnings,
    sourceCounts: { clients: sourceClients.length, jobs: sourceJobs.length },
    targetCounts: {
      contacts: clients.length,
      properties: clients.filter((client) => client.address && client.city).length,
      jobs: Math.min(jobs.length, MAX_TARGET_JOBS),
    },
  };
}

async function authenticate(request, supabase, accountId) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: membership } = await supabase
    .from("memberships")
    .select("account_id, role, accounts!inner(slug)")
    .eq("user_id", data.user.id)
    .eq("account_id", accountId)
    .eq("active", true)
    .in("role", ["owner", "admin"])
    .maybeSingle();
  return membership ? { user: data.user, membership } : null;
}

async function atomicRollback(supabase, actor, batchId, finalStatus) {
  const { data, error } = await supabase.rpc("rollback_bontraco_import", {
    target_account_id: actor.membership.account_id,
    target_batch_id: batchId,
    target_actor_id: actor.user.id,
    final_status: finalStatus,
  });
  if (error) throw new Error("Import rollback could not be completed safely");
  return data;
}

async function recordTarget(supabase, row) {
  const { error } = await supabase.from("data_import_records").insert(row);
  if (error) throw new Error("Could not write the import rollback manifest");
}

async function runImport(supabase, actor, normalized, digest) {
  const accountId = actor.membership.account_id;
  const { data: existing } = await supabase
    .from("data_import_batches")
    .select("id, imported_counts, completed_at")
    .eq("account_id", accountId)
    .eq("source_digest", digest)
    .eq("status", "completed")
    .maybeSingle();
  if (existing) return { duplicate: true, batch: existing };

  const { data: batch, error: batchError } = await supabase
    .from("data_import_batches")
    .insert({
      account_id: accountId,
      requested_by: actor.user.id,
      source_digest: digest,
      source_counts: normalized.sourceCounts,
      warnings: normalized.warnings,
    })
    .select("id")
    .single();
  if (batchError) throw new Error("Could not start the import");

  const contactMap = new Map();
  const propertyMap = new Map();
  try {
    for (const client of normalized.clients) {
      const { data: contact, error } = await supabase
        .from("contacts")
        .insert({
          account_id: accountId,
          first_name: client.firstName,
          last_name: client.lastName,
          company_name: client.companyName,
          email: client.email,
          phone: client.phone,
          source: "abundant_crm_import",
          created_by: actor.user.id,
        })
        .select("id")
        .single();
      if (error) throw new Error(`Could not import client ${client.sourceId}`);
      contactMap.set(client.sourceId, contact.id);
      await recordTarget(supabase, {
        account_id: accountId,
        batch_id: batch.id,
        source_type: "client",
        source_id: client.sourceId,
        target_table: "contacts",
        target_id: contact.id,
      });
      if (client.address && client.city) {
        const { data: property, error: propertyError } = await supabase
          .from("properties")
          .insert({
            account_id: accountId,
            contact_id: contact.id,
            label: "Imported service location",
            address_line_1: client.address,
            city: client.city,
            region: client.region,
            postal_code: client.postalCode,
          })
          .select("id")
          .single();
        if (propertyError)
          throw new Error(`Could not import address for client ${client.sourceId}`);
        propertyMap.set(client.sourceId, property.id);
        await recordTarget(supabase, {
          account_id: accountId,
          batch_id: batch.id,
          source_type: "client",
          source_id: client.sourceId,
          target_table: "properties",
          target_id: property.id,
        });
      }
    }

    for (const job of normalized.jobs) {
      const { data: target, error } = await supabase
        .from("jobs")
        .insert({
          account_id: accountId,
          contact_id: contactMap.get(job.clientId),
          property_id: propertyMap.get(job.clientId) || null,
          title: job.title,
          trade: job.trade,
          stage: job.stage,
          status: job.status,
          estimated_value: job.estimatedValue,
          scheduled_start: job.scheduledStart,
          created_by: actor.user.id,
        })
        .select("id")
        .single();
      if (error) throw new Error(`Could not import job ${job.sourceId}`);
      await recordTarget(supabase, {
        account_id: accountId,
        batch_id: batch.id,
        source_type: "job",
        source_id: job.sourceId,
        target_table: "jobs",
        target_id: target.id,
      });
    }
    const completedAt = new Date().toISOString();
    const { error: completeError } = await supabase
      .from("data_import_batches")
      .update({
        status: "completed",
        imported_counts: normalized.targetCounts,
        completed_at: completedAt,
      })
      .eq("account_id", accountId)
      .eq("id", batch.id);
    if (completeError) throw new Error("Could not finalize the import report");
    await supabase.from("activities").insert({
      account_id: accountId,
      actor_id: actor.user.id,
      kind: "prototype_import_completed",
      summary: "Prototype CRM data imported",
      metadata: { batch_id: batch.id, counts: normalized.targetCounts },
    });
    return {
      duplicate: false,
      batch: { id: batch.id, imported_counts: normalized.targetCounts, completed_at: completedAt },
    };
  } catch (error) {
    await supabase
      .from("data_import_batches")
      .update({
        status: "failed",
        failure_message: publicPrototypeImportError(),
      })
      .eq("account_id", accountId)
      .eq("id", batch.id);
    await atomicRollback(supabase, actor, batch.id, "failed").catch(() => undefined);
    throw error;
  }
}

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "Sign in required" });
  const accountId = selectedWorkspaceId(request);
  if (!accountId) return json(400, { error: "Workspace selection is required" });
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) return json(413, { error: "Import file is too large" });
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
    return json(503, { error: "Import service is not configured" });
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const actor = await authenticate(request, supabase, accountId);
  if (!actor) return json(403, { error: "Only owners and admins can import data" });

  let body;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES)
      return json(413, { error: "Import file is too large" });
    body = JSON.parse(raw || "{}");
  } catch {
    return json(400, { error: "Import body must be valid JSON" });
  }

  if (body.mode === "rollback") {
    const batchId = text(body.batch_id, 100);
    if (!/^[0-9a-f-]{36}$/.test(batchId) || body.confirmation !== batchId)
      return json(400, { error: "Confirm rollback with the exact batch id" });
    const { data: batch } = await supabase
      .from("data_import_batches")
      .select("id, status")
      .eq("account_id", actor.membership.account_id)
      .eq("id", batchId)
      .eq("status", "completed")
      .maybeSingle();
    if (!batch) return json(404, { error: "Completed import batch not found" });
    try {
      const removed = await atomicRollback(supabase, actor, batch.id, "rolled_back");
      return json(200, { rolled_back: true, batch_id: batch.id, removed });
    } catch {
      return json(500, { error: publicPrototypeImportError("rollback") });
    }
  }

  const normalized = normalizePrototypePayload(body.data);
  const report = {
    source_counts: normalized.sourceCounts,
    target_counts: normalized.targetCounts,
    warnings: normalized.warnings,
    errors: normalized.errors,
  };
  if (body.mode === "dry_run") return json(200, { valid: normalized.errors.length === 0, report });
  if (body.mode !== "commit")
    return json(400, { error: "Mode must be dry_run, commit, or rollback" });
  if (normalized.errors.length > 0) return json(422, { error: "Import validation failed", report });
  const digest = createHash("sha256")
    .update(stableStringify({ clients: normalized.clients, jobs: normalized.jobs }))
    .digest("hex");
  try {
    const result = await runImport(supabase, actor, normalized, digest);
    return json(200, {
      imported: !result.duplicate,
      duplicate: result.duplicate,
      batch: result.batch,
      report,
    });
  } catch {
    return json(500, { error: publicPrototypeImportError(), report });
  }
};
