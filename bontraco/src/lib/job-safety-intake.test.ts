import { describe, expect, it } from "vitest";
import {
  formatSafetyIntakeValue,
  getSafetyIntakeFields,
  hasUrgentSafetySignal,
} from "./job-safety-intake";

describe("job safety intake", () => {
  it("adds trade-specific questions to the common intake", () => {
    const plumbing = getSafetyIntakeFields("plumbing").map((field) => field.key);
    const electrical = getSafetyIntakeFields("electrical").map((field) => field.key);

    expect(plumbing).toContain("site_occupied");
    expect(plumbing).toContain("sewage_backup");
    expect(electrical).toContain("sparks_or_arcing");
    expect(electrical).not.toContain("sewage_backup");
  });

  it("detects only configured urgent signals", () => {
    expect(hasUrgentSafetySignal("plumbing", { gas_odor: true })).toBe(true);
    expect(hasUrgentSafetySignal("plumbing", { site_occupied: true })).toBe(false);
    expect(hasUrgentSafetySignal("electrical", { sparks_or_arcing: true })).toBe(true);
    expect(hasUrgentSafetySignal("roofing", {})).toBe(false);
  });

  it("formats boolean and text answers for job details", () => {
    const checkbox = getSafetyIntakeFields("electrical").find(
      (field) => field.key === "power_isolated",
    )!;
    const text = getSafetyIntakeFields("electrical").find(
      (field) => field.key === "panel_location",
    )!;

    expect(formatSafetyIntakeValue(checkbox, true)).toBe("Yes");
    expect(formatSafetyIntakeValue(checkbox, false)).toBe("No");
    expect(formatSafetyIntakeValue(text, "  Basement  ")).toBe("Basement");
  });
});
