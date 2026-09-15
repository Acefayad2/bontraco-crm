import { describe, expect, it } from "vitest";
import { commercialErrorMessage } from "./commercial-error";

describe("commercialErrorMessage", () => {
  it("keeps approved estimate validation guidance", () => {
    expect(
      commercialErrorMessage(
        { message: "An estimate requires between 1 and 50 line items" },
        "estimate_create",
      ),
    ).toBe("Add between 1 and 50 estimate line items.");
    expect(
      commercialErrorMessage(
        { message: "Customer note must be 2000 characters or fewer" },
        "estimate_create",
      ),
    ).toBe("Customer note must be 2,000 characters or fewer.");
    expect(
      commercialErrorMessage(
        { message: "Estimate terms must be 5000 characters or fewer" },
        "estimate_create",
      ),
    ).toBe("Estimate terms must be 5,000 characters or fewer.");
    expect(
      commercialErrorMessage({ message: "Tax rate must be between 0 and 1" }, "estimate_create"),
    ).toBe("Tax rate must be between 0% and 100%.");
    expect(
      commercialErrorMessage(
        { message: "Line item description must be between 1 and 500 characters" },
        "estimate_create",
      ),
    ).toBe("Each line item needs a description of 500 characters or fewer.");
    expect(
      commercialErrorMessage(
        { message: "Line item quantity is outside the allowed range" },
        "estimate_create",
      ),
    ).toBe("Review the quantity on each estimate line item.");
    expect(
      commercialErrorMessage(
        { message: "Line item price is outside the allowed range" },
        "estimate_create",
      ),
    ).toBe("Review the price on each estimate line item.");
  });

  it("keeps accepted-estimate invoice guidance", () => {
    expect(
      commercialErrorMessage(
        { message: "Only accepted estimates can become invoices" },
        "invoice_create",
      ),
    ).toBe("Only an accepted estimate can become an invoice.");
  });

  it("maps customer-link state without exposing authorization details", () => {
    expect(
      commercialErrorMessage("Only open estimates can receive a new customer link", "share"),
    ).toBe("Only an open estimate can receive a new customer link.");
    const expected =
      "This estimate is no longer available to share. Refresh the job and try again.";
    expect(commercialErrorMessage("Estimate was not found in this workspace", "share")).toBe(
      expected,
    );
    expect(commercialErrorMessage("This user cannot share the selected estimate", "share")).toBe(
      expected,
    );
  });

  it("maps expired customer-link sessions", () => {
    expect(commercialErrorMessage("Session is invalid", "share")).toBe(
      "Your session expired. Sign in again before creating a customer link.",
    );
  });

  it("does not expose unknown commercial backend details", () => {
    const internal = { message: "commercial_private_constraint secret-42" };
    expect(commercialErrorMessage(internal, "estimate_create")).toBe(
      "Bontraco could not create this estimate. Review the scope and pricing and try again.",
    );
    expect(commercialErrorMessage(internal, "estimate_status")).toBe(
      "Bontraco could not update this estimate. Refresh the job and try again.",
    );
    expect(commercialErrorMessage(internal, "invoice_create")).toBe(
      "Bontraco could not create this invoice. Refresh the job and try again.",
    );
    expect(commercialErrorMessage(internal, "share")).toBe(
      "Bontraco could not create this customer link. Refresh the job and try again.",
    );
    expect(commercialErrorMessage(internal, "payment")).toBe(
      "Bontraco could not record this payment. Review the payment details and try again.",
    );
  });

  it("warns before repeating an uncertain commercial write", () => {
    const timeout = { code: "auth_request_timeout" };
    expect(commercialErrorMessage(timeout, "estimate_create")).toContain(
      "estimate may still be created",
    );
    expect(commercialErrorMessage(timeout, "estimate_status")).toContain(
      "status may still be updated",
    );
    expect(commercialErrorMessage(timeout, "invoice_create")).toContain(
      "invoice may still be created",
    );
    expect(commercialErrorMessage(timeout, "payment")).toContain("payment may still be recorded");
    expect(commercialErrorMessage(timeout, "share")).toContain(
      "customer link may still be created",
    );
  });
});
