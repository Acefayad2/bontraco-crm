import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authRequestTimeoutMs } from "../lib/auth-request-deadline";

const mocks = vi.hoisted(() => ({
  getSupabase: vi.fn(),
  workspace: {
    id: "account-one",
    name: "Ace Roofing",
    slug: "ace-roofing",
    trades: ["roofing"],
    role: "owner" as const,
    entitlements: ["core_crm", "lead_engine", "ai_receptionist"],
  },
}));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    demoMode: false,
    signOut: vi.fn(),
    user: { id: "owner-one", email: "owner@example.com" },
  }),
}));

vi.mock("../workspace/WorkspaceContext", () => ({
  useWorkspace: () => ({
    error: "",
    loading: false,
    refresh: vi.fn(),
    selectWorkspace: vi.fn(),
    workspace: mocks.workspace,
    workspaceOptions: [mocks.workspace],
  }),
}));

vi.mock("../lib/supabase", () => ({
  getSupabase: mocks.getSupabase,
}));

vi.mock("../lib/workspace-auto-refresh", () => ({
  useWorkspaceAutoRefresh: vi.fn(),
}));

import { DashboardPage } from "./DashboardPage";

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

function queryResult(result: unknown) {
  const mutation = {
    eq: () => mutation,
    is: () => mutation,
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  const builder = {
    select: () => builder,
    eq: () => builder,
    not: () => builder,
    gte: () => builder,
    lt: () => builder,
    order: () => builder,
    limit: () => builder,
    update: () => mutation,
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

function dashboardClient(options: { stalled?: boolean; failedTable?: string } = {}) {
  const stalled = new Promise(() => undefined);
  let leadRequest = 0;
  return {
    from: vi.fn((table: string) => {
      if (options.stalled) return queryResult(stalled);
      if (table === "leads") leadRequest += 1;
      const data =
        table === "jobs"
          ? [
              {
                id: "job-one",
                title: "Roof replacement",
                stage: "inspection",
                estimated_value: 9000,
              },
            ]
          : table === "activities"
            ? [
                {
                  summary: "Lead assigned",
                  kind: "lead_assigned",
                  occurred_at: "2026-09-13T12:00:00.000Z",
                },
              ]
            : table === "notifications"
              ? [
                  {
                    id: "notification-one",
                    title: "New lead",
                    body: "A new lead is ready.",
                    kind: "new_lead",
                    metadata: null,
                    read_at: null,
                    created_at: "2026-09-13T12:00:00.000Z",
                  },
                ]
              : table === "contacts"
                ? [
                    {
                      id: "contact-one",
                      first_name: "Jordan",
                      last_name: "Homeowner",
                      phone: "5551234567",
                    },
                  ]
                : table === "calls"
                  ? []
                  : [];
      return queryResult({
        data,
        count:
          table === "leads" ? (leadRequest === 1 ? 2 : 1) : table === "appointments" ? 1 : null,
        error: options.failedTable === table ? new Error("query failed") : null,
      });
    }),
  };
}

async function advanceRequestDeadline(extraMs = 0) {
  await act(async () => vi.advanceTimersByTimeAsync(authRequestTimeoutMs + extraMs + 1));
}

describe("DashboardPage request recovery", () => {
  beforeEach(() => mocks.getSupabase.mockReset());

  afterEach(() => vi.useRealTimers());

  it("shows a retryable overview instead of zero metrics when the client is unavailable", async () => {
    mocks.getSupabase.mockResolvedValue(null);
    renderDashboard();

    expect(
      await screen.findByRole("heading", { name: "Overview unavailable" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("could not load the workspace overview");
    expect(screen.queryByLabelText("Workspace metrics")).not.toBeInTheDocument();
  });

  it("releases a stalled overview request", async () => {
    vi.useFakeTimers();
    mocks.getSupabase.mockResolvedValue(dashboardClient({ stalled: true }));
    renderDashboard();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await advanceRequestDeadline();

    expect(screen.getByRole("heading", { name: "Overview unavailable" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Workspace metrics")).not.toBeInTheDocument();
  });

  it("rejects an incomplete overview instead of presenting partial totals", async () => {
    mocks.getSupabase.mockResolvedValue(dashboardClient({ failedTable: "appointments" }));
    renderDashboard();

    expect(
      await screen.findByRole("heading", { name: "Overview unavailable" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Workspace metrics")).not.toBeInTheDocument();
  });

  it("releases a stalled workspace search without reporting no matches", async () => {
    const loadedClient = dashboardClient();
    mocks.getSupabase
      .mockResolvedValueOnce(loadedClient)
      .mockResolvedValueOnce(dashboardClient({ stalled: true }));
    renderDashboard();
    expect(await screen.findByLabelText("Workspace metrics")).toBeInTheDocument();
    vi.useFakeTimers();
    fireEvent.change(screen.getByRole("textbox", { name: "Search workspace" }), {
      target: { value: "Jordan" },
    });

    await advanceRequestDeadline(220);

    expect(screen.getByRole("alert")).toHaveTextContent("Workspace search is unavailable");
    expect(screen.queryByText("No matching customers, jobs, or calls.")).not.toBeInTheDocument();
  });

  it("releases a stalled notification update without encouraging a duplicate", async () => {
    const loadedClient = dashboardClient();
    mocks.getSupabase
      .mockResolvedValueOnce(loadedClient)
      .mockResolvedValueOnce(dashboardClient({ stalled: true }));
    renderDashboard();
    const notifications = await screen.findByRole("button", { name: "1 unread notifications" });
    fireEvent.click(notifications);
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Mark all read" }));
    expect(screen.getByRole("button", { name: "Marking read" })).toBeDisabled();

    await advanceRequestDeadline();

    expect(screen.getByRole("alert")).toHaveTextContent("may still be marked as read");
    expect(screen.getByRole("button", { name: "Mark all read" })).toBeEnabled();
  });
});
