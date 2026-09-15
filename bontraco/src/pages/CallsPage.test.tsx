import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authRequestTimeoutMs } from "../lib/auth-request-deadline";

const mocks = vi.hoisted(() => ({
  getSupabase: vi.fn(),
  user: { id: "owner-one", email: "owner@example.com" },
  workspace: {
    id: "account-one",
    name: "Ace Roofing",
    slug: "ace-roofing",
    trades: ["roofing"],
    role: "owner" as const,
    entitlements: ["core_crm", "ai_receptionist"],
  },
}));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ demoMode: false, user: mocks.user }),
}));

vi.mock("../workspace/WorkspaceContext", () => ({
  useWorkspace: () => ({ workspace: mocks.workspace }),
}));

vi.mock("../lib/supabase", () => ({
  getSupabase: mocks.getSupabase,
}));

vi.mock("../lib/workspace-auto-refresh", () => ({
  useWorkspaceAutoRefresh: vi.fn(),
}));

import { CallsPage, testCallRequestTimeoutMs } from "./CallsPage";

const call = {
  id: "call-one",
  assigned_to: null,
  caller_name: "Jordan Homeowner",
  from_number: "+13125550123",
  status: "completed",
  disposition: "estimate_requested",
  summary: "Caller requested a roofing estimate.",
  duration_seconds: 90,
  started_at: "2026-09-13T12:00:00.000Z",
  emergency_flag: false,
};

function resultBuilder(result: unknown) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => Promise.resolve(result),
    gte: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

function mutationBuilder(result: unknown) {
  const builder = {
    eq: () => builder,
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

function callsClient({
  read,
  upsert = Promise.resolve({ error: null }),
  update = Promise.resolve({ error: null }),
}: { read?: unknown; upsert?: unknown; update?: unknown } = {}) {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "test-access-token" } },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      const result =
        read ??
        (table === "calls"
          ? { data: [call], error: null }
          : table === "memberships"
            ? {
                data: [
                  {
                    user_id: "sales-one",
                    display_name: "Sam Sales",
                    email: "sales@example.com",
                    role: "sales",
                  },
                ],
                error: null,
              }
            : table === "receptionist_settings"
              ? {
                  data: {
                    enabled: true,
                    provider: "retell",
                    phone_number: "+13125550100",
                    transfer_number: "+13125550101",
                    greeting: "Thank you for calling.",
                    recording_enabled: false,
                  },
                  error: null,
                }
              : { data: [], error: null });
      return {
        ...resultBuilder(result),
        upsert: () => upsert,
        update: () => mutationBuilder(update),
      };
    }),
  };
}

async function renderLoadedCalls(client: ReturnType<typeof callsClient>) {
  mocks.getSupabase.mockResolvedValue(client);
  render(<CallsPage />);
  expect(await screen.findByText("Jordan Homeowner")).toBeInTheDocument();
}

describe("CallsPage request recovery", () => {
  beforeEach(() => {
    mocks.getSupabase.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ tracked: true }),
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("releases call-history loading when the client is unavailable", async () => {
    mocks.getSupabase.mockResolvedValue(null);
    render(<CallsPage />);

    expect(await screen.findByText("Bontraco could not load call history.")).toBeInTheDocument();
    expect(screen.queryByText("Loading call history…")).not.toBeInTheDocument();
  });

  it("releases a stalled initial call-history request", async () => {
    vi.useFakeTimers();
    const stalled = new Promise(() => undefined);
    mocks.getSupabase.mockResolvedValue(callsClient({ read: stalled }));
    render(<CallsPage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("Loading call history…")).toBeInTheDocument();

    await act(async () => vi.advanceTimersByTimeAsync(authRequestTimeoutMs + 1));

    expect(screen.getByText("Bontraco could not load call history.")).toBeInTheDocument();
    expect(screen.queryByText("Loading call history…")).not.toBeInTheDocument();
  });

  it("releases a stalled settings save without encouraging a duplicate", async () => {
    const stalled = new Promise(() => undefined);
    await renderLoadedCalls(callsClient({ upsert: stalled }));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();

    await act(async () => vi.advanceTimersByTimeAsync(authRequestTimeoutMs + 1));

    expect(screen.getByText(/settings may still be saved/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save settings" })).toBeEnabled();
  });

  it("releases a stalled call assignment", async () => {
    const stalled = new Promise(() => undefined);
    await renderLoadedCalls(callsClient({ update: stalled }));
    vi.useFakeTimers();
    const assignee = screen.getByRole("combobox", { name: /Assignee for call from/ });
    fireEvent.change(assignee, { target: { value: "sales-one" } });
    expect(assignee).toBeDisabled();

    await act(async () => vi.advanceTimersByTimeAsync(authRequestTimeoutMs + 1));

    expect(screen.getByText(/assignment may still be saved/)).toBeInTheDocument();
    expect(assignee).toBeEnabled();
  });

  it("releases a stalled provider-backed test call after its longer deadline", async () => {
    await renderLoadedCalls(callsClient());
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(() => undefined));
    vi.useFakeTimers();
    fireEvent.change(screen.getByRole("textbox", { name: "Test call number" }), {
      target: { value: "+13125550123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Place test call" }));
    expect(screen.getByRole("button", { name: "Working…" })).toBeDisabled();

    await act(async () => vi.advanceTimersByTimeAsync(testCallRequestTimeoutMs + 1));

    expect(screen.getByText(/test call may still be starting/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Place test call" })).toBeEnabled();
  });
});
