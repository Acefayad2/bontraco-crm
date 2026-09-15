import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authRequestTimeoutMs } from "../lib/auth-request-deadline";

const mocks = vi.hoisted(() => ({
  getSupabase: vi.fn(),
  user: { id: "user-one" },
}));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ demoMode: false, user: mocks.user }),
}));

vi.mock("../lib/supabase", () => ({
  getSupabase: mocks.getSupabase,
}));

vi.mock("../lib/workspace-auto-refresh", () => ({
  useWorkspaceAutoRefresh: vi.fn(),
}));

import { WorkspaceProvider, useWorkspace } from "./WorkspaceContext";

function WorkspaceProbe() {
  const { error, loading, refresh, selectWorkspace, workspace, workspaceOptions } = useWorkspace();
  return (
    <div>
      <span>{loading ? "loading" : error || workspace?.name || "empty"}</span>
      <button onClick={() => void refresh()}>Refresh</button>
      {workspaceOptions.map((option) => (
        <button key={option.id} onClick={() => selectWorkspace(option.id)}>
          Select {option.name}
        </button>
      ))}
    </div>
  );
}

function renderWorkspace() {
  render(
    <WorkspaceProvider>
      <WorkspaceProbe />
    </WorkspaceProvider>,
  );
}

function membershipQuery(result: Promise<unknown> | unknown) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => result),
      })),
    })),
  };
}

describe("WorkspaceProvider access loading", () => {
  beforeEach(() => {
    mocks.getSupabase.mockReset();
  });

  afterEach(() => vi.useRealTimers());

  it("loads the selected membership and entitlements", async () => {
    mocks.getSupabase.mockResolvedValue({
      from: vi.fn(() =>
        membershipQuery({
          data: [
            {
              role: "owner",
              accounts: {
                id: "account-one",
                name: "Ace Roofing",
                slug: "ace-roofing",
                trades: ["roofing"],
              },
            },
          ],
          error: null,
        }),
      ),
      rpc: vi.fn((_name, args: { entitlement: string }) =>
        Promise.resolve({ data: args.entitlement === "core_crm", error: null }),
      ),
    });

    renderWorkspace();

    expect(await screen.findByText("Ace Roofing")).toBeInTheDocument();
  });

  it("releases loading when client creation is unavailable", async () => {
    mocks.getSupabase.mockResolvedValue(null);

    renderWorkspace();

    expect(
      await screen.findByText("We could not load your company workspace. Try again in a moment."),
    ).toBeInTheDocument();
    expect(screen.queryByText("loading")).not.toBeInTheDocument();
  });

  it("releases a stalled membership request at the shared deadline", async () => {
    vi.useFakeTimers();
    mocks.getSupabase.mockResolvedValue({
      from: vi.fn(() => membershipQuery(new Promise(() => undefined))),
      rpc: vi.fn(),
    });

    renderWorkspace();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("loading")).toBeInTheDocument();

    await act(async () => vi.advanceTimersByTimeAsync(authRequestTimeoutMs + 1));
    await act(async () => undefined);

    expect(
      screen.getByText("We could not load your company workspace. Try again in a moment."),
    ).toBeInTheDocument();
  });

  it("also bounds entitlement checks after membership succeeds", async () => {
    vi.useFakeTimers();
    mocks.getSupabase.mockResolvedValue({
      from: vi.fn(() =>
        membershipQuery({
          data: [
            {
              role: "sales",
              accounts: {
                id: "account-one",
                name: "Ace Roofing",
                slug: "ace-roofing",
                trades: ["roofing"],
              },
            },
          ],
          error: null,
        }),
      ),
      rpc: vi.fn(() => new Promise(() => undefined)),
    });

    renderWorkspace();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => vi.advanceTimersByTimeAsync(authRequestTimeoutMs + 1));
    await act(async () => undefined);

    expect(
      screen.getByText("We could not load your company workspace. Try again in a moment."),
    ).toBeInTheDocument();
  });

  it("does not misreport a failed entitlement check as a missing subscription", async () => {
    mocks.getSupabase.mockResolvedValue({
      from: vi.fn(() =>
        membershipQuery({
          data: [
            {
              role: "owner",
              accounts: {
                id: "account-one",
                name: "Ace Roofing",
                slug: "ace-roofing",
                trades: ["roofing"],
              },
            },
          ],
          error: null,
        }),
      ),
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: new Error("private entitlement provider detail"),
      }),
    });

    renderWorkspace();

    expect(
      await screen.findByText("We could not load your company workspace. Try again in a moment."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/private entitlement provider detail/)).not.toBeInTheDocument();
  });

  it("keeps the newly selected company when an older refresh finishes later", async () => {
    let resolveOlderRefresh: ((value: unknown) => void) | undefined;
    const olderRefresh = new Promise((resolve) => {
      resolveOlderRefresh = resolve;
    });
    const memberships = {
      data: [
        {
          role: "owner",
          accounts: {
            id: "account-one",
            name: "Ace Roofing",
            slug: "ace-roofing",
            trades: ["roofing"],
          },
        },
        {
          role: "admin",
          accounts: {
            id: "account-two",
            name: "Beta Plumbing",
            slug: "beta-plumbing",
            trades: ["plumbing"],
          },
        },
      ],
      error: null,
    };
    let membershipRequest = 0;
    mocks.getSupabase.mockResolvedValue({
      from: vi.fn(() => {
        membershipRequest += 1;
        return membershipQuery(membershipRequest === 2 ? olderRefresh : memberships);
      }),
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    });

    renderWorkspace();
    expect(await screen.findByText("Ace Roofing")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Select Beta Plumbing" }));
    expect(await screen.findByText("Beta Plumbing")).toBeInTheDocument();

    await act(async () => resolveOlderRefresh?.(memberships));

    expect(screen.getByText("Beta Plumbing")).toBeInTheDocument();
  });
});
