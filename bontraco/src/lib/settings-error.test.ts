import { describe, expect, it } from "vitest";
import { settingsErrorMessage } from "./settings-error";

describe("settingsErrorMessage", () => {
  it("keeps approved workspace identity guidance", () => {
    expect(settingsErrorMessage({ message: "accounts_name_check" }, "profile")).toBe(
      "Company name must be between 2 and 100 characters.",
    );
    expect(settingsErrorMessage({ message: "accounts_legal_name_length" }, "profile")).toBe(
      "Legal business name must be between 2 and 160 characters.",
    );
    expect(settingsErrorMessage("Timezone must be a recognized IANA timezone", "profile")).toBe(
      "Choose a valid scheduling timezone.",
    );
  });

  it("keeps approved business-detail guidance", () => {
    expect(settingsErrorMessage("accounts_service_area_length", "profile")).toBe(
      "Service area must be 300 characters or fewer.",
    );
    expect(settingsErrorMessage("accounts_business_hours_length", "profile")).toBe(
      "Business hours must be 500 characters or fewer.",
    );
    expect(settingsErrorMessage("accounts_emergency_rules_length", "profile")).toBe(
      "Emergency routing rules must be 1,000 characters or fewer.",
    );
    expect(settingsErrorMessage("accounts_business_phone_length", "profile")).toBe(
      "Business phone must be between 7 and 40 characters.",
    );
    expect(settingsErrorMessage("accounts_business_email_format", "profile")).toBe(
      "Enter a valid business email address.",
    );
    expect(settingsErrorMessage("accounts_business_website_format", "profile")).toBe(
      "Business website must be a valid HTTPS address.",
    );
  });

  it("keeps approved estimate-default guidance", () => {
    expect(settingsErrorMessage("accounts_proposal_accent_color_format", "profile")).toBe(
      "Choose a valid six-digit proposal accent color.",
    );
    expect(settingsErrorMessage("accounts_estimate_default_tax_rate_range", "profile")).toBe(
      "Default tax rate must be between 0% and 100%.",
    );
    expect(settingsErrorMessage("accounts_estimate_default_valid_days_range", "profile")).toBe(
      "Estimate validity must be between 1 and 365 days.",
    );
    expect(settingsErrorMessage("accounts_estimate_default_customer_note_length", "profile")).toBe(
      "Default customer note must be 2,000 characters or fewer.",
    );
    expect(settingsErrorMessage("accounts_estimate_default_terms_length", "profile")).toBe(
      "Default estimate terms must be 5,000 characters or fewer.",
    );
  });

  it("does not expose unknown profile backend details", () => {
    expect(settingsErrorMessage({ message: "private_constraint secret-42" }, "profile")).toBe(
      "Bontraco could not save company settings. Review the profile and try again.",
    );
  });

  it("does not expose Storage or database details for logo actions", () => {
    const internal = { message: "storage.objects policy secret-42" };
    expect(settingsErrorMessage(internal, "logo_upload")).toBe(
      "Bontraco could not upload this logo. Check the file and try again.",
    );
    expect(settingsErrorMessage(internal, "logo_save")).toBe(
      "The logo uploaded, but Bontraco could not attach it to this workspace. Try again.",
    );
    expect(settingsErrorMessage(internal, "logo_remove")).toBe(
      "Bontraco could not remove the company logo. Refresh Settings and try again.",
    );
  });

  it("warns against repeating uncertain timed-out settings writes", () => {
    const timeout = { code: "auth_request_timeout" };
    expect(settingsErrorMessage(timeout, "profile")).toBe(
      "Company settings may still be saving. Refresh Settings before trying again.",
    );
    expect(settingsErrorMessage(timeout, "logo_upload")).toBe(
      "The logo change may still be finishing. Refresh Settings before trying again.",
    );
    expect(settingsErrorMessage(timeout, "logo_save")).toBe(
      "The logo change may still be finishing. Refresh Settings before trying again.",
    );
    expect(settingsErrorMessage(timeout, "logo_remove")).toBe(
      "The logo removal may still be finishing. Refresh Settings before trying again.",
    );
  });
});
