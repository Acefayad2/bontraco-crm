import { describe, expect, it } from "vitest";
import {
  buildDeliveryPayload,
  incidentCandidates,
} from "../../netlify/functions/operations-monitor.mjs";

describe("operations monitor", () => {
  it("creates deterministic incident fingerprints", () => {
    const incidents = incidentCandidates({
      leadRuns: [{ id: "scan-1", account_id: "account-1", started_at: "2026-09-09T10:00:00Z" }],
      billingEvents: [
        {
          stripe_event_id: "evt_1",
          event_type: "invoice.payment_failed",
          updated_at: "2026-09-09T10:01:00Z",
        },
      ],
      urgentCalls: [{ id: "call-1", account_id: "account-1", created_at: "2026-09-09T10:02:00Z" }],
      deletionRequests: [{ id: "delete-1", updated_at: "2026-09-09T10:03:00Z" }],
    });
    expect(incidents.map((incident) => incident.fingerprint)).toEqual([
      "lead_scan:scan-1",
      "billing_webhook:evt_1",
      "urgent_call:call-1",
      "account_purge:delete-1",
    ]);
    expect(incidents[3]).toMatchObject({
      kind: "account_purge_failed",
      severity: "critical",
      payload: {},
    });
  });

  it("sends only aggregate incident metadata externally", () => {
    const payload = buildDeliveryPayload([
      { kind: "urgent_call", severity: "critical", detected_at: "2026-09-09T10:00:00Z" },
      { kind: "urgent_call", severity: "critical", detected_at: "2026-09-09T10:01:00Z" },
      { kind: "lead_scan_failed", severity: "warning", detected_at: "2026-09-09T10:02:00Z" },
      {
        kind: "account_purge_failed",
        severity: "critical",
        detected_at: "2026-09-09T10:03:00Z",
      },
    ]);
    expect(payload.counts).toEqual({
      urgent_call: 2,
      lead_scan_failed: 1,
      account_purge_failed: 1,
    });
    expect(payload.severities).toEqual({ critical: 3, warning: 1 });
    expect(JSON.stringify(payload)).not.toMatch(/name|phone|email|summary|transcript|recording/i);
  });
});
