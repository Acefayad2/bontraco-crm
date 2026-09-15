import { createClient } from "@supabase/supabase-js";
import Retell from "retell-sdk";
import Stripe from "stripe";

const MAX_CALLS_PER_PURGE = 200;
const MAX_FILES_PER_PURGE = 1000;
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

export function purgeApprovalProblems(request, now = new Date()) {
  const metadata = request?.metadata || {};
  const problems = [];
  if (request?.status !== "approved") problems.push("request_not_approved");
  const dueAt = new Date(request?.scheduled_for || "");
  if (!Number.isFinite(dueAt.getTime()) || dueAt > now) problems.push("grace_period_not_finished");
  if (metadata.export_verified !== true) problems.push("export_not_verified");
  if (!SHA256_PATTERN.test(metadata.export_sha256 || "")) problems.push("export_checksum_invalid");
  if (metadata.provider_cleanup_authorized !== true)
    problems.push("provider_cleanup_not_authorized");
  if (typeof metadata.approval_ticket !== "string" || metadata.approval_ticket.trim().length < 6)
    problems.push("approval_ticket_missing");
  if (typeof metadata.approved_by !== "string" || metadata.approved_by.trim().length < 3)
    problems.push("approver_missing");
  const approvedAt = new Date(metadata.approved_at || "");
  if (
    !Number.isFinite(approvedAt.getTime()) ||
    approvedAt > now ||
    (Number.isFinite(dueAt.getTime()) && approvedAt < dueAt)
  )
    problems.push("approval_timestamp_invalid");
  return problems;
}

export function chunkValues(values, size = 100) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size)
    chunks.push(values.slice(index, index + size));
  return chunks;
}

export async function recoverStalePurges(supabase, now = new Date()) {
  const staleBefore = new Date(now.getTime() - 60 * 60_000).toISOString();
  const { data, error } = await supabase
    .from("account_deletion_requests")
    .update({
      status: "failed",
      last_error: "Purge worker did not complete; operator review required",
    })
    .eq("status", "processing")
    .lt("updated_at", staleBefore)
    .select("id");
  if (error) throw new Error("Could not recover stale purge claims");
  return data?.length || 0;
}

export function purgeFailureMessage(error) {
  const message = error instanceof Error ? error.message : "";
  if (message === "Private file export is required but not verified")
    return "Private file export is not verified; operator review required";
  if (message.includes("cleanup is required but"))
    return "Required provider cleanup is not configured; operator review required";
  if (message.includes(`more than ${MAX_CALLS_PER_PURGE} Retell calls`))
    return "Workspace exceeds the automated call cleanup limit; manual purge required";
  if (message.includes(`more than ${MAX_FILES_PER_PURGE} files`))
    return "Workspace exceeds the automated file cleanup limit; manual purge required";
  return "Account purge could not be completed; operator review required";
}

export function privateFilesExportVerified(files, metadata) {
  return (
    files.length === 0 ||
    (metadata?.file_export_verified === true &&
      metadata.file_export_count === files.length &&
      SHA256_PATTERN.test(metadata.file_export_manifest_sha256 || ""))
  );
}

function isMissingProviderRecord(error) {
  return (
    error?.status === 404 ||
    error?.statusCode === 404 ||
    error?.code === "resource_missing" ||
    error?.raw?.code === "resource_missing"
  );
}

async function cleanupStripe(subscription, secretKey) {
  const hasRemoteBilling = Boolean(
    subscription?.stripe_customer_id || subscription?.stripe_subscription_id,
  );
  if (!hasRemoteBilling) return;
  if (!secretKey) throw new Error("Stripe cleanup is required but STRIPE_SECRET_KEY is missing");
  const stripe = new Stripe(secretKey);
  if (subscription.stripe_subscription_id && subscription.status !== "canceled") {
    try {
      await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
    } catch (error) {
      if (!isMissingProviderRecord(error)) throw error;
    }
  }
  if (subscription.stripe_customer_id) {
    try {
      await stripe.customers.del(subscription.stripe_customer_id);
    } catch (error) {
      if (!isMissingProviderRecord(error)) throw error;
    }
  }
}

async function cleanupRetell(calls, apiKey) {
  if (!calls.length) return;
  if (!apiKey) throw new Error("Retell cleanup is required but RETELL_API_KEY is missing");
  const retell = new Retell({ apiKey });
  for (const call of calls) {
    try {
      await retell.call.delete(call.provider_call_id);
    } catch (error) {
      if (!isMissingProviderRecord(error)) throw error;
    }
  }
}

async function cleanupStorage(supabase, files) {
  for (const paths of chunkValues(files.map((file) => file.storage_path))) {
    const { error } = await supabase.storage.from("bontraco-files").remove(paths);
    if (error) throw error;
  }
}

export async function recordPurgeFailure(supabase, requestId, message) {
  const { data, error } = await supabase
    .from("account_deletion_requests")
    .update({ status: "failed", last_error: message })
    .eq("id", requestId)
    .eq("status", "processing")
    .select("id")
    .maybeSingle();
  if (error || !data) throw new Error("Could not record account purge failure");
}

