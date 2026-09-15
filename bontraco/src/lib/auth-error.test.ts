import { describe, expect, it } from "vitest";
import { authErrorMessage } from "./auth-error";

describe("authErrorMessage", () => {
  it("keeps the local password confirmation message", () => {
    expect(authErrorMessage(new Error("Passwords do not match."), "reset")).toBe(
      "Passwords do not match.",
    );
  });

  it("maps invalid credentials without exposing provider text", () => {
    expect(authErrorMessage({ code: "invalid_credentials" }, "login")).toBe(
      "Email or password is incorrect.",
    );
  });

  it("explains email verification safely", () => {
    expect(authErrorMessage({ code: "email_not_confirmed" }, "login")).toBe(
      "Verify your email address before signing in.",
    );
  });

  it("maps weak passwords", () => {
    expect(authErrorMessage({ code: "weak_password" }, "signup")).toBe(
      "Use a stronger password with at least 8 characters.",
    );
  });

  it("maps rate limits from status without provider details", () => {
    expect(authErrorMessage({ status: 429, message: "provider quota abc-123" }, "forgot")).toBe(
      "Too many attempts. Wait a few minutes and try again.",
    );
  });

  it("warns that a timed-out request may still finish", () => {
    expect(authErrorMessage({ code: "auth_request_timeout" }, "signup")).toBe(
      "Bontraco did not respond in time. Your request may still finish; wait a minute before trying again.",
    );
  });

  it("keeps a failed sign-out session explicit", () => {
    expect(authErrorMessage({ message: "private provider failure" }, "logout")).toBe(
      "Bontraco could not sign you out. Your session is still active; wait a moment and try again.",
    );
  });

  it("maps invalid reset sessions", () => {
    expect(authErrorMessage({ message: "Auth session missing!" }, "reset")).toBe(
      "This password-reset link is invalid or expired. Request a new link.",
    );
  });

  it("guides invitation email mismatches", () => {
    expect(authErrorMessage({ message: "invitation email does not match" }, "invite")).toBe(
      "Sign in with the email address that received this invitation.",
    );
  });

  it("keeps invitation network failures actionable", () => {
    expect(authErrorMessage(new Error("Network unavailable"), "invite")).toBe(
      "Bontraco could not connect. Check your internet connection and try again.",
    );
  });

  it("does not echo unknown provider or database errors", () => {
    expect(authErrorMessage({ message: "internal auth schema detail secret-42" }, "invite")).toBe(
      "This invitation could not be accepted. It may be invalid, expired, or already used.",
    );
  });
});
