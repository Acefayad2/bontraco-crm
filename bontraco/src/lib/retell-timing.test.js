/* global process, Request */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  isoFromMilliseconds,
  normalizeCallTiming,
} from "../../netlify/functions/_shared/retell-timing.mjs";
import bookAppointment from "../../netlify/functions/retell-book-appointment.mjs";
import webhook from "../../netlify/functions/retell-webhook.mjs";

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
vi.mock("retell-sdk", () => ({ default: { verify: vi.fn(() => true) } }));

describe("Retell call timing normalization", () => {
  it("normalizes valid millisecond timestamps and duration", () => {
    expect(
      normalizeCallTiming(
        { start_timestamp: 1_000, end_timestamp: 61_000 },
        "2026-09-12T10:00:00.000Z",
      ),
    ).toEqual({
      startedAt: "1970-01-01T00:00:01.000Z",
      endedAt: "1970-01-01T00:01:01.000Z",
      durationSeconds: 60,
    });
  });

  it("uses receipt time only when the start timestamp is omitted", () => {
    expect(normalizeCallTiming({}, "2026-09-12T10:00:00.000Z")).toEqual({
      startedAt: "2026-09-12T10:00:00.000Z",
      endedAt: null,
      durationSeconds: null,
    });
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, "1000", {}, []])(
    "rejects invalid supplied millisecond value %s",
    (value) => {
      expect(isoFromMilliseconds(value)).toBeUndefined();
    },
  );

  it("rejects an end timestamp before the start timestamp", () => {
    expect(normalizeCallTiming({ start_timestamp: 61_000, end_timestamp: 1_000 })).toBeNull();
  });
});

describe("Retell handler timing boundary", () => {
  beforeEach(() => {
    process.env.RETELL_API_KEY = "test-retell-key";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    vi.mocked(createClient).mockClear();
  });

  afterEach(() => {
    delete process.env.RETELL_API_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it.each([
    ["webhook", webhook],
    ["appointment booking", bookAppointment],
  ])("rejects invalid %s timestamps before database access", async (kind, handler) => {
    const response = await handler(
      new Request(`https://example.com/.netlify/functions/${kind}`, {
        method: "POST",
        headers: { "x-retell-signature": "valid-test-signature" },
        body: JSON.stringify({
          event: "call_started",
          call: { call_id: "provider-call-id", start_timestamp: "not-a-number" },
          args: { start_time: "2026-09-12T10:00:00.000Z" },
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Call timestamps are invalid" });
    expect(createClient).not.toHaveBeenCalled();
  });
});
