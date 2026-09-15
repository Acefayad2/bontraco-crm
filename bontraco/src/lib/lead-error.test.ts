import { describe, expect, it } from "vitest";
import { leadErrorMessage } from "./lead-error";

describe("leadErrorMessage", () => {
  it("keeps safe conversion validation guidance", () => {
    expect(leadErrorMessage({ message: "Customer first name is required" }, "convert")).toBe(
      "Add the customer's first name before converting this lead.",
    );
    expect(leadErrorMessage({ message: "Estimated value cannot be negative" }, "convert")).toBe(
      "Estimated value must be zero or greater.",
    );
  });

  it("does not distinguish missing leads from denied leads", () => {
    const expected =
      "This lead is no longer available to convert. Refresh the lead list and try again.";
    expect(leadErrorMessage({ message: "Lead not found" }, "convert")).toBe(expected);
    expect(leadErrorMessage({ message: "Lead access denied" }, "convert")).toBe(expected);
  });

  it("does not expose unknown create errors", () => {
    expect(leadErrorMessage({ message: "leads_private_constraint secret-42" }, "create")).toBe(
      "Bontraco could not create this lead. Review the lead details and try again.",
    );
  });

  it("does not expose unknown status errors", () => {
    expect(leadErrorMessage({ message: "policy internals secret-42" }, "status")).toBe(
      "Bontraco could not update this lead's status. Refresh the lead list and try again.",
    );
  });

  it("does not expose unknown assignment errors", () => {
    expect(leadErrorMessage({ message: "membership internals secret-42" }, "assign")).toBe(
      "Bontraco could not assign this lead. Refresh the lead list and try again.",
    );
  });

  it("does not expose unknown conversion errors", () => {
    expect(leadErrorMessage({ message: "conversion internals secret-42" }, "convert")).toBe(
      "Bontraco could not convert this lead. Review the customer and job details and try again.",
    );
  });

  it("warns before retrying uncertain timed-out lead actions", () => {
    const timeout = { code: "auth_request_timeout" };
    expect(leadErrorMessage(timeout, "create")).toMatch(/may still be created/);
    expect(leadErrorMessage(timeout, "status")).toMatch(/may still be updated/);
    expect(leadErrorMessage(timeout, "assign")).toMatch(/may still be saved/);
    expect(leadErrorMessage(timeout, "convert")).toMatch(/may still be converting/);
  });
});
