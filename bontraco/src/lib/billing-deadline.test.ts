import { describe, expect, it } from "vitest";
import { getBillingDeadline } from "./billing-deadline";

const base = {
  trial_ends_at: "2026-09-20T00:00:00Z",
  current_period_ends_at: "2026-10-01T00:00:00Z",
  grace_ends_at: "2026-09-16T00:00:00Z",
};

describe("billing deadline", () => {
  it("prioritizes the payment grace deadline for past-due subscriptions", () => {
    expect(getBillingDeadline({ ...base, status: "past_due" })).toEqual({
      label: "Grace period ends",
      date: base.grace_ends_at,
    });
  });

  it("uses the trial deadline during a trial", () => {
    expect(getBillingDeadline({ ...base, status: "trialing" })).toEqual({
      label: "Trial ends",
      date: base.trial_ends_at,
    });
  });

  it("falls back to the current billing period", () => {
    expect(getBillingDeadline({ ...base, status: "active" })).toEqual({
      label: "Current period ends",
      date: base.current_period_ends_at,
    });
  });
});
