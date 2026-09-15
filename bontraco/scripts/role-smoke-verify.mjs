/* global process, console, fetch */
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

export const roleExpectations = {
  owner: {
    contacts: 3,
    jobs: 3,
    appointments: 3,
    leads: 1,
    suppressions: 3,
    consents: 3,
    foreignIdsHidden: 8,
    integrationStatus: 200,
  },
  admin: {
    contacts: 3,
    jobs: 3,
    appointments: 3,
    leads: 1,
    suppressions: 3,
    consents: 3,
    foreignIdsHidden: 8,
    integrationStatus: 200,
  },
  dispatcher: {
    contacts: 3,
    jobs: 3,
    appointments: 3,
    leads: 1,
    suppressions: 3,
    consents: 3,
    foreignIdsHidden: 8,
    integrationStatus: 403,
  },
  sales: {
    contacts: 1,
    jobs: 1,
    appointments: 1,
    leads: 1,
    suppressions: 1,
    consents: 1,
    foreignIdsHidden: 8,
    integrationStatus: 403,
  },
  field: {
    contacts: 1,
    jobs: 1,
    appointments: 1,
    leads: 0,
    suppressions: 0,
    consents: 0,
    foreignIdsHidden: 8,
    integrationStatus: 403,
  },
};

function required(name, environment) {
  const value = environment[name];
  if (!value || value.length < 12) throw new Error(`${name} is missing or incomplete`);
  return value;
}

async function exactCount(client, table) {
  const { count, error } = await client.from(table).select("id", { count: "exact", head: true });
  if (error) throw new Error(`${table} visibility query failed`);
  return count ?? 0;
}

async function readForeignTargets({ runId, url, publishableKey }) {
  const client = createClient(url, publishableKey, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: `bontraco-${runId}-outsider@example.org`,
    password: `Bontraco-${runId}-Qa!4937`,
  });
  if (authError || !authData.user) throw new Error("outsider authentication failed");
  try {
    const { data: membership, error: membershipError } = await client
      .from("memberships")
      .select("account_id")
      .eq("user_id", authData.user.id)
      .single();
    if (membershipError || !membership) throw new Error("outsider workspace is unavailable");
    const targets = { accounts: membership.account_id };
    for (const table of [
      "contacts",
      "properties",
      "jobs",
      "appointments",
      "leads",
      "communication_suppressions",
      "communication_consents",
    ]) {
      const { data, error } = await client
        .from(table)
        .select("id")
        .eq("account_id", membership.account_id)
        .single();
      if (error || !data) throw new Error(`outsider ${table} fixture is unavailable`);
      targets[table] = data.id;
    }
    return targets;
  } finally {
    await client.auth.signOut();
  }
}

export async function verifyForeignTargetsHidden(client, foreignTargets, role) {
  let hidden = 0;
  for (const [table, id] of Object.entries(foreignTargets)) {
    const { data, error } = await client.from(table).select("id").eq("id", id).maybeSingle();
    if (error) throw new Error(`${role} direct foreign ${table} request failed unexpectedly`);
    if (data) throw new Error(`${role} accessed a foreign ${table} record by known id`);
    hidden += 1;
  }
  return hidden;
}

async function verifyRole({ role, runId, url, publishableKey, previewUrl, foreignTargets }) {
  const client = createClient(url, publishableKey, { auth: { persistSession: false } });
  const email = `bontraco-${runId}-${role}@example.org`;
  const password = `Bontraco-${runId}-Qa!4937`;
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (authError || !authData.user || !authData.session)
    throw new Error(`${role} authentication failed`);
  try {
    const { data: membership, error: membershipError } = await client
      .from("memberships")
      .select("account_id,role,active")
      .eq("user_id", authData.user.id)
      .single();
    if (membershipError || !membership || membership.role !== role || !membership.active)
      throw new Error(`${role} membership is incorrect`);

    const counts = {};
    const tableTargets = [
      ["contacts", "contacts"],
      ["jobs", "jobs"],
      ["appointments", "appointments"],
      ["leads", "leads"],
      ["communication_suppressions", "suppressions"],
      ["communication_consents", "consents"],
    ];
    for (const [table, resultKey] of tableTargets)
      counts[resultKey] = await exactCount(client, table);
    const expected = roleExpectations[role];
    for (const [table, count] of Object.entries(counts))
      if (count !== expected[table])
        throw new Error(`${role} can see ${count} ${table}; expected ${expected[table]}`);
    const foreignIdsHidden = await verifyForeignTargetsHidden(client, foreignTargets, role);
    if (foreignIdsHidden !== expected.foreignIdsHidden)
      throw new Error(
        `${role} hid ${foreignIdsHidden} direct foreign ids; expected ${expected.foreignIdsHidden}`,
      );

    let integrationStatus = null;
    if (previewUrl) {
      const response = await fetch(
        `${previewUrl.replace(/\/$/, "")}/.netlify/functions/integration-status`,
        {
          headers: {
            authorization: `Bearer ${authData.session.access_token}`,
            "x-bontraco-account-id": membership.account_id,
          },
        },
      );
      integrationStatus = response.status;
      if (integrationStatus !== expected.integrationStatus)
        throw new Error(
          `${role} integration-status returned ${integrationStatus}; expected ${expected.integrationStatus}`,
        );
    }
    return { role, accountId: membership.account_id, counts, foreignIdsHidden, integrationStatus };
  } finally {
    await client.auth.signOut();
  }
}

export async function verifyRoleSmoke(runId, environment = process.env) {
  if (!/^[a-z0-9]{6,24}$/.test(runId)) throw new Error("Provide a 6-24 character run id");
  const url = environment.VITE_SUPABASE_URL || environment.SUPABASE_URL;
  const publishableKey = required("VITE_SUPABASE_PUBLISHABLE_KEY", environment);
  if (!url?.startsWith("https://")) throw new Error("Supabase URL must use HTTPS");
  const previewUrl = environment.BONTRACO_PREVIEW_URL || "";
  if (previewUrl && !previewUrl.startsWith("https://"))
    throw new Error("BONTRACO_PREVIEW_URL must use HTTPS");

  const foreignTargets = await readForeignTargets({ runId, url, publishableKey });
  const results = [];
  for (const role of Object.keys(roleExpectations))
    results.push(
      await verifyRole({ role, runId, url, publishableKey, previewUrl, foreignTargets }),
    );
  const accountIds = new Set(results.map((result) => result.accountId));
  if (accountIds.size !== 1) throw new Error("Smoke users are not isolated in one workspace");
  return results.map((result) => ({
    role: result.role,
    counts: result.counts,
    foreignIdsHidden: result.foreignIdsHidden,
    integrationStatus: result.integrationStatus,
  }));
}

async function run() {
  const runId = String(process.argv[2] || "").toLowerCase();
  const results = await verifyRoleSmoke(runId);
  console.log(JSON.stringify({ passed: true, roles: results }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : "Role smoke verification failed");
    process.exitCode = 1;
  });
