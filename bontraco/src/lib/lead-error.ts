export type LeadAction = "create" | "status" | "assign" | "convert";

type ErrorShape = {
  code?: unknown;
  message?: unknown;
};

function errorCode(cause: unknown) {
  if (!cause || typeof cause !== "object") return "";
  const code = (cause as ErrorShape).code;
  return typeof code === "string" ? code : "";
}

function errorMessage(cause: unknown) {
  if (!cause || typeof cause !== "object") return "";
  const message = (cause as ErrorShape).message;
  return typeof message === "string" ? message.toLowerCase() : "";
}

export function leadErrorMessage(cause: unknown, action: LeadAction) {
  const message = errorMessage(cause);

  if (errorCode(cause) === "auth_request_timeout") {
    if (action === "create")
      return "This lead may still be created. Refresh the lead list before trying again.";
    if (action === "status")
      return "This lead's status may still be updated. Refresh the lead list before trying again.";
    if (action === "assign")
      return "This lead assignment may still be saved. Refresh the lead list before trying again.";
    return "This lead may still be converting. Refresh the lead list before trying again.";
  }

  if (action === "convert") {
    if (message.includes("customer first name is required"))
      return "Add the customer's first name before converting this lead.";
    if (message.includes("estimated value cannot be negative"))
      return "Estimated value must be zero or greater.";
    if (message.includes("lead not found") || message.includes("lead access denied"))
      return "This lead is no longer available to convert. Refresh the lead list and try again.";
    return "Bontraco could not convert this lead. Review the customer and job details and try again.";
  }

  if (action === "create")
    return "Bontraco could not create this lead. Review the lead details and try again.";
  if (action === "status")
    return "Bontraco could not update this lead's status. Refresh the lead list and try again.";
  return "Bontraco could not assign this lead. Refresh the lead list and try again.";
}
