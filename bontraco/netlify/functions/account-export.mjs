import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { accountDataTables } from "./_shared/account-data-tables.mjs";
import { selectedWorkspaceId } from "./_shared/workspace-request.mjs";

const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body, null, status === 200 ? 2 : 0), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...headers },
  });

const maximumExportBytes = 5_500_000;
export const safeInvitationColumns = "id,email,role,invited_by,expires_at,accepted_at,created_at";

export function safeExportFilename(slug, date = new Date()) {
  const safeSlug = String(slug || "workspace")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `bontraco-${safeSlug || "workspace"}-${date.toISOString().slice(0, 10)}.json`;
}

export async function readAccountTable(supabase, table, accountId, columns = "*") {
  const pageSize = 1000;
  const maximumRows = 50_000;
  const rows = [];
  while (rows.length < maximumRows) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .eq("account_id", accountId)
      .range(rows.length, rows.length + pageSize - 1);
    if (error) throw new Error(`Could not export ${table}`);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
    if (rows.length >= maximumRows)
      throw new Error(`Could not safely export more than ${maximumRows} ${table} rows`);
  }
  return rows;
}

export async function recordAccountExport(supabase, accountId, actorId, exportedAt, sha256) {
  const { error } = await supabase.from("activities").insert({
    account_id: accountId,
    actor_id: actorId,
    kind: "account_exported",
    summary: "Workspace data export downloaded",
    metadata: { exported_at: exportedAt.toISOString(), truncated_tables: [], sha256 },
  });
  if (error) throw new Error("Could not record account export");
}

export async function readWorkspaceUserIdentities(supabase, memberships) {
  const userIds = [...new Set(memberships.map((membership) => membership.user_id))];
  return Promise.all(
    userIds.map(async (userId) => {
      const { data, error } = await supabase.auth.admin.getUserById(userId);
      if (error || !data.user) throw new Error("Could not export workspace user identity");
      return {
        id: data.user.id,
        email: data.user.email || null,
        created_at: data.user.created_at,
        last_sign_in_at: data.user.last_sign_in_at || null,
        email_confirmed_at: data.user.email_confirmed_at || null,
      };
    }),
  );
}

export function serializeAccountExport(payload) {
  const serialized = JSON.stringify(payload, null, 2);
  if (new TextEncoder().encode(serialized).byteLength > maximumExportBytes)
    throw new Error("Account export exceeds the safe response size");
  return serialized;
}

export function accountExportSha256(serialized) {
  return createHash("sha256").update(serialized).digest("hex");
}

export default async (request) => {
  if (request.method !== "GET") return json(405, { error: "Method not allowed" });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "Sign in required" });
  const accountId = selectedWorkspaceId(request);
  if (!accountId) return json(400, { error: "Workspace selection is required" });
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
    return json(503, { error: "Export service is not configured" });
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: "Session is invalid" });
  const { data: membership } = await supabase
    .from("memberships")
    .select(
      "account_id, role, accounts!inner(id,name,legal_name,slug,trades,timezone,service_area,business_hours,emergency_rules,business_phone,business_email,business_website,proposal_accent_color,estimate_default_tax_rate,estimate_default_valid_days,estimate_default_customer_note,estimate_default_terms,created_at,updated_at)",
    )
    .eq("user_id", authData.user.id)
    .eq("account_id", accountId)
    .eq("active", true)
    .in("role", ["owner", "admin"])
    .maybeSingle();
  if (!membership) return json(403, { error: "Only owners and admins can export account data" });
  try {
    const [results, acceptanceResult, invitations] = await Promise.all([
      Promise.all(
        accountDataTables.map(async (table) => [
          table,
          await readAccountTable(supabase, table, membership.account_id),
        ]),
      ),
      supabase.rpc("export_bontraco_estimate_acceptances", {
        target_account_id: membership.account_id,
      }),
      readAccountTable(supabase, "invitations", membership.account_id, safeInvitationColumns),
    ]);
    if (acceptanceResult.error) throw new Error("Could not export estimate acceptances");
    const data = Object.fromEntries(results);
    data.estimate_acceptances = acceptanceResult.data || [];
    data.invitations = invitations;
    data.users = await readWorkspaceUserIdentities(supabase, data.memberships);
    const exportedAt = new Date();
    const payload = {
      export_version: 1,
      exported_at: exportedAt.toISOString(),
      account: membership.accounts,
      truncated_tables: [],
      data,
    };
    const serialized = serializeAccountExport(payload);
    const sha256 = accountExportSha256(serialized);
    await recordAccountExport(
      supabase,
      membership.account_id,
      authData.user.id,
      exportedAt,
      sha256,
    );
    return new Response(serialized, {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
        "content-disposition": `attachment; filename="${safeExportFilename(membership.accounts?.slug, exportedAt)}"`,
        "x-bontraco-sha256": sha256,
      },
    });
  } catch {
    return json(500, { error: "Workspace export failed" });
  }
};
