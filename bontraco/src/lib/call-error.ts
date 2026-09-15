export type CallAction = "settings" | "assign" | "test";

type ErrorShape = { code?: unknown } | null | undefined;

function errorCode(error: unknown) {
  return typeof (error as ErrorShape)?.code === "string" ? (error as { code: string }).code : "";
}

const approvedTestCallErrors = new Set([
  "Sign in required",
  "Workspace selection is required",
  "Retell test calls are not configured",
  "Enter a phone number in +15551234567 format",
  "Session is invalid",
  "Could not verify this request",
  "Could not verify workspace access",
  "Only owners and admins can place test calls",
  "Do-not-contact safeguards are temporarily unavailable",
  "This number is marked do not call in this workspace",
  "Select Retell AI in receptionist settings first",
  "Could not load receptionist settings",
  "A Retell phone number is required",
  "Could not verify test-call limit",
  "Daily test-call limit reached",
  "Test-call provider could not start the call",
]);

export function callErrorMessage(action: CallAction, error?: unknown) {
  if (errorCode(error) === "auth_request_timeout") {
    if (action === "settings")
      return "Receptionist settings may still be saved. Refresh Calls before trying again.";
    if (action === "assign")
      return "The call assignment may still be saved. Refresh call history before trying again.";
    return "The test call may still be starting. Wait for call history to refresh before trying again.";
  }
  if (action === "settings")
    return "Bontraco could not save receptionist settings. Review the details and try again.";
  if (action === "assign")
    return "Bontraco could not assign this call. Refresh call history and try again.";
  return "Bontraco could not reach the test-call service. Check your connection and try again.";
}

export function testCallResponseMessage(error: unknown) {
  if (typeof error === "string" && approvedTestCallErrors.has(error)) return error;
  return "Bontraco could not start this test call. Review the settings and try again.";
}

export function testCallSuccessMessage(tracked: unknown) {
  return tracked === false
    ? "Test call started, but call history is delayed. Do not retry."
    : "Test call started. It will appear in call history shortly.";
}
