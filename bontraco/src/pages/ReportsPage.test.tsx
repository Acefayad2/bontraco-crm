import { act, render, screen } from "@testing-library/react";
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
    entitlements: ["core_crm"],
  },
}));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ demoMode: false }),
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

import { ReportsPage } from "./ReportsPage";

const reportRows: Record<string, unknown[]> = {
  leads: [{ status: "qualified" }, { status: "new" }],
  jobs: [{ estimated_value: 12500 }],
  estimates: [{ status: "accepted" }],
  invoices: [{ total: 7000 }],
  payments: [{ amount: 5000, status: "succeeded" }],
  calls: [{ status: "completed" }, { status: "missed" }],
};

function queryResult(result: unknown) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    gte: () => builder,
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

function reportClient(options: { stalled?: boolean; failedTable?: string } = {}) {
  const stalled = new Promise(() => undefined);
  return {
    from: vi.fn((table: string) =>
      queryResult(
        options.stalled
          ? stalled
          : {
              data: reportRows[table] || [],
              error: options.failedTable === table ? new Error("query failed") : null,
            },
      ),
    ),
  };
}

async function advanceRequestDeadline() {
  await act(async () => vi.advanceTimersByTimeAsync(authRequestTimeoutMs + 1));
}

describe("ReportsPage request recovery", () => {
  beforeEach(() => mocks.getSupabase.mockReset());

  afterEach(() => vi.useRealTimers());

  it("releases report loading when the client is unavailable", async () => {
    mocks.getSupabase.mockResolvedValue(null);
    render(<ReportsPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("could not be loaded");
    expect(screen.queryByText("Calculating workspace performance…")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export unavailable" })).toBeDisabled();
  });

  it("releases a stalled report request", async () => {
    vi.useFakeTimers();
    mocks.getSupabase.mockResolvedValue(reportClient({ stalled: true }));
    render(<ReportsPage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("Calculating workspace performance…")).toBeInTheDocument();

    await advanceRequestDeadline();

    expect(screen.getByRole("alert")).toHaveTextContent("could not be loaded");
    expect(screen.queryByText("Calculating workspace performance…")).not.toBeInTheDocument();
  });

  it("does not display or export a partial report", async () => {
    mocks.getSupabase.mockResolvedValue(reportClient({ failedTable: "payments" }));
    render(<ReportsPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("could not be loaded");
    expect(screen.getByText("Report unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Pipeline created")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export unavailable" })).toBeDisabled();
  });

  it("enables export only after every report source succeeds", async () => {
    mocks.getSupabase.mockResolvedValue(reportClient());
    render(<ReportsPage />);

    expect(await screen.findByText("$12,500")).toBeInTheDocument();
    expect(screen.getByText("$7,000")).toBeInTheDocument();
    expect(screen.getByText("$5,000")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeEnabled();
  });
});
