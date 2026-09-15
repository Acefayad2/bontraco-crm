export type CustomerAction =
  | "create"
  | "assign"
  | "add_location"
  | "update_location"
  | "archive_location"
  | "merge"
  | "record_suppression"
  | "lift_suppression"
  | "record_consent";

type ErrorShape = {
  code?: unknown;
  message?: unknown;
};

function errorMessage(cause: unknown) {
  if (!cause || typeof cause !== "object") return "";
  const message = (cause as ErrorShape).message;
  return typeof message === "string" ? message.toLowerCase() : "";
}

export function customerErrorMessage(cause: unknown, action: CustomerAction) {
  const message = errorMessage(cause);
  const code =
    cause && typeof cause === "object" && typeof (cause as ErrorShape).code === "string"
      ? (cause as { code: string }).code
      : "";

  if (code === "auth_request_timeout") {
    if (action === "create")
      return "This customer may still be created. Refresh the customer list before trying again.";
    if (action === "assign")
      return "This customer assignment may still be saved. Refresh the customer list before trying again.";
    if (action === "add_location")
      return "This service location may still be added. Refresh the customer before trying again.";
    if (action === "update_location")
      return "This service location may still be updated. Refresh the customer before trying again.";
    if (action === "archive_location")
      return "This service location status may still be changed. Refresh the customer before trying again.";
    if (action === "merge")
      return "These customer records may still be merged. Refresh the customer list before trying again.";
    if (action === "record_suppression")
      return "This do-not-contact preference may still be saved. Refresh the customer before trying again.";
    if (action === "lift_suppression")
      return "This do-not-contact preference may still be lifted. Refresh the customer before trying again.";
    return "This consent event may still be recorded. Refresh the customer before trying again.";
  }

  if (action === "create") {
    if (message.includes("first name is required")) return "Add the customer's first name.";
    if (message.includes("customer fields are too long"))
      return "One or more customer fields are too long. Shorten the details and try again.";
    if (message.includes("address and city are both required"))
      return "Enter both a street address and city, or leave both blank.";
    return "Bontraco could not create this customer. Review the details and try again.";
  }

  if (action === "assign")
    return "Bontraco could not assign this customer. Refresh the customer list and try again.";
  if (action === "add_location")
    return "Bontraco could not add this service location. Review the address and try again.";
  if (action === "update_location")
    return "Bontraco could not update this service location. Review the address and try again.";
  if (action === "archive_location")
    return "Bontraco could not change this service location. Refresh the customer and try again.";
  if (action === "merge")
    return "Bontraco could not merge these customer records. Refresh the customer list and try again.";
  if (action === "record_suppression")
    return code === "23505"
      ? "That do-not-contact preference is already active."
      : "Bontraco could not save this preference.";
  if (action === "lift_suppression") return "Bontraco could not lift this preference.";
  return "Bontraco could not save this consent event.";
}
