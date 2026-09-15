import { describe, expect, it } from "vitest";
import { leadEngineErrorMessage } from "./lead-engine-error";

describe("leadEngineErrorMessage", () => {
  it("keeps approved profile plan and limit guidance", () => {
    expect(leadEngineErrorMessage("An active Growth or Pro plan is required", "create")).toBe(
      "An active Growth or AI Pro plan is required to create lead searches.",
    );
    expect(leadEngineErrorMessage("Plan lead-profile limit reached (3 profiles)", "create")).toBe(
      "Your plan's lead-search profile limit has been reached.",
    );
    expect(
      leadEngineErrorMessage("duplicate lead_source_profiles_account_id_name_key", "create"),
    ).toBe("A search profile with this name already exists.");
  });

  it("keeps approved profile validation guidance", () => {
    expect(leadEngineErrorMessage("lead_source_profiles_name_check", "create")).toBe(
      "Search name must be between 2 and 80 characters.",
    );
    expect(leadEngineErrorMessage("lead_source_profiles_domain_shape_check", "create")).toBe(
      "Review the permitted public domains and try again.",
    );
    expect(leadEngineErrorMessage("lead_source_profiles_max_age_days_check", "create")).toBe(
      "Maximum result age must be between 1 and 30 days.",
    );
  });

  it("maps manual scan state without exposing profile lookup details", () => {
    expect(leadEngineErrorMessage("Lead scanning is not configured", "scan")).toBe(
      "Lead scanning is not configured yet. Review provider status in Settings.",
    );
    expect(leadEngineErrorMessage("Search profile not found in this workspace", "scan")).toBe(
      "This search profile is no longer available. Refresh Lead Engine and try again.",
    );
    expect(leadEngineErrorMessage("Session is invalid", "scan")).toBe(
      "Your session expired. Sign in again before running a lead scan.",
    );
  });

  it("allows only safe scan-history guidance", () => {
    expect(
      leadEngineErrorMessage("The source profile reached its daily result limit.", "history"),
    ).toBe("This search reached its daily result limit.");
    expect(leadEngineErrorMessage("The lead provider timed out.", "history")).toBe(
      "The lead provider timed out. Bontraco will retry on the next scheduled run.",
    );
    expect(leadEngineErrorMessage("Tavily request failed (500): private response", "history")).toBe(
      "This scan failed. Retry it or review provider health in Settings.",
    );
  });

  it("does not expose unknown profile, schedule, or scan backend details", () => {
    const internal = { message: "private lead policy secret-42" };
    expect(leadEngineErrorMessage(internal, "create")).toBe(
      "Bontraco could not create this search profile. Review its settings and try again.",
    );
    expect(leadEngineErrorMessage(internal, "toggle")).toBe(
      "Bontraco could not change this search schedule. Refresh Lead Engine and try again.",
    );
    expect(leadEngineErrorMessage(internal, "scan")).toBe(
      "Bontraco could not start this scan. Refresh Lead Engine and try again.",
    );
  });

  it("warns that timed-out lead mutations may still finish", () => {
    const timeout = { code: "auth_request_timeout" };
    expect(leadEngineErrorMessage(timeout, "create")).toContain(
      "search profile may still be created",
    );
    expect(leadEngineErrorMessage(timeout, "toggle")).toContain("schedule may still be changed");
    expect(leadEngineErrorMessage(timeout, "scan")).toContain("scan may still be running");
  });
});
