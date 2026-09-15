import { describe, expect, it } from "vitest";
import { adminOperationErrorMessage } from "./admin-operation-error";

describe("adminOperationErrorMessage", () => {
  it("keeps approved billing guidance", () => {
    expect(adminOperationErrorMessage("Billing is not configured yet", "billing")).toBe(
      "Billing is not configured yet.",
    );
    expect(
      adminOperationErrorMessage(
        "Start a subscription before opening the billing portal",
        "billing",
      ),
    ).toBe("Start a subscription before opening the billing portal.");
    expect(
      adminOperationErrorMessage("Only account owners and admins can manage billing", "billing"),
    ).toBe("Only workspace owners and administrators can manage billing.");
  });

  it("releases billing safely after an uncertain timeout", () => {
    expect(adminOperationErrorMessage({ code: "auth_request_timeout" }, "billing")).toBe(
      "Billing may still be opening. Refresh Settings before trying again.",
    );
  });

  it("maps export authorization and unknown failures", () => {
    expect(
      adminOperationErrorMessage("Only owners and admins can export account data", "export"),
    ).toBe("Only workspace owners and administrators can export account data.");
    expect(adminOperationErrorMessage("private export table secret-42", "export")).toBe(
      "Bontraco could not export this workspace. Wait a moment and try again.",
    );
    expect(adminOperationErrorMessage("Workspace export integrity check failed", "export")).toBe(
      "The workspace export could not be verified, so no file was saved. Try again.",
    );
    expect(adminOperationErrorMessage({ code: "auth_request_timeout" }, "export")).toBe(
      "The workspace export did not finish, so no file was saved. Try again.",
    );
  });

  it("keeps safe import-file validation", () => {
    expect(
      adminOperationErrorMessage(new SyntaxError("Unexpected token private"), "import_validate"),
    ).toBe("The import file is not valid JSON.");
    expect(adminOperationErrorMessage("Import file is too large", "import_validate")).toBe(
      "Import files must be 2 MB or smaller.",
    );
  });

  it("maps commit and rollback failures without record details", () => {
    expect(adminOperationErrorMessage("Could not import client secret-42", "import_commit")).toBe(
      "Bontraco could not import these records. Review the dry-run report and try again.",
    );
    expect(adminOperationErrorMessage("Completed import batch not found", "import_rollback")).toBe(
      "This completed import batch is no longer available to roll back.",
    );
    const timeout = { code: "auth_request_timeout" };
    expect(adminOperationErrorMessage(timeout, "import_validate")).toBe(
      "Import validation did not finish. No records were imported; try again.",
    );
    expect(adminOperationErrorMessage(timeout, "import_commit")).toBe(
      "The import may still be processing. Refresh Settings and import history before trying again.",
    );
    expect(adminOperationErrorMessage(timeout, "import_rollback")).toBe(
      "The rollback may still be processing. Refresh Settings and import history before trying again.",
    );
  });

  it("keeps approved preserved-lead import guidance", () => {
    expect(adminOperationErrorMessage("Platform backend is not configured", "legacy_import")).toBe(
      "The preserved-lead importer is not configured yet.",
    );
    expect(adminOperationErrorMessage("private archive schema secret-42", "legacy_import")).toBe(
      "Bontraco could not import the preserved leads safely. Wait a moment and try again.",
    );
    expect(adminOperationErrorMessage({ code: "auth_request_timeout" }, "legacy_import")).toBe(
      "The preserved-lead import may still be processing. Refresh Leads before trying again.",
    );
  });

  it("keeps deletion confirmation guidance without exposing RPC details", () => {
    expect(
      adminOperationErrorMessage("Workspace confirmation does not match", "deletion_request"),
    ).toBe("Type the exact workspace address to confirm deletion.");
    expect(
      adminOperationErrorMessage("No pending deletion request was found", "deletion_cancel"),
    ).toBe("No pending deletion request was found.");
    expect(adminOperationErrorMessage("private deletion policy secret-42", "deletion_cancel")).toBe(
      "Bontraco could not cancel workspace deletion. Refresh Settings and try again.",
    );
  });

  it("warns owners before repeating uncertain deletion actions", () => {
    const timeout = { code: "auth_request_timeout" };
    expect(adminOperationErrorMessage(timeout, "deletion_request")).toBe(
      "The deletion request may still be processing. Refresh Settings before trying again.",
    );
    expect(adminOperationErrorMessage(timeout, "deletion_cancel")).toBe(
      "The cancellation may still be processing. Refresh Settings before trying again.",
    );
  });

  it("maps session and network failures consistently", () => {
    expect(adminOperationErrorMessage("Session is invalid", "billing")).toBe(
      "Your session expired. Sign in again before continuing.",
    );
    expect(adminOperationErrorMessage(new TypeError("Failed to fetch"), "export")).toBe(
      "Bontraco could not connect. Check your internet and try again.",
    );
  });
});
