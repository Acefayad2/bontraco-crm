import { describe, expect, it } from "vitest";
import { teamErrorMessage } from "./team-error";

describe("teamErrorMessage", () => {
  it("keeps duplicate-invitation guidance", () => {
    expect(teamErrorMessage({ code: "23505" }, "invite", "Growth", 5)).toBe(
      "That email already has a pending invitation.",
    );
  });

  it("keeps plan seat-limit guidance", () => {
    expect(teamErrorMessage({ message: "Plan user limit reached" }, "invite", "Growth", 5)).toBe(
      "The Growth plan's 5-user limit has been reached.",
    );
  });

  it("keeps subscription guidance", () => {
    expect(
      teamErrorMessage({ message: "Active subscription required" }, "invite", "AI Pro", 10),
    ).toBe("An active subscription is required before teammates can be added.");
  });

  it("does not expose unknown database details", () => {
    const internal = { message: "memberships_private_constraint secret-42" };
    expect(teamErrorMessage(internal, "invite", "AI Pro", 10)).toBe(
      "Bontraco could not create this invitation. Check the email and try again.",
    );
    expect(teamErrorMessage(internal, "update", "AI Pro", 10)).toBe(
      "Bontraco could not update this teammate. Refresh the team list and try again.",
    );
    expect(teamErrorMessage(internal, "cancel", "AI Pro", 10)).toBe(
      "Bontraco could not cancel this invitation. Refresh the team list and try again.",
    );
  });

  it("warns that timed-out team mutations may still finish", () => {
    const timeout = { code: "auth_request_timeout" };
    expect(teamErrorMessage(timeout, "invite", "AI Pro", 10)).toContain(
      "invitation may still be created",
    );
    expect(teamErrorMessage(timeout, "update", "AI Pro", 10)).toContain(
      "teammate change may still be saved",
    );
    expect(teamErrorMessage(timeout, "cancel", "AI Pro", 10)).toContain(
      "invitation may still be canceled",
    );
  });
});
