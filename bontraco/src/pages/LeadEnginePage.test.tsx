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
    entitlements: ["core_crm", "lead_engine"],
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

import { LeadEnginePage, leadScanRequestTimeoutMs } from "./LeadEnginePage";

const profile = {
  id: "profile-one",
  name: "Fresh roofing requests",
  provider: "tavily",
  search_terms: ["need roofer"],
  geography: { city: "Chicago", region: "IL" },
  enabled: false,
  cadence_minutes: 15,
  max_age_days: 7,
  max_results_per_run: 20,
  daily_request_limit: 96,
  last_scanned_at: null,
  next_scan_at: "2099-01-01T00:00:00.000Z",
};

function resultBuilder(result: unknown) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => Promise.resolve(result),
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

function leadClient({
  insert = Promise.resolve({ error: null }),
  update = Promise.resolve({ error: null }),
}: { insert?: unknown; update?: unknown } = {}) {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "test-access-token" } },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      const readResult =
        table === "lead_source_profiles"
          ? { data: [profile], error: null }
          : { data: [], error: null };
      return {
        ...resultBuilder(readResult),
        insert: () => insert,
        update: () => mutationBuilder(update),
      };
    }),
  };
}

function providerResponse() {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue({
      providers: { public_web_search: true, google_places: true },
    }),
  };
}

async function renderLoadedEngine(client: ReturnType<typeof leadClient>) {
  mocks.getSupabase.mockResolvedValue(client);
  render(<LeadEnginePage />);
  expect(await screen.findByText("Fresh roofing requests")).toBeInTheDocument();
}

describe("LeadEnginePage request recovery", () => {
  beforeEach(() => {
    mocks.getSupabase.mockReset();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(providerResponse()));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("releases scan-health loading when the client is unavailable", async () => {
    mocks.getSupabase.mockResolvedValue(null);
    render(<LeadEnginePage />);

    expect(await screen.findByText("Bontraco could not load scan health.")).toBeInTheDocument();
    expect(screen.queryByText("Loading source profiles…")).not.toBeInTheDocument();
  });

  it("releases a stalled initial scan-health request", async () => {
    vi.useFakeTimers();
    const stalled = new Promise(() => undefined);
    mocks.getSupabase.mockResolvedValue({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }) },
      from: vi.fn(() => resultBuilder(stalled)),
    });
    render(<LeadEnginePage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("Loading source profiles…")).toBeInTheDocument();

    await act(async () => vi.advanceTimersByTimeAsync(authRequestTimeoutMs + 1));

    expect(screen.getByText("Bontraco could not load scan health.")).toBeInTheDocument();
    expect(screen.queryByText("Loading source profiles…")).not.toBeInTheDocument();
  });

  it("releases a stalled profile creation without encouraging a duplicate", async () => {
    const stalled = new Promise(() => undefined);
    await renderLoadedEngine(leadClient({ insert: stalled }));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "New search" }));
    fireEvent.click(screen.getByRole("button", { name: "Save paused search" }));
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();

    await act(async () => vi.advanceTimersByTimeAsync(authRequestTimeoutMs + 1));

    expect(screen.getByText(/search profile may still be created/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save paused search" })).toBeEnabled();
  });

  it("releases a stalled schedule change", async () => {
    const stalled = new Promise(() => undefined);
    await renderLoadedEngine(leadClient({ update: stalled }));
    vi.useFakeTimers();
    const toggle = screen.getByRole("button", { name: "Paused" });
    fireEvent.click(toggle);
    expect(toggle).toBeDisabled();

    await act(async () => vi.advanceTimersByTimeAsync(authRequestTimeoutMs + 1));

    expect(screen.getByText(/schedule may still be changed/)).toBeInTheDocument();
    expect(toggle).toBeEnabled();
  });

  it("releases a stalled manual scan after its longer provider deadline", async () => {
    const client = leadClient();
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockReset()
      .mockResolvedValueOnce(providerResponse() as unknown as Response)
      .mockImplementationOnce(() => new Promise(() => undefined))
      .mockResolvedValue(providerResponse() as unknown as Response);
    await renderLoadedEngine(client);
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Run now" }));
    expect(screen.getByRole("button", { name: "Scanning…" })).toBeDisabled();

    await act(async () => vi.advanceTimersByTimeAsync(leadScanRequestTimeoutMs + 1));

    expect(screen.getByText(/scan may still be running/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run now" })).toBeEnabled();
  });

  it("distinguishes successful profile creation from a failed refresh", async () => {
    const client = leadClient();
    await renderLoadedEngine(client);
    mocks.getSupabase.mockReset().mockResolvedValueOnce(client).mockResolvedValueOnce(null);
    fireEvent.click(screen.getByRole("button", { name: "New search" }));
    fireEvent.click(screen.getByRole("button", { name: "Save paused search" }));

    expect(
      await screen.findByText(
        "The search profile was created, but Lead Engine could not refresh. Reload Bontraco.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save paused search" })).not.toBeInTheDocument();
  });
});
