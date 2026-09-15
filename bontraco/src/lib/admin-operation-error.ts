export type AdminOperation =
  | "billing"
  | "export"
  | "import_validate"
  | "import_commit"
  | "import_rollback"
  | "legacy_import"
  | "deletion_request"
  | "deletion_cancel";

type ErrorShape = {
  code?: unknown;
  message?: unknown;
  name?: unknown;
};

function details(cause: unknown) {
  if (typeof cause === "string") return { code: "", message: cause.toLowerCase(), name: "" };
  if (!cause || typeof cause !== "object") return { code: "", message: "", name: "" };
  const error = cause as ErrorShape;
  return {
    code: typeof error.code === "string" ? error.code.toLowerCase() : "",
    message: typeof error.message === "string" ? error.message.toLowerCase() : "",
    name: typeof error.name === "string" ? error.name.toLowerCase() : "",
  };
}

export function adminOperationErrorMessage(cause: unknown, action: AdminOperation) {
  const error = details(cause);
  const connectionFailed =
    error.message.includes("failed to fetch") ||
    error.message.includes("network") ||
    error.message.includes("offline") ||
    error.message.includes("database connection is unavailable");
  const sessionExpired =
    error.message.includes("sign in required") ||
    error.message.includes("session is invalid") ||
    error.message.includes("authentication required");

  if (error.code === "auth_request_timeout") {
    if (action === "billing")
      return "Billing may still be opening. Refresh Settings before trying again.";
    if (action === "export")
      return "The workspace export did not finish, so no file was saved. Try again.";
    if (action === "import_validate")
      return "Import validation did not finish. No records were imported; try again.";
    if (action === "import_commit")
      return "The import may still be processing. Refresh Settings and import history before trying again.";
    if (action === "import_rollback")
      return "The rollback may still be processing. Refresh Settings and import history before trying again.";
    if (action === "legacy_import")
      return "The preserved-lead import may still be processing. Refresh Leads before trying again.";
    if (action === "deletion_request")
      return "The deletion request may still be processing. Refresh Settings before trying again.";
    if (action === "deletion_cancel")
      return "The cancellation may still be processing. Refresh Settings before trying again.";
  }

  if (sessionExpired) return "Your session expired. Sign in again before continuing.";
  if (connectionFailed) return "Bontraco could not connect. Check your internet and try again.";

  if (action === "billing") {
    if (error.message.includes("billing is not configured"))
      return "Billing is not configured yet.";
    if (error.message.includes("plan is unavailable"))
      return "That subscription plan is currently unavailable.";
    if (error.message.includes("start a subscription"))
      return "Start a subscription before opening the billing portal.";
    if (error.message.includes("only account owners and admins"))
      return "Only workspace owners and administrators can manage billing.";
    return "Bontraco could not open billing. Wait a moment and try again.";
  }

  if (action === "export") {
    if (error.message.includes("export service is not configured"))
      return "Workspace export is not configured yet.";
    if (error.message.includes("only owners and admins"))
      return "Only workspace owners and administrators can export account data.";
    if (error.message.includes("integrity check failed"))
      return "The workspace export could not be verified, so no file was saved. Try again.";
    return "Bontraco could not export this workspace. Wait a moment and try again.";
  }

  if (action === "import_validate") {
    if (error.name === "syntaxerror" || error.message.includes("valid json"))
      return "The import file is not valid JSON.";
    if (error.message.includes("too large")) return "Import files must be 2 MB or smaller.";
    if (error.message.includes("only owners and admins"))
      return "Only workspace owners and administrators can import data.";
    if (error.message.includes("import service is not configured"))
      return "Workspace import is not configured yet.";
    return "Bontraco could not validate this import file. Review it and try again.";
  }

  if (action === "import_commit")
    return "Bontraco could not import these records. Review the dry-run report and try again.";

  if (action === "import_rollback") {
    if (error.message.includes("completed import batch not found"))
      return "This completed import batch is no longer available to roll back.";
    if (error.message.includes("confirm rollback"))
      return "Confirm rollback with the exact import batch identifier.";
    return "Bontraco could not roll back this import safely. Refresh Settings and try again.";
  }

  if (action === "legacy_import") {
    if (error.message.includes("platform backend is not configured"))
      return "The preserved-lead importer is not configured yet.";
    if (error.message.includes("only the workspace owner"))
      return "Only the workspace owner can import preserved leads.";
    return "Bontraco could not import the preserved leads safely. Wait a moment and try again.";
  }

  if (action === "deletion_request") {
    if (error.message.includes("confirmation does not match"))
      return "Type the exact workspace address to confirm deletion.";
    if (error.message.includes("only the workspace owner"))
      return "Only the workspace owner can request deletion.";
    if (error.message.includes("workspace not found"))
      return "This workspace is no longer available. Refresh Bontraco before trying again.";
    return "Bontraco could not schedule workspace deletion. Review the confirmation and try again.";
  }

  if (error.message.includes("no pending deletion request"))
    return "No pending deletion request was found.";
  if (error.message.includes("only the workspace owner"))
    return "Only the workspace owner can cancel deletion.";
  return "Bontraco could not cancel workspace deletion. Refresh Settings and try again.";
}
