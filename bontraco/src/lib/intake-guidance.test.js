import { describe, expect, it } from "vitest";
import { buildTradeIntakeGuidance } from "../../netlify/functions/retell-intake-guidance.mjs";

describe("receptionist trade intake guidance", () => {
  it("returns roofing and plumbing questions without unrelated electrical rules", () => {
    const guidance = buildTradeIntakeGuidance(["roofing", "plumbing"]);
    expect(guidance.rules.map((rule) => rule.trade)).toEqual(["roofing", "plumbing"]);
    expect(guidance.rules[0].urgent_signals).toContain("active interior leak");
    expect(guidance.rules[1].urgent_signals).toContain("sewage backup");
    expect(guidance.universal_actions.join(" ")).toContain("call 911");
  });

  it("falls back to general safety guidance for unknown or missing trades", () => {
    expect(buildTradeIntakeGuidance([]).rules[0].trade).toBe("general");
    expect(buildTradeIntakeGuidance(["unknown"]).rules[0].trade).toBe("general");
  });
});
