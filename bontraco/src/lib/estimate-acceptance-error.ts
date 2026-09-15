export type EstimateAcceptanceAction = "load" | "accept";

type ErrorShape = {
  code?: unknown;
  message?: unknown;
};

function errorMessage(cause: unknown) {
  if (typeof cause === "string") return cause.toLowerCase();
  if (!cause || typeof cause !== "object") return "";
  const message = (cause as ErrorShape).message;
  return typeof message === "string" ? message.toLowerCase() : "";
}

export function estimateAcceptanceErrorMessage(cause: unknown, action: EstimateAcceptanceAction) {
  const message = errorMessage(cause);
  const code =
    cause instanceof Object && "code" in cause && typeof (cause as ErrorShape).code === "string"
      ? String((cause as ErrorShape).code).toLowerCase()
      : "";
  const connectionFailed =
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("offline");

  if (action === "load") {
    if (connectionFailed)
      return "Bontraco could not connect. Check your internet connection and open the link again.";
    return "This estimate link is unavailable or expired. Ask the company for a new link.";
  }

  if (code === "auth_request_timeout")
    return "Your acceptance may still be recording. Reload this page before trying again.";

  if (message.includes("full name of the person"))
    return "Enter the full name of the person accepting this estimate.";
  if (message.includes("valid email address"))
    return "Enter a valid email address or leave it blank.";
  if (message.includes("reviewed and accept") || message.includes("acknowledgment"))
    return "Confirm that you reviewed and accept the estimate.";
  if (
    message.includes("unavailable") ||
    message.includes("expired") ||
    message.includes("no longer open")
  )
    return "This estimate is no longer available for acceptance. Ask the company for a new link.";
  if (connectionFailed)
    return "Bontraco could not connect. Check your internet connection and try again.";
  return "This estimate could not be accepted. Try again or contact the company that sent it.";
}
