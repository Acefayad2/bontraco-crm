/* global process, Request */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import handler from "../../netlify/functions/receptionist-test-call.mjs";

const mocks = vi.hoisted(() => ({ createPhoneCall: vi.fn() }));

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
vi.mock("retell-sdk", () => ({
  default: class RetellMock {
    constructor() {
      this.call = { createPhoneCall: mocks.createPhoneCall };
    }
  },
}));

const accountId = "11111111-1111-4111-8111-111111111111";

function query(result) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    gte: () => builder,
    maybeSingle: async () => result,
    then: (resolve) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

function database({ countError = null, callError = null } = {}) {
  let callsQueryCount = 0;
  const from = vi.fn((table) => {
    if (table === "memberships") return query({ data: { account_id: accountId }, error: null });
    if (table === "receptionist_settings")
      return query({ data: { provider: "retell", phone_number: "+13125550100" }, error: null });
    if (table === "calls") {
      callsQueryCount += 1;
      if (callsQueryCount === 1) return query({ count: 0, error: countError });
      return { upsert: async () => ({ error: callError }) };
    }
    throw new Error(`Unexpected table ${table}`);
  });
  return {
    auth: { getUser: async () => ({ data: { user: { id: "owner-id" } }, error: null }) },
    rpc: async () => ({ data: false, error: null }),
    from,
  };
}

function request() {
  return new Request("https://example.com/.netlify/functions/receptionist-test-call", {
    method: "POST",
    headers: {
      authorization: "Bearer test-token",
      "content-type": "application/json",
      "x-bontraco-account-id": accountId,
    },
    body: JSON.stringify({ to_number: "+13125550199" }),
  });
}

describe("receptionist test-call safety boundary", () => {
  beforeEach(() => {
    process.env.RETELL_API_KEY = "test-retell-key";
    process.env.RETELL_AGENT_ID = "test-agent-id";
    process.env.RETELL_FROM_NUMBER = "+13125550100";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    mocks.createPhoneCall.mockReset();
    mocks.createPhoneCall.mockResolvedValue({ call_id: "provider-call-id" });
  });

  afterEach(() => {
    delete process.env.RETELL_API_KEY;
    delete process.env.RETELL_AGENT_ID;
    delete process.env.RETELL_FROM_NUMBER;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    vi.mocked(createClient).mockReset();
  });

  it("fails closed before provider spend when the daily limit cannot be verified", async () => {
    vi.mocked(createClient).mockReturnValue(database({ countError: new Error("private") }));

    const response = await handler(request());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Could not verify test-call limit" });
    expect(mocks.createPhoneCall).not.toHaveBeenCalled();
  });

  it("reports provider failure without exposing provider details", async () => {
    vi.mocked(createClient).mockReturnValue(database());
    mocks.createPhoneCall.mockRejectedValue(new Error("private provider detail"));

    const response = await handler(request());

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Test-call provider could not start the call",
    });
  });

  it("acknowledges a started but untracked call without encouraging a retry", async () => {
    vi.mocked(createClient).mockReturnValue(database({ callError: new Error("private") }));

    const response = await handler(request());

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      call_id: "provider-call-id",
      status: "started",
      tracked: false,
    });
  });

  it("marks a successfully persisted call as tracked", async () => {
    vi.mocked(createClient).mockReturnValue(database());

    const response = await handler(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      call_id: "provider-call-id",
      status: "started",
      tracked: true,
    });
  });
});
