/* global process, Request */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import Retell from "retell-sdk";
import { parseJsonObject } from "../../netlify/functions/_shared/json-payload.mjs";
import bookAppointment from "../../netlify/functions/retell-book-appointment.mjs";
import intakeGuidance from "../../netlify/functions/retell-intake-guidance.mjs";
import transferDestination from "../../netlify/functions/retell-transfer-destination.mjs";
import webhook from "../../netlify/functions/retell-webhook.mjs";

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
vi.mock("retell-sdk", () => ({ default: { verify: vi.fn(() => true) } }));

describe("server JSON object parsing", () => {
  it("accepts JSON objects without changing their contents", () => {
    expect(parseJsonObject('{"event":"call_started","call":{"call_id":"call-1"}}')).toEqual({
      event: "call_started",
      call: { call_id: "call-1" },
    });
  });

  it.each(["", "{not-json", "null", "[]", '"text"', "42"])(
    "rejects malformed or non-object payload %s",
    (rawBody) => {
      expect(parseJsonObject(rawBody)).toBeNull();
    },
  );
});

describe("signed Retell JSON boundaries", () => {
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
    vi.mocked(createClient).mockClear();
    vi.mocked(Retell.verify).mockClear();
  });

  afterEach(() => {
    delete process.env.RETELL_API_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it.each(handlers)("rejects malformed %s payloads before database access", async (_, handler) => {
    const response = await handler(
      new Request("https://example.com/.netlify/functions/retell", {
        method: "POST",
        headers: { "x-retell-signature": "valid-test-signature" },
        body: "{not-json",
      }),
    );

    expect(Retell.verify).toHaveBeenCalledOnce();
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Request body must be a JSON object",
    });
    expect(createClient).not.toHaveBeenCalled();
  });
});
