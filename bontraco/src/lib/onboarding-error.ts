type ErrorShape = {
  code?: unknown;
  message?: unknown;
  status?: unknown;
};

function details(cause: unknown) {
  if (!cause || typeof cause !== "object") return { code: "", message: "", status: 0 };
  const error = cause as ErrorShape;
  return {
    code: typeof error.code === "string" ? error.code.toLowerCase() : "",
    message: typeof error.message === "string" ? error.message.toLowerCase() : "",
    status: typeof error.status === "number" ? error.status : 0,
  };
}

export function onboardingErrorMessage(cause: unknown) {
  const error = details(cause);
  const combined = `${error.code} ${error.message}`;

  if (combined.includes("auth_request_timeout"))
    return "Bontraco did not respond in time. Your workspace may still be created; wait a minute, then refresh before trying again.";
  if (combined.includes("duplicate") || combined.includes("accounts_slug_key"))
    return "That workspace name is already in use. Try a more specific company name.";
  if (combined.includes("already belongs to an active bontraco account"))
    return "Your account already has workspace access. Refresh Bontraco to continue.";
  if (
    combined.includes("authentication required") ||
    combined.includes("jwt") ||
    error.status === 401
  )
    return "Your session expired. Sign in again before creating a workspace.";
  if (
    combined.includes("invalid account slug") ||
    combined.includes("accounts_name_check") ||
    combined.includes("accounts_slug_check")
  )
    return "Enter a company name between 2 and 100 characters.";
  if (
    combined.includes("failed to fetch") ||
    combined.includes("network") ||
    combined.includes("offline")
  )
    return "Bontraco could not connect. Check your internet connection and try again.";
  return "Bontraco could not create this workspace. Review the company details and try again.";
}
