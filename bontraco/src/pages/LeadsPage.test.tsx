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
    entitlements: ["core_crm"],
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

import { LeadsPage } from "./LeadsPage";

const lead = {
  id: "lead-one",
  assigned_to: null,
  contact_id: null,
  title: "Storm roof repair",
  status: "new",
  trade: "roofing",
  source: "manual",
  source_url: null,
  source_posted_at: "2026-09-13T12:00:00.000Z",
  discovered_at: "2026-09-13T12:00:00.000Z",
  contact_name: "Jordan Homeowner",
  contact_phone: "+13125550123",
  contact_email: "jordan@example.com",
  location_text: "Chicago, IL",
  score: 90,
};

function resultBuilder(result: unknown) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
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

function leadsClient({
  read,
  insert = Promise.resolve({ error: null }),
  update = Promise.resolve({ error: null }),
  conversion = Promise.resolve({ error: null }),
}: { read?: unknown; insert?: unknown; update?: unknown; conversion?: unknown } = {}) {
  return {
    from: vi.fn((table: string) => {
      const result =
        read ??
        (table === "leads"
          ? { data: [lead], error: null }
          : {
              data: [
                {
                  user_id: "sales-one",
                  display_name: "Sam Sales",
                  email: "sales@example.com",
                  role: "sales",
                },
              ],
              error: null,
            });
      return {
        ...resultBuilder(result),
        insert: () => insert,
        update: () => mutationBuilder(update),
      };
    }),
    rpc: vi.fn(() => conversion),
  };
}

async function renderLoadedLeads(client: ReturnType<typeof leadsClient>) {
  mocks.getSupabase.mockResolvedValue(client);
  render(<LeadsPage />);
  expect(await screen.findByText("Storm roof repair")).toBeInTheDocument();
}

async function advanceRequestDeadline() {
  await act(async () => vi.advanceTimersByTimeAsync(authRequestTimeoutMs + 1));
}

describe("LeadsPage request recovery", () => {
  beforeEach(() => {
    mocks.getSupabase.mockReset();
    vi.stubGlobal("crypto", { randomUUID: () => "manual-lead-one" });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("releases lead loading when the client is unavailable", async () => {
    mocks.getSupabase.mockResolvedValue(null);
    render(<LeadsPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("could not load leads");
    expect(screen.queryByText("Loading leads")).not.toBeInTheDocument();
  });

  it("releases a stalled initial lead request", async () => {
    vi.useFakeTimers();
    const stalled = new Promise(() => undefined);
    mocks.getSupabase.mockResolvedValue(leadsClient({ read: stalled }));
    render(<LeadsPage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("Loading leads")).toBeInTheDocument();

    await advanceRequestDeadline();

    expect(screen.getByRole("alert")).toHaveTextContent("could not load leads");
    expect(screen.queryByText("Loading leads")).not.toBeInTheDocument();
  });

  it("releases a stalled lead creation without encouraging a duplicate", async () => {
    const stalled = new Promise(() => undefined);
    await renderLoadedLeads(leadsClient({ insert: stalled }));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Add lead" }));
    fireEvent.change(screen.getByPlaceholderText("Roof repair requested after storm"), {
      target: { value: "New roof request" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save lead" }));
    expect(screen.getByRole("button", { name: "Saving lead" })).toBeDisabled();

    await advanceRequestDeadline();

    expect(screen.getByRole("alert")).toHaveTextContent("may still be created");
    expect(screen.getByRole("button", { name: "Save lead" })).toBeEnabled();
  });

  it("releases a stalled lead status change", async () => {
    const stalled = new Promise(() => undefined);
    await renderLoadedLeads(leadsClient({ update: stalled }));
    vi.useFakeTimers();
    const status = screen.getByRole("combobox", { name: "Status for Storm roof repair" });
    fireEvent.change(status, { target: { value: "qualified" } });
    expect(status).toBeDisabled();

    await advanceRequestDeadline();

    expect(screen.getByRole("alert")).toHaveTextContent("status may still be updated");
    expect(status).toBeEnabled();
  });

  it("releases a stalled lead assignment", async () => {
    const stalled = new Promise(() => undefined);
    await renderLoadedLeads(leadsClient({ update: stalled }));
    vi.useFakeTimers();
    const assignee = screen.getByRole("combobox", { name: "Assignee for Storm roof repair" });
    fireEvent.change(assignee, { target: { value: "sales-one" } });
    expect(assignee).toBeDisabled();

    await advanceRequestDeadline();

    expect(screen.getByRole("alert")).toHaveTextContent("assignment may still be saved");
    expect(assignee).toBeEnabled();
  });

  it("releases a stalled atomic lead conversion", async () => {
    const stalled = new Promise(() => undefined);
    await renderLoadedLeads(leadsClient({ conversion: stalled }));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: /Convert/ }));
    fireEvent.click(screen.getByRole("button", { name: "Create customer & job" }));
    expect(screen.getByRole("button", { name: "Creating records…" })).toBeDisabled();

    await advanceRequestDeadline();

    expect(screen.getByRole("alert")).toHaveTextContent("may still be converting");
    expect(screen.getByRole("button", { name: "Create customer & job" })).toBeEnabled();
  });

  it("distinguishes successful creation from a failed list refresh", async () => {
    const client = leadsClient();
    await renderLoadedLeads(client);
    mocks.getSupabase.mockReset().mockResolvedValueOnce(client).mockResolvedValueOnce(null);
    fireEvent.click(screen.getByRole("button", { name: "Add lead" }));
    fireEvent.change(screen.getByPlaceholderText("Roof repair requested after storm"), {
      target: { value: "New roof request" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save lead" }));

    expect(
      await screen.findByText(
        "The lead was created, but the lead list could not refresh. Reload Bontraco.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Add a lead" })).not.toBeInTheDocument();
  });
});
