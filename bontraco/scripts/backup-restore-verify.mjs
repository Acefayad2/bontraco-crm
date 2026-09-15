/* global process, console */
import { pathToFileURL, URL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { accountDataTables } from "../netlify/functions/_shared/account-data-tables.mjs";

export const backupTables = [
  "accounts",
  "invitations",
  ...accountDataTables,
  "billing_webhook_events",
  "operational_incidents",
];

function required(environment, name, minimum = 24) {
  const value = environment[name];
  if (typeof value !== "string" || value.trim().length < minimum)
    throw new Error(`${name} is missing or incomplete`);
  return value.trim();
}

function projectUrl(environment, name) {
  const value = required(environment, name, 12);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} is not a valid URL`);
  }
  if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co"))
    throw new Error(`${name} must be an HTTPS Supabase project URL`);
  return url.origin;
}

export function compareRestoreCounts(source, restore) {
  const differences = [];
  for (const key of [...backupTables, "auth.users"]) {
    const sourceCount = source[key];
    const restoreCount = restore[key];
    if (!Number.isSafeInteger(sourceCount) || !Number.isSafeInteger(restoreCount))
      differences.push({ key, source: sourceCount ?? null, restore: restoreCount ?? null });
    else if (sourceCount !== restoreCount)
      differences.push({ key, source: sourceCount, restore: restoreCount });
  }
  return {
    matches: differences.length === 0,
    checked: backupTables.length + 1,
    differences,
  };
}

async function countAuthUsers(client) {
  let total = 0;
  const perPage = 200;
  for (let page = 1; page <= 500; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error("Could not count authentication users");
    total += data.users.length;
    if (data.users.length < perPage) return total;
  }
  throw new Error("Authentication user count exceeded the verifier safety limit");
}

async function captureCounts(client) {
  const counts = {};
  for (const table of backupTables) {
    const { count, error } = await client.from(table).select("*", { count: "exact", head: true });
    if (error) throw new Error(`Could not count ${table}`);
    counts[table] = count ?? 0;
  }
  counts["auth.users"] = await countAuthUsers(client);
  return counts;
}

export async function verifyBackupRestore(environment = process.env) {
  const sourceUrl = projectUrl(environment, "SOURCE_SUPABASE_URL");
  const restoreUrl = projectUrl(environment, "RESTORE_SUPABASE_URL");
  if (sourceUrl === restoreUrl) throw new Error("Source and restore Supabase projects must differ");
  const source = createClient(
    sourceUrl,
    required(environment, "SOURCE_SUPABASE_SERVICE_ROLE_KEY", 32),
    { auth: { persistSession: false } },
  );
  const restore = createClient(
    restoreUrl,
    required(environment, "RESTORE_SUPABASE_SERVICE_ROLE_KEY", 32),
    { auth: { persistSession: false } },
  );
  const [sourceCounts, restoreCounts] = await Promise.all([
    captureCounts(source),
    captureCounts(restore),
  ]);
  return compareRestoreCounts(sourceCounts, restoreCounts);
}

async function run() {
  const result = await verifyBackupRestore();
  console.log(JSON.stringify(result, null, 2));
  if (!result.matches) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : "Backup verification failed");
    process.exitCode = 1;
  });
