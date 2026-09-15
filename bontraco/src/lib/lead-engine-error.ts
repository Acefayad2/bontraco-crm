export type LeadEngineAction = "create" | "toggle" | "scan" | "history";

type ErrorShape = {
  code?: unknown;
  message?: unknown;
};

function errorCode(cause: unknown) {
  if (!cause || typeof cause !== "object") return "";
  const code = (cause as ErrorShape).code;
  return typeof code === "string" ? code.toLowerCase() : "";
}

function errorMessage(cause: unknown) {
  if (typeof cause === "string") return cause.toLowerCase();
  if (!cause || typeof cause !== "object") return "";
  const message = (cause as ErrorShape).message;
  return typeof message === "string" ? message.toLowerCase() : "";
}

export function leadEngineErrorMessage(cause: unknown, action: LeadEngineAction) {
  const message = errorMessage(cause);

  if (errorCode(cause) === "auth_request_timeout") {
    if (action === "create")
      return "Bontraco did not respond in time. The search profile may still be created; refresh Lead Engine before trying again.";
    if (action === "toggle")
      return "Bontraco did not respond in time. The schedule may still be changed; refresh Lead Engine before trying again.";
    if (action === "scan")
      return "Bontraco did not respond in time. The scan may still be running; wait for scan history to refresh before trying again.";
  }

  if (action === "create") {
    if (message.includes("active growth or pro plan"))
      return "An active Growth or AI Pro plan is required to create lead searches.";
    if (message.includes("plan lead-profile limit reached"))
      return "Your plan's lead-search profile limit has been reached.";
    if (
      message.includes("duplicate") ||
      message.includes("lead_source_profiles_account_id_name_key")
    )
      return "A search profile with this name already exists.";
    if (message.includes("lead_source_profiles_name_check"))
      return "Search name must be between 2 and 80 characters.";
    if (
      message.includes("lead_source_profiles_domain_count_check") ||
      message.includes("lead_source_profiles_domain_shape_check")
    )
      return "Review the permitted public domains and try again.";
    if (message.includes("lead_source_profiles_max_age_days_check"))
      return "Maximum result age must be between 1 and 30 days.";
    return "Bontraco could not create this search profile. Review its settings and try again.";
  }

  if (action === "toggle") {
    if (message.includes("active growth or pro plan"))
      return "An active Growth or AI Pro plan is required to enable lead searches.";
    return "Bontraco could not change this search schedule. Refresh Lead Engine and try again.";
  }

  if (action === "scan") {
    if (message.includes("lead scanning is not configured"))
      return "Lead scanning is not configured yet. Review provider status in Settings.";
    if (message.includes("ran within the last minute"))
      return "This search ran within the last minute. Review that result before running it again.";
    if (message.includes("sign in required") || message.includes("session is invalid"))
      return "Your session expired. Sign in again before running a lead scan.";
    if (message.includes("only owners and admins"))
      return "Only workspace owners and administrators can run lead scans.";
    if (message.includes("profile not found") || message.includes("profile lookup failed"))
      return "This search profile is no longer available. Refresh Lead Engine and try again.";
    return "Bontraco could not start this scan. Refresh Lead Engine and try again.";
  }

  if (message.includes("active growth or pro plan"))
    return "An active Growth or AI Pro plan is required for automated lead scans.";
  if (message.includes("adapter is not enabled")) return "This lead provider is not available yet.";
  if (message.includes("daily result limit")) return "This search reached its daily result limit.";
  if (message.includes("daily provider-request limit"))
    return "This search reached its daily provider-request limit.";
  if (message.includes("no valid permitted domains"))
    return "This search has no valid permitted public domains.";
  if (message.includes("provider timed out"))
    return "The lead provider timed out. Bontraco will retry on the next scheduled run.";
  if (message.includes("provider request limit reached"))
    return "The lead provider request limit was reached. Bontraco will retry later.";
  if (message.includes("provider rejected its server credential"))
    return "The lead provider rejected its server credential. Review the integration in Settings.";
  if (message.includes("could not save this scan"))
    return "Bontraco could not save this scan. It will retry on the next scheduled run.";
  return "This scan failed. Retry it or review provider health in Settings.";
}
