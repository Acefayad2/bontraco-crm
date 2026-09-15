export type CommercialAction =
  | "estimate_create"
  | "estimate_status"
  | "invoice_create"
  | "share"
  | "payment";

type ErrorShape = {
  message?: unknown;
};

function errorMessage(cause: unknown) {
  if (typeof cause === "string") return cause.toLowerCase();
  if (!cause || typeof cause !== "object") return "";
  const message = (cause as ErrorShape).message;
  return typeof message === "string" ? message.toLowerCase() : "";
}

export function commercialErrorMessage(cause: unknown, action: CommercialAction) {
  const message = errorMessage(cause);
  const timedOut =
    cause instanceof Object && "code" in cause && cause.code === "auth_request_timeout";

  if (timedOut) {
    if (action === "estimate_create")
      return "This estimate may still be created. Refresh the job before trying again.";
    if (action === "estimate_status")
      return "This estimate status may still be updated. Refresh the job before trying again.";
    if (action === "invoice_create")
      return "This invoice may still be created. Refresh the job before trying again.";
    if (action === "payment")
      return "This payment may still be recorded. Refresh the job before trying again.";
    if (action === "share")
      return "This customer link may still be created. Refresh the estimate before trying again.";
  }

  if (action === "estimate_create") {
    if (message.includes("between 1 and 50 line items"))
      return "Add between 1 and 50 estimate line items.";
    if (message.includes("customer note must be 2000"))
      return "Customer note must be 2,000 characters or fewer.";
    if (message.includes("estimate terms must be 5000"))
      return "Estimate terms must be 5,000 characters or fewer.";
    if (message.includes("tax rate must be")) return "Tax rate must be between 0% and 100%.";
    if (message.includes("line item description"))
      return "Each line item needs a description of 500 characters or fewer.";
    if (message.includes("line item quantity"))
      return "Review the quantity on each estimate line item.";
    if (message.includes("line item price")) return "Review the price on each estimate line item.";
    return "Bontraco could not create this estimate. Review the scope and pricing and try again.";
  }

  if (action === "estimate_status")
    return "Bontraco could not update this estimate. Refresh the job and try again.";
  if (action === "invoice_create") {
    if (message.includes("only accepted estimates"))
      return "Only an accepted estimate can become an invoice.";
    return "Bontraco could not create this invoice. Refresh the job and try again.";
  }
  if (action === "share") {
    if (message.includes("only open estimates"))
      return "Only an open estimate can receive a new customer link.";
    if (message.includes("sharing is not configured"))
      return "Customer estimate links are not configured yet.";
    if (
      message.includes("estimate was not found") ||
      message.includes("cannot share") ||
      message.includes("workspace is unavailable")
    )
      return "This estimate is no longer available to share. Refresh the job and try again.";
    if (message.includes("sign in required") || message.includes("session is invalid"))
      return "Your session expired. Sign in again before creating a customer link.";
    return "Bontraco could not create this customer link. Refresh the job and try again.";
  }
  return "Bontraco could not record this payment. Review the payment details and try again.";
}
