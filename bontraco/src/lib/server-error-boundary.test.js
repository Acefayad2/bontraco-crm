import { describe, expect, it } from "vitest";
import { publicBookingError } from "../../netlify/functions/retell-book-appointment.mjs";
import { reconciliationFailureMessage } from "../../netlify/functions/retell-reconcile.mjs";

describe("server function error boundary", () => {
  it("preserves only approved appointment validation guidance", () => {
    expect(publicBookingError(new Error("Appointment duration is invalid: internal detail"))).toBe(
      "Appointment duration is invalid",
    );
    expect(publicBookingError(new Error("Verified call not found: provider-call-123"))).toBe(
      "This call is no longer available for booking",
    );
  });

  it("hides unknown booking and database failures", () => {
    const publicMessage = publicBookingError(
      new Error("relation calls_secret does not exist; token=private"),
    );
    expect(publicMessage).toBe("Appointment could not be booked");
    expect(publicMessage).not.toContain("calls_secret");
  });

  it("uses a stable public reconciliation failure", () => {
    expect(reconciliationFailureMessage).toBe("Call reconciliation failed");
  });
});
