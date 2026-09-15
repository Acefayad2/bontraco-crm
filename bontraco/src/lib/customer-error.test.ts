import { describe, expect, it } from "vitest";
import { customerErrorMessage } from "./customer-error";

describe("customerErrorMessage", () => {
  it("keeps safe customer validation guidance", () => {
    expect(customerErrorMessage({ message: "First name is required" }, "create")).toBe(
      "Add the customer's first name.",
    );
    expect(
      customerErrorMessage({ message: "One or more customer fields are too long" }, "create"),
    ).toBe("One or more customer fields are too long. Shorten the details and try again.");
    expect(
      customerErrorMessage(
        { message: "Address and city are both required for a service location" },
        "create",
      ),
    ).toBe("Enter both a street address and city, or leave both blank.");
  });

  it("does not expose unknown customer-creation errors", () => {
    expect(
      customerErrorMessage({ message: "contacts_private_constraint secret-42" }, "create"),
    ).toBe("Bontraco could not create this customer. Review the details and try again.");
  });

  it("does not expose unknown assignment errors", () => {
    expect(customerErrorMessage({ message: "membership internals secret-42" }, "assign")).toBe(
      "Bontraco could not assign this customer. Refresh the customer list and try again.",
    );
  });

  it("does not expose unknown location-creation errors", () => {
    expect(
      customerErrorMessage({ message: "properties internals secret-42" }, "add_location"),
    ).toBe("Bontraco could not add this service location. Review the address and try again.");
  });

  it("does not expose unknown location-update errors", () => {
    expect(
      customerErrorMessage({ message: "properties internals secret-42" }, "update_location"),
    ).toBe("Bontraco could not update this service location. Review the address and try again.");
  });

  it("does not distinguish missing locations from denied locations", () => {
    const expected =
      "Bontraco could not change this service location. Refresh the customer and try again.";
    expect(
      customerErrorMessage({ message: "Service location not found" }, "archive_location"),
    ).toBe(expected);
    expect(
      customerErrorMessage(
        { message: "Owner, administrator, or dispatcher required" },
        "archive_location",
      ),
    ).toBe(expected);
  });

  it("warns before retrying uncertain customer writes", () => {
    const timeout = { code: "auth_request_timeout" };
    expect(customerErrorMessage(timeout, "create")).toContain("may still be created");
    expect(customerErrorMessage(timeout, "assign")).toContain("assignment may still be saved");
    expect(customerErrorMessage(timeout, "add_location")).toContain("may still be added");
    expect(customerErrorMessage(timeout, "update_location")).toContain("may still be updated");
    expect(customerErrorMessage(timeout, "archive_location")).toContain("may still be changed");
    expect(customerErrorMessage(timeout, "merge")).toContain("may still be merged");
    expect(customerErrorMessage(timeout, "record_suppression")).toContain("may still be saved");
    expect(customerErrorMessage(timeout, "lift_suppression")).toContain("may still be lifted");
    expect(customerErrorMessage(timeout, "record_consent")).toContain("may still be recorded");
  });

  it("does not expose unknown merge errors", () => {
    expect(customerErrorMessage({ message: "merge internals secret-42" }, "merge")).toBe(
      "Bontraco could not merge these customer records. Refresh the customer list and try again.",
    );
  });

  it("keeps duplicate preference guidance without exposing unknown communication errors", () => {
    expect(customerErrorMessage({ code: "23505" }, "record_suppression")).toBe(
      "That do-not-contact preference is already active.",
    );
    expect(
      customerErrorMessage({ message: "suppression internals secret-42" }, "record_suppression"),
    ).toBe("Bontraco could not save this preference.");
    expect(
      customerErrorMessage({ message: "suppression internals secret-42" }, "lift_suppression"),
    ).toBe("Bontraco could not lift this preference.");
    expect(customerErrorMessage({ message: "consent internals secret-42" }, "record_consent")).toBe(
      "Bontraco could not save this consent event.",
    );
  });
});
