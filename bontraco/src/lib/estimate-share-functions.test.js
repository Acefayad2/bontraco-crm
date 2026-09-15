import { describe, expect, it } from "vitest";
import {
  bodyWithinLimit,
  normalizeAcceptance,
  publicEstimateAcceptanceError,
  validEstimateId,
  validShareToken,
} from "../../netlify/functions/_shared/estimate-share.mjs";

describe("estimate share function validation", () => {
  it("accepts only UUID estimate identifiers", () => {
    expect(validEstimateId("30000000-0000-4000-8000-000000000001")).toBe(true);
    expect(validEstimateId("demo-estimate")).toBe(false);
    expect(validEstimateId("30000000-0000-0000-0000-000000000001")).toBe(false);
  });

  it("accepts only 32-byte base64url customer tokens", () => {
    expect(validShareToken("a".repeat(43))).toBe(true);
    expect(validShareToken("a".repeat(42))).toBe(false);
    expect(validShareToken(`${"a".repeat(42)}+`)).toBe(false);
  });

  it("normalizes valid acceptance evidence and rejects missing acknowledgment", () => {
    expect(
      normalizeAcceptance({
        signer_name: "  Taylor Customer  ",
        signer_email: " TAYLOR@EXAMPLE.COM ",
        acknowledged: true,
      }),
    ).toEqual({ signerName: "Taylor Customer", signerEmail: "taylor@example.com" });
    expect(normalizeAcceptance({ signer_name: "Taylor Customer" })).toEqual({
      error: "Confirm that you reviewed and accept the estimate.",
    });
  });

  it("returns only approved public acceptance errors", () => {
    expect(
      publicEstimateAcceptanceError(new Error("Estimate is no longer open for acceptance")),
    ).toBe("This estimate link is unavailable or expired.");
    expect(publicEstimateAcceptanceError(new Error("Signer email is invalid"))).toBe(
      "Enter a valid email address or leave it blank.",
    );
    expect(publicEstimateAcceptanceError(new Error("private policy secret-42"))).toBe(
      "Estimate acceptance failed",
    );
  });

  it("enforces declared request body limits", () => {
    expect(
      bodyWithinLimit(
        new globalThis.Request("https://example.test", { headers: { "content-length": "99" } }),
        100,
      ),
    ).toBe(true);
    expect(
      bodyWithinLimit(
        new globalThis.Request("https://example.test", { headers: { "content-length": "101" } }),
        100,
      ),
    ).toBe(false);
  });
});
