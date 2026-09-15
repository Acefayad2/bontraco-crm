import { describe, expect, it } from "vitest";
import { normalizeEmail, normalizeUsPhone } from "./communication-preferences";

describe("communication preference destinations", () => {
  it("normalizes common US phone formats to E.164", () => {
    expect(normalizeUsPhone("(630) 555-0186")).toBe("+16305550186");
    expect(normalizeUsPhone("1-312-555-0139")).toBe("+13125550139");
    expect(normalizeUsPhone("+13125550139")).toBe("+13125550139");
  });

  it("rejects phone numbers that cannot be safely normalized", () => {
    expect(normalizeUsPhone("555-0199")).toBeNull();
    expect(normalizeUsPhone(null)).toBeNull();
  });

  it("normalizes valid email and rejects malformed email", () => {
    expect(normalizeEmail("  Crew@Example.COM ")).toBe("crew@example.com");
    expect(normalizeEmail("not-an-email")).toBeNull();
  });
});
