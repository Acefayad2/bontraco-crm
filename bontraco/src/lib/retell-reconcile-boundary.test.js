/* global process */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import handler from "../../netlify/functions/retell-reconcile.mjs";

const mocks = vi.hoisted(() => ({ retrieve: vi.fn(), constructor: vi.fn() }));

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
vi.mock("retell-sdk", () => ({
  default: class RetellMock {
    constructor() {
      mocks.constructor();
      this.call = { retrieve: mocks.retrieve };
    }
  },
}));

function query(result) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    gte: () => builder,
    limit: () => builder,
    in: () => builder,
    then: (resolve) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

function database(existingResult) {
  return {
    from: vi.fn((table) => {
      if (table === "calls")
        return query({
          data: [{ id: "call-row-id", account_id: "account-id", provider_call_id: "call-1" }],
          error: null,
        });
      if (table === "call_usage") return query(existingResult);
      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe("Retell reconciliation provider-spend boundary", () => {
  beforeEach(() => {
    process.env.RETELL_API_KEY = "test-retell-key";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    mocks.retrieve.mockReset();
    mocks.constructor.mockClear();
  });

  afterEach(() => {
    delete process.env.RETELL_API_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    vi.mocked(createClient).mockReset();
  });

  it("makes no provider requests when recorded usage cannot be queried", async () => {
    vi.mocked(createClient).mockReturnValue(
      database({ data: null, error: new Error("private database detail") }),
    );

    const response = await handler();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Call reconciliation failed" });
    expect(mocks.constructor).not.toHaveBeenCalled();
    expect(mocks.retrieve).not.toHaveBeenCalled();
  });

  it("skips provider requests for usage that is already recorded", async () => {
    vi.mocked(createClient).mockReturnValue(
      database({ data: [{ external_usage_id: "call-1" }], error: null }),
    );

    const response = await handler();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ checked: 1, missing: 0, reconciled: 0 });
    expect(mocks.constructor).toHaveBeenCalledOnce();
    expect(mocks.retrieve).not.toHaveBeenCalled();
  });
});
