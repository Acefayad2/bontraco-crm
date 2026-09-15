import { describe, expect, it } from "vitest";
import {
  callErrorMessage,
  testCallResponseMessage,
  testCallSuccessMessage,
  type CallAction,
} from "./call-error";

const expected: Array<[CallAction, string]> = [
  ["settings", "Bontraco could not save receptionist settings. Review the details and try again."],
  ["assign", "Bontraco could not assign this call. Refresh call history and try again."],
  ["test", "Bontraco could not reach the test-call service. Check your connection and try again."],
];

describe("callErrorMessage", () => {
  it.each(expected)("returns a safe %s failure without backend details", (action, message) => {
    expect(callErrorMessage(action)).toBe(message);
  });

  it("keeps approved test-call guidance", () => {
    expect(testCallResponseMessage("This number is marked do not call in this workspace")).toBe(
      "This number is marked do not call in this workspace",
    );
  });

  it("keeps safe preflight and provider guidance", () => {
    expect(testCallResponseMessage("Could not verify test-call limit")).toBe(
      "Could not verify test-call limit",
    );
    expect(testCallResponseMessage("Test-call provider could not start the call")).toBe(
      "Test-call provider could not start the call",
    );
  });

  it("does not expose unknown test-call responses", () => {
    expect(testCallResponseMessage("provider internals secret-42")).toBe(
      "Bontraco could not start this test call. Review the settings and try again.",
    );
  });

  it("warns against retrying a started call whose history write is delayed", () => {
    expect(testCallSuccessMessage(false)).toBe(
      "Test call started, but call history is delayed. Do not retry.",
    );
    expect(testCallSuccessMessage(true)).toBe(
      "Test call started. It will appear in call history shortly.",
    );
  });

  it("warns before retrying uncertain timed-out receptionist actions", () => {
    const timeout = { code: "auth_request_timeout" };
    expect(callErrorMessage("settings", timeout)).toMatch(/may still be saved/);
    expect(callErrorMessage("assign", timeout)).toMatch(/may still be saved/);
    expect(callErrorMessage("test", timeout)).toMatch(/may still be starting/);
  });
});