export async function recordPurgeCompletion(supabase, requestId, completedAt = new Date()) {
  const { data, error } = await supabase
    .from("account_deletion_requests")
    .update({ status: "completed", completed_at: completedAt.toISOString(), last_error: null })
    .eq("id", requestId)
    .eq("status", "processing")
    .select("id")
    .maybeSingle();
  if (error || !data) throw new Error("Could not record account purge completion");
}

export async function claimPurgeRequest(supabase, request) {
  const { data, error } = await supabase
    .from("account_deletion_requests")
    .update({ status: "processing", last_error: null })
    .eq("id", request.id)
    .eq("status", "approved")
    .select("id,account_id,scheduled_for,metadata")
    .maybeSingle();
  if (error) throw new Error("Could not claim account purge request");
  if (!data) return { status: "already_claimed" };

  const claimedRequest = { ...data, status: "approved" };
  const problems = purgeApprovalProblems(claimedRequest);
  if (problems.length) {
    await recordPurgeFailure(
      supabase,
      request.id,
      "Account purge approval changed; operator review required",
    );
    return { status: "failed", problems };
  }
  return { status: "claimed", request: claimedRequest };
}

async function purgeOne(supabase, request, environment) {
  const problems = purgeApprovalProblems(request);
  if (problems.length) return { id: request.id, status: "skipped", problems };

  const claim = await claimPurgeRequest(supabase, request);
  if (claim.status !== "claimed") return { id: request.id, ...claim };
  const claimedRequest = claim.request;

  try {
    const [accountResult, subscriptionResult, callsResult, filesResult] = await Promise.all([
      supabase.from("accounts").select("id,slug").eq("id", claimedRequest.account_id).maybeSingle(),
      supabase
        .from("account_subscriptions")
        .select("stripe_customer_id,stripe_subscription_id,status")
        .eq("account_id", claimedRequest.account_id)
        .maybeSingle(),
      supabase
        .from("calls")
        .select("provider_call_id")
        .eq("account_id", claimedRequest.account_id)
        .eq("provider", "retell")
        .limit(MAX_CALLS_PER_PURGE + 1),
      supabase
        .from("files")
        .select("storage_path")
        .eq("account_id", claimedRequest.account_id)
        .limit(MAX_FILES_PER_PURGE + 1),
    ]);
    for (const result of [accountResult, subscriptionResult, callsResult, filesResult])
      if (result.error) throw result.error;
    if (!accountResult.data) throw new Error("Workspace no longer exists");
    if ((callsResult.data || []).length > MAX_CALLS_PER_PURGE)
      throw new Error(
        `Workspace has more than ${MAX_CALLS_PER_PURGE} Retell calls; manual purge required`,
      );
    if ((filesResult.data || []).length > MAX_FILES_PER_PURGE)
      throw new Error(
        `Workspace has more than ${MAX_FILES_PER_PURGE} files; manual purge required`,
      );
    if (!privateFilesExportVerified(filesResult.data || [], claimedRequest.metadata))
      throw new Error("Private file export is required but not verified");

    await cleanupStripe(subscriptionResult.data, environment.STRIPE_SECRET_KEY);
    await cleanupRetell(callsResult.data || [], environment.RETELL_API_KEY);
    await cleanupStorage(supabase, filesResult.data || []);

    const { data: deleted, error: deleteError } = await supabase
      .from("accounts")
      .delete()
      .eq("id", claimedRequest.account_id)
      .select("id")
      .maybeSingle();
    if (deleteError) throw deleteError;
    if (!deleted) throw new Error("Workspace database deletion did not complete");

    await recordPurgeCompletion(supabase, request.id);
    return { id: request.id, status: "completed" };
  } catch (error) {
    const failureMessage = purgeFailureMessage(error);
    await recordPurgeFailure(supabase, request.id, failureMessage);
    return { id: request.id, status: "failed", error: failureMessage };
  }
}

export default async () => {
  const environment = process.env;
  if (environment.ACCOUNT_PURGE_ENABLED !== "true") {
    console.log(JSON.stringify({ event: "bontraco_account_purge", status: "disabled" }));
    return new Response(JSON.stringify({ disabled: true }), { status: 200 });
  }
  if (!environment.SUPABASE_URL || !environment.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error("Account purge requires Supabase server credentials");

  const supabase = createClient(environment.SUPABASE_URL, environment.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const recoveredStale = await recoverStalePurges(supabase);
  const { data: requests, error } = await supabase
    .from("account_deletion_requests")
    .select("id,account_id,status,scheduled_for,metadata")
    .eq("status", "approved")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(1);
  if (error) throw error;
  const results = [];
  for (const request of requests || [])
    results.push(await purgeOne(supabase, request, environment));
  console.log(
    JSON.stringify({
      event: "bontraco_account_purge",
      recovered_stale: recoveredStale,
      checked: requests?.length || 0,
      results,
    }),
  );
  return new Response(
    JSON.stringify({ recovered_stale: recoveredStale, checked: requests?.length || 0, results }),
    { status: 200 },
  );
};

export const config = { schedule: "43 8 * * *" };
