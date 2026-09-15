import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authRequestTimeoutMs } from "../lib/auth-request-deadline";

const mocks = vi.hoisted(() => ({
  getSupabase: vi.fn(),
  refresh: vi.fn(),
  workspace: {
    id: "account-one",
    name: "Ace Roofing",
    slug: "ace-roofing",
    trades: ["roofing"],
    role: "owner" as const,
    entitlements: ["core_crm"],
  },
}));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ demoMode: false }),
}));

vi.mock("../workspace/WorkspaceContext", () => ({
  useWorkspace: () => ({ workspace: mocks.workspace, refresh: mocks.refresh }),
}));

vi.mock("../lib/supabase", () => ({
  getSupabase: mocks.getSupabase,
}));

import { exportRequestTimeoutMs, importRequestTimeoutMs, SettingsPage } from "./SettingsPage";

function queryBuilder(result: unknown) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => builder,
    single: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

function settingsClient(
  updateResult: Promise<{ error: unknown }>,
  options: {
    deletionData?: Record<string, unknown> | null;
    legalName?: string;
    rpcResult?: Promise<{ data: unknown; error: unknown }>;
    stripeCustomerId?: string | null;
  } = {},
) {
  const subscription = {
    data: {
      plan_slug: "ai_pro",
      status: "active",
      trial_ends_at: null,
      current_period_ends_at: null,
      past_due_since: null,
      grace_ends_at: null,
      cancel_at_period_end: false,
      stripe_customer_id: options.stripeCustomerId || null,
    },
    error: null,
  };
  const account = {
    data: {
      legal_name: options.legalName || "Ace Roofing LLC",
      timezone: "America/Chicago",
      service_area: "Chicagoland",
      business_hours: "Monday-Friday",
      emergency_rules: null,
      business_phone: null,
      business_email: null,
      business_website: null,
      proposal_logo_path: null,
      proposal_accent_color: "#0F5B4F",
      estimate_default_tax_rate: 0,
      estimate_default_valid_days: 30,
      estimate_default_customer_note: null,
      estimate_default_terms: null,
    },
    error: null,
  };
  const plans = {
    data: [
      {
        slug: "ai_pro",
        display_name: "AI Pro",
        summary: "Complete platform",
        monthly_price_cents: 39900,
        included_users: 10,
        included_lead_profiles: 5,
      },
    ],
    error: null,
  };
  const update = vi.fn(() => ({
    eq: () => updateResult,
  }));
  const rpc = vi.fn(
    () => options.rpcResult || Promise.resolve({ data: "2026-09-28T00:00:00.000Z", error: null }),
  );
  return {
    update,
    rpc,
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
    from: vi.fn((table: string) => {
      if (table === "account_subscriptions") return queryBuilder(subscription);
      if (table === "subscription_plans") return queryBuilder(plans);
      if (table === "account_deletion_requests")
        return queryBuilder({ data: options.deletionData || null, error: null });
      if (table === "data_import_batches") return queryBuilder({ data: [], error: null });
      return { ...queryBuilder(account), update };
    }),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function renderLoadedSettings(client: ReturnType<typeof settingsClient>) {
  mocks.getSupabase.mockResolvedValue(client);
  render(<SettingsPage />);
  expect(await screen.findByDisplayValue("Ace Roofing LLC")).toBeInTheDocument();
}

async function advanceRequestDeadline(timeoutMs = authRequestTimeoutMs) {
  await act(async () => vi.advanceTimersByTimeAsync(timeoutMs + 1));
}

describe("SettingsPage request recovery", () => {
  beforeEach(() => {
    mocks.workspace = {
      id: "account-one",
      name: "Ace Roofing",
      slug: "ace-roofing",
      trades: ["roofing"],
      role: "owner",
      entitlements: ["core_crm"],
    };
    mocks.getSupabase.mockReset();
    mocks.refresh.mockReset().mockResolvedValue(undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          providers: {
            public_web_search: false,
            google_places: false,
            stripe: false,
            retell: false,
            operations_alerts: false,
          },
          receptionist_workspace: false,
        }),
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("fails closed when initial workspace settings stall", async () => {
    vi.useFakeTimers();
    mocks.getSupabase.mockReturnValue(new Promise(() => undefined));
    render(<SettingsPage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await advanceRequestDeadline();

    expect(
      screen.getByText("Workspace settings could not be loaded. Refresh Settings and try again."),
    ).toBeInTheDocument();
    expect(screen.getByText("No plan")).toBeInTheDocument();
  });

  it("ignores a late settings response from the previously selected workspace", async () => {
    const firstClient = deferred<ReturnType<typeof settingsClient>>();
    const oldClient = settingsClient(Promise.resolve({ error: null }), {
      legalName: "Old Company LLC",
    });
    const newClient = settingsClient(Promise.resolve({ error: null }), {
      legalName: "New Company LLC",
    });
    mocks.getSupabase.mockReturnValueOnce(firstClient.promise).mockResolvedValue(newClient);
    const view = render(<SettingsPage />);
    await act(async () => Promise.resolve());

    mocks.workspace = {
      id: "account-two",
      name: "New Company",
      slug: "new-company",
      trades: ["plumbing"],
      role: "owner",
      entitlements: ["core_crm"],
    };
    view.rerender(<SettingsPage />);
    expect(await screen.findByDisplayValue("New Company LLC")).toBeInTheDocument();

    firstClient.resolve(oldClient);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByDisplayValue("New Company LLC")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Old Company LLC")).not.toBeInTheDocument();
  });

  it("releases company controls after an uncertain stalled save", async () => {
    const client = settingsClient(new Promise(() => undefined));
    await renderLoadedSettings(client);
    vi.useFakeTimers();

    fireEvent.click(screen.getByRole("button", { name: "Save company" }));
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();

    await advanceRequestDeadline();

    expect(
      screen.getByText(
        "Company settings may still be saving. Refresh Settings before trying again.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save company" })).toBeEnabled();
    expect(client.update).toHaveBeenCalledTimes(1);
  });

  it("distinguishes a confirmed save from a stalled workspace refresh", async () => {
    const client = settingsClient(Promise.resolve({ error: null }));
    await renderLoadedSettings(client);
    mocks.refresh.mockReturnValue(new Promise(() => undefined));
    vi.useFakeTimers();

    fireEvent.click(screen.getByRole("button", { name: "Save company" }));
    await advanceRequestDeadline();

    expect(
      screen.getByText(
        "Company settings were saved, but the workspace could not refresh. Reload Bontraco.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save company" })).toBeEnabled();
  });

  it("releases deletion controls after an uncertain stalled request", async () => {
    const client = settingsClient(Promise.resolve({ error: null }), {
      rpcResult: new Promise(() => undefined),
    });
    await renderLoadedSettings(client);
    vi.useFakeTimers();

    fireEvent.click(screen.getByRole("button", { name: "Request deletion" }));
    fireEvent.change(screen.getByLabelText(/Type.*ace-roofing.*to confirm/), {
      target: { value: "ace-roofing" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start 14-day grace period" }));
    expect(screen.getByRole("button", { name: "Requesting…" })).toBeDisabled();

    await advanceRequestDeadline();

    expect(
      screen.getByText(
        "The deletion request may still be processing. Refresh Settings before trying again.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start 14-day grace period" })).toBeEnabled();
    expect(client.rpc).toHaveBeenCalledTimes(1);
  });

  it("releases cancellation after an uncertain stalled request", async () => {
    const client = settingsClient(Promise.resolve({ error: null }), {
      deletionData: {
        id: "deletion-one",
        status: "pending",
        requested_at: "2026-09-14T00:00:00.000Z",
        scheduled_for: "2026-09-28T00:00:00.000Z",
      },
      rpcResult: new Promise(() => undefined),
    });
    await renderLoadedSettings(client);
    expect(await screen.findByRole("button", { name: "Cancel deletion" })).toBeEnabled();
    vi.useFakeTimers();

    fireEvent.click(screen.getByRole("button", { name: "Cancel deletion" }));
    expect(screen.getByRole("button", { name: "Cancelling…" })).toBeDisabled();

    await advanceRequestDeadline();

    expect(
      screen.getByText(
        "The cancellation may still be processing. Refresh Settings before trying again.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel deletion" })).toBeEnabled();
    expect(client.rpc).toHaveBeenCalledTimes(1);
  });

  it("releases billing controls after a stalled portal request", async () => {
    const client = settingsClient(Promise.resolve({ error: null }), {
      stripeCustomerId: "customer-one",
    });
    await renderLoadedSettings(client);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    const stalledFetch = vi.fn(() => new Promise<Response>(() => undefined));
    vi.stubGlobal("fetch", stalledFetch);
    vi.useFakeTimers();

    fireEvent.click(screen.getByRole("button", { name: "Manage billing" }));
    expect(screen.getByRole("button", { name: "Opening…" })).toBeDisabled();

    await advanceRequestDeadline();

    expect(
      screen.getByText("Billing may still be opening. Refresh Settings before trying again."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manage billing" })).toBeEnabled();
    expect(stalledFetch).toHaveBeenCalledTimes(1);
  });

  it("rejects an untrusted billing redirect returned by the server", async () => {
    const client = settingsClient(Promise.resolve({ error: null }), {
      stripeCustomerId: "customer-one",
    });
    await renderLoadedSettings(client);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ url: "https://checkout.stripe.com.evil.example" }),
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Manage billing" }));

    expect(
      await screen.findByText("Bontraco could not open billing. Wait a moment and try again."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manage billing" })).toBeEnabled();
  });

  it("releases export controls without claiming a stalled download was saved", async () => {
    const client = settingsClient(Promise.resolve({ error: null }));
    await renderLoadedSettings(client);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    const stalledFetch = vi.fn(() => new Promise<Response>(() => undefined));
    vi.stubGlobal("fetch", stalledFetch);
    vi.useFakeTimers();

    fireEvent.click(screen.getByRole("button", { name: "Download export" }));
    expect(screen.getByRole("button", { name: "Preparing…" })).toBeDisabled();

    await advanceRequestDeadline(exportRequestTimeoutMs);

    expect(
      screen.getByText("The workspace export did not finish, so no file was saved. Try again."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download export" })).toBeEnabled();
    expect(screen.queryByText(/Workspace export downloaded/)).not.toBeInTheDocument();
    expect(stalledFetch).toHaveBeenCalledTimes(1);
  });

  it("releases import validation without claiming records were created", async () => {
    const client = settingsClient(Promise.resolve({ error: null }));
    await renderLoadedSettings(client);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    const stalledFetch = vi.fn(() => new Promise<Response>(() => undefined));
    vi.stubGlobal("fetch", stalledFetch);
    vi.useFakeTimers();
    const file = new File(["{}"], "abundant-export.json", { type: "application/json" });
    Object.defineProperty(file, "text", { value: vi.fn().mockResolvedValue("{}") });

    fireEvent.change(screen.getByLabelText(/Choose Abundant CRM JSON/), {
      target: { files: [file] },
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("Checking file…")).toBeInTheDocument();

    await advanceRequestDeadline(importRequestTimeoutMs);

    expect(
      screen.getByText("Import validation did not finish. No records were imported; try again."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Choose Abundant CRM JSON/)).toBeEnabled();
    expect(screen.queryByText(/Prototype customers and jobs imported/)).not.toBeInTheDocument();
    expect(stalledFetch).toHaveBeenCalledTimes(1);
  });

  it("releases preserved-lead import controls after an uncertain timeout", async () => {
    const client = settingsClient(Promise.resolve({ error: null }));
    await renderLoadedSettings(client);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    const stalledFetch = vi.fn(() => new Promise<Response>(() => undefined));
    vi.stubGlobal("fetch", stalledFetch);
    vi.useFakeTimers();

    fireEvent.click(screen.getByRole("button", { name: /Review lead import/ }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm import" }));
    expect(screen.getByRole("button", { name: "Importing…" })).toBeDisabled();

    await advanceRequestDeadline(importRequestTimeoutMs);

    expect(
      screen.getByText(
        "The preserved-lead import may still be processing. Refresh Leads before trying again.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm import" })).toBeEnabled();
    expect(screen.queryByText(/preserved leads were added/)).not.toBeInTheDocument();
    expect(stalledFetch).toHaveBeenCalledTimes(1);
  });
});
