import { describe, expect, it } from "vitest";
import { estimateAcceptanceErrorMessage } from "./estimate-acceptance-error";

describe("estimateAcceptanceErrorMessage", () => {
  it("does not distinguish missing, expired, or failed estimate loads", () => {
    const expected =
      "This estimate link is unavailable or expired. Ask the company for a new link.";
    expect(estimateAcceptanceErrorMessage("Estimate link is unavailable", "load")).toBe(expected);
    expect(estimateAcceptanceErrorMessage("Estimate sharing is not configured", "load")).toBe(
      expected,
    );
    expect(estimateAcceptanceErrorMessage("private database failure secret-42", "load")).toBe(
      expected,
    );
  });

  it("keeps approved signer validation guidance", () => {
    expect(
      estimateAcceptanceErrorMessage(
        "Enter the full name of the person accepting this estimate.",
        "accept",
      ),
    ).toBe("Enter the full name of the person accepting this estimate.");
    expect(
      estimateAcceptanceErrorMessage("Enter a valid email address or leave it blank.", "accept"),
    ).toBe("Enter a valid email address or leave it blank.");
  });

  it("keeps approved acknowledgment guidance", () => {
    expect(
      estimateAcceptanceErrorMessage(
        "Confirm that you reviewed and accept the estimate.",
        "accept",
      ),
    ).toBe("Confirm that you reviewed and accept the estimate.");
  });

  it("maps unavailable acceptance and network failures", () => {
    expect(estimateAcceptanceErrorMessage("Estimate is no longer open", "accept")).toBe(
      "This estimate is no longer available for acceptance. Ask the company for a new link.",
    );
    expect(estimateAcceptanceErrorMessage(new TypeError("Failed to fetch"), "accept")).toBe(
      "Bontraco could not connect. Check your internet connection and try again.",
    );
    expect(estimateAcceptanceErrorMessage({ code: "auth_request_timeout" }, "accept")).toBe(
      "Your acceptance may still be recording. Reload this page before trying again.",
    );
  });

  it("does not expose unknown acceptance backend details", () => {
    expect(
      estimateAcceptanceErrorMessage({ message: "private acceptance policy secret-42" }, "accept"),
    ).toBe("This estimate could not be accepted. Try again or contact the company that sent it.");
  });
});
