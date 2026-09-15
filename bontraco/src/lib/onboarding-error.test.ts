import { describe, expect, it } from "vitest";
import { onboardingErrorMessage } from "./onboarding-error";

describe("onboardingErrorMessage", () => {
  it("keeps duplicate workspace guidance", () => {
    expect(onboardingErrorMessage({ code: "23505", message: "accounts_slug_key duplicate" })).toBe(
      "That workspace name is already in use. Try a more specific company name.",
    );
  });

  it("handles an existing membership without exposing RPC details", () => {
    expect(
      onboardingErrorMessage({ message: "User already belongs to an active Bontraco account" }),
    ).toBe("Your account already has workspace access. Refresh Bontraco to continue.");
  });

  it("maps invalid or expired sessions", () => {
    expect(onboardingErrorMessage({ message: "Authentication required" })).toBe(
      "Your session expired. Sign in again before creating a workspace.",
    );
    expect(onboardingErrorMessage({ status: 401, message: "private auth detail" })).toBe(
      "Your session expired. Sign in again before creating a workspace.",
    );
  });

  it("keeps company-name and connection guidance", () => {
    expect(onboardingErrorMessage({ message: "Invalid account slug" })).toBe(
      "Enter a company name between 2 and 100 characters.",
    );
    expect(onboardingErrorMessage({ message: "Failed to fetch" })).toBe(
      "Bontraco could not connect. Check your internet connection and try again.",
    );
  });

  it("prevents immediate retries after an uncertain creation timeout", () => {
    expect(onboardingErrorMessage({ code: "auth_request_timeout" })).toBe(
      "Bontraco did not respond in time. Your workspace may still be created; wait a minute, then refresh before trying again.",
    );
  });

  it("does not expose unknown onboarding backend details", () => {
    expect(onboardingErrorMessage({ message: "private_function secret-42" })).toBe(
      "Bontraco could not create this workspace. Review the company details and try again.",
    );
  });
});
