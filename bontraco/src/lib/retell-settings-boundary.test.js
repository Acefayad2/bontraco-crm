/* global process, Request */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import Retell from "retell-sdk";
import bookAppointment from "../../netlify/functions/retell-book-appointment.mjs";
import intakeGuidance from "../../netlify/functions/retell-intake-guidance.mjs";
import transferDestination from "../../netlify/functions/retell-transfer-destination.mjs";
import webhook from "../../netlify/functions/retell-webhook.mjs";

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
vi.mock("retell-sdk", () => ({ default: { verify: vi.fn(() => true) } }));

const accountId = "11111111-1111-4111-8111-111111111111";

function failingSettingsClient() {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: null, error: new Error("private database detail") }),
  };
  return { from: vi.fn(() => query) };
}

function requestFor(kind) {
  const call = { call_id: "provider-call-id", metadata: { account_id: accountId } };
  return new Request(`https://example.com/.netlify/functions/${kind}`, {
    method: "POST",
    headers: { "x-retell-signature": "valid-test-signature" },
    body: JSON.stringify({
      event: "call_started",
      call,
      args: { start_time: "2026-09-12T10:00:00.000Z" },
    }),
  });
}

describe("Retell settings lookup boundary", () => {
  const handlers = [
    ["webhook", webhook],
    ["appointment booking", bookAppointment],
    ["intake guidance", intakeGuidance],
    ["transfer destination", transferDestination],
  ];

  beforeEach(() => {
    process.env.RETELL_API_KEY = "test-retell-key";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    vi.mocked(Retell.verify).mockClear();
    vi.mocked(createClient).mockImplementation(failingSettingsClient);
  });

  afterEach(() => {
    delete process.env.RETELL_API_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    vi.mocked(createClient).mockReset();
  });

  it.each(handlers)(
    "distinguishes %s database failure from missing settings",
    async (kind, handler) => {
      const response = await handler(requestFor(kind));

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({
        error: "Could not load receptionist settings",
      });
    },
  );
});
