export type SettingsAction = "profile" | "logo_upload" | "logo_save" | "logo_remove";

type ErrorShape = {
  message?: unknown;
};

function errorMessage(cause: unknown) {
  if (typeof cause === "string") return cause.toLowerCase();
  if (!cause || typeof cause !== "object") return "";
  const message = (cause as ErrorShape).message;
  return typeof message === "string" ? message.toLowerCase() : "";
}

function isRequestTimeout(cause: unknown) {
  return (
    cause instanceof Object &&
    "code" in cause &&
    (cause as { code?: unknown }).code === "auth_request_timeout"
  );
}

export function settingsErrorMessage(cause: unknown, action: SettingsAction) {
  const message = errorMessage(cause);

  if (isRequestTimeout(cause)) {
    if (action === "profile")
      return "Company settings may still be saving. Refresh Settings before trying again.";
    if (action === "logo_upload" || action === "logo_save")
      return "The logo change may still be finishing. Refresh Settings before trying again.";
    return "The logo removal may still be finishing. Refresh Settings before trying again.";
  }

  if (action === "profile") {
    if (message.includes("accounts_name_check"))
      return "Company name must be between 2 and 100 characters.";
    if (message.includes("accounts_legal_name_length"))
      return "Legal business name must be between 2 and 160 characters.";
    if (
      message.includes("accounts_timezone_format") ||
      message.includes("recognized iana timezone")
    )
      return "Choose a valid scheduling timezone.";
    if (message.includes("accounts_service_area_length"))
      return "Service area must be 300 characters or fewer.";
    if (message.includes("accounts_business_hours_length"))
      return "Business hours must be 500 characters or fewer.";
    if (message.includes("accounts_emergency_rules_length"))
      return "Emergency routing rules must be 1,000 characters or fewer.";
    if (message.includes("accounts_business_phone_length"))
      return "Business phone must be between 7 and 40 characters.";
    if (message.includes("accounts_business_email_format"))
      return "Enter a valid business email address.";
    if (message.includes("accounts_business_website_format"))
      return "Business website must be a valid HTTPS address.";
    if (message.includes("accounts_proposal_accent_color_format"))
      return "Choose a valid six-digit proposal accent color.";
    if (message.includes("accounts_estimate_default_tax_rate_range"))
      return "Default tax rate must be between 0% and 100%.";
    if (message.includes("accounts_estimate_default_valid_days_range"))
      return "Estimate validity must be between 1 and 365 days.";
    if (message.includes("accounts_estimate_default_customer_note_length"))
      return "Default customer note must be 2,000 characters or fewer.";
    if (message.includes("accounts_estimate_default_terms_length"))
      return "Default estimate terms must be 5,000 characters or fewer.";
    return "Bontraco could not save company settings. Review the profile and try again.";
  }

  if (action === "logo_upload")
    return "Bontraco could not upload this logo. Check the file and try again.";
  if (action === "logo_save")
    return "The logo uploaded, but Bontraco could not attach it to this workspace. Try again.";
  return "Bontraco could not remove the company logo. Refresh Settings and try again.";
}
