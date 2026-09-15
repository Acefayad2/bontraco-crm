/* global process, Request */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import Retell from "retell-sdk";
import webhook from "../../netlify/functions/retell-webhook.mjs";

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
vi.mock("retell-sdk", () => ({ default: { verify: vi.fn(() => true) } }));

const accountId = "11111111-1111-4111-8111-111111111111";

function database({ usageError = null, eventError = null } = {}) {
  const usageUpsert = vi.fn(async () => ({ error: usageError }));
  const eventUpsert = vi.fn(async () => ({ error: eventError }));
  const from = vi.fn((table) => {
    if (table === "receptionist_settings") {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: { account_id: accountId } }),
      };
      return query;
    }
    if (table === "calls") {
      const result = {
        select: () => result,
        single: async () => ({ data: { id: "saved-call-id" }, error: null }),
      };
      return { upsert: () => result };
    }
    if (table === "call_usage") return { upsert: usageUpsert };
    if (table === "call_events") return { upsert: eventUpsert };
    throw new Error(`Unexpected table ${table}`);
  });
  return { client: { from }, usageUpsert, eventUpsert };
}

function analyzedCallRequest() {
  return new Request("https://example.com/.netlify/functions/retell-webhook", {
    method: "POST",
    headers: { "x-retell-signature": "valid-test-signature" },
    body: JSON.stringify({
      event: "call_analyzed",
      call: {
        call_id: "provider-call-id",
        metadata: { account_id: accountId },
        start_timestamp: 1_000,
        end_timestamp: 61_000,
        call_cost: { total_duration_seconds: 60, combined_cost: 25 },
      },
    }),
  });
}

describe("Retell webhook persistence acknowledgement", () => {
  beforeEach(() => {
    process.env.RETELL_API_KEY = "test-retell-key";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    vi.mocked(Retell.verify).mockClear();
  });

  afterEach(() => {
    delete process.env.RETELL_API_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    vi.mocked(createClient).mockReset();
  });

  it("requests a retry when usage persistence fails", async () => {
    const store = database({ usageError: new Error("private database detail") });
    vi.mocked(createClient).mockReturnValue(store.client);

    const response = await webhook(analyzedCallRequest());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Could not record call usage" });
    expect(store.eventUpsert).not.toHaveBeenCalled();
  });

  it("requests a retry when lifecycle-event persistence fails", async () => {
    const store = database({ eventError: new Error("private database detail") });
    vi.mocked(createClient).mockReturnValue(store.client);

    const response = await webhook(analyzedCallRequest());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Could not record call event" });
    expect(store.usageUpsert).toHaveBeenCalledOnce();
  });

  it("acknowledges only after call, usage, and event persistence succeed", async () => {
    const store = database();
    vi.mocked(createClient).mockReturnValue(store.client);

    const response = await webhook(analyzedCallRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });
    expect(store.usageUpsert).toHaveBeenCalledOnce();
    expect(store.eventUpsert).toHaveBeenCalledOnce();
  });
});
