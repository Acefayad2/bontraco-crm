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

import { TeamPage } from "./TeamPage";

const members = [
  {
    user_id: "owner-one",
    display_name: "Owner",
    email: "owner@example.com",
    role: "owner",
    active: true,
  },
  {
    user_id: "sales-one",
    display_name: "Salesperson",
    email: "sales@example.com",
    role: "sales",
    active: true,
  },
];

const invitations = [
  {
    id: "invite-one",
    email: "pending@example.com",
    role: "sales",
    expires_at: "2099-01-01T00:00:00.000Z",
  },
];

function resultBuilder(result: unknown) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    is: () => builder,
    gt: () => builder,
    order: () => Promise.resolve(result),
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

function teamClient({
  insert = Promise.resolve({ error: null }),
  update = Promise.resolve({ error: null }),
  remove = Promise.resolve({ error: null }),
}: {
  insert?: unknown;
  update?: unknown;
  remove?: unknown;
} = {}) {
  return {
    from: vi.fn((table: string) => {
      const readResult =
        table === "memberships"
          ? { data: members, error: null }
          : table === "invitations"
            ? { data: invitations, error: null }
            : table === "account_subscriptions"
              ? {
                  data: { plan_slug: "ai_pro", status: "active", grace_ends_at: null },
                  error: null,
                }
              : {
                  data: [{ slug: "ai_pro", display_name: "AI Pro", included_users: 10 }],
                  error: null,
                };
      const reader = resultBuilder(readResult);
      return {
        ...reader,
        insert: () => insert,
        update: () => mutationBuilder(update),
        delete: () => mutationBuilder(remove),
      };
    }),
  };
}

async function renderLoadedTeam(client: ReturnType<typeof teamClient>) {
  mocks.getSupabase.mockResolvedValue(client);
  render(<TeamPage />);
  expect(await screen.findByText("owner@example.com")).toBeInTheDocument();
}

describe("TeamPage request recovery", () => {
  beforeEach(() => {
    mocks.getSupabase.mockReset();
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => bytes,
      subtle: {
        digest: vi.fn().mockResolvedValue(new Uint8Array(32).buffer),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("releases the member list when the client is unavailable", async () => {
    mocks.getSupabase.mockResolvedValue(null);
    render(<TeamPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Bontraco could not load the team list.",
    );
    expect(screen.queryByText("Loading team members")).not.toBeInTheDocument();
  });

  it("releases a stalled initial team load", async () => {
    vi.useFakeTimers();
    const stalled = new Promise(() => undefined);
    mocks.getSupabase.mockResolvedValue({
      from: vi.fn(() => resultBuilder(stalled)),
    });
    render(<TeamPage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("Loading team members")).toBeInTheDocument();

    await act(async () => vi.advanceTimersByTimeAsync(authRequestTimeoutMs + 1));

    expect(screen.getByRole("alert")).toHaveTextContent("could not load the team list");
    expect(screen.queryByText("Loading team members")).not.toBeInTheDocument();
  });

  it("releases a stalled invitation without encouraging a duplicate", async () => {
    const stalled = new Promise(() => undefined);
    await renderLoadedTeam(teamClient({ insert: stalled }));
    vi.useFakeTimers();
    fireEvent.change(screen.getByRole("textbox", { name: "Work email" }), {
      target: { value: "new@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create invitation" }));
    expect(screen.getByRole("button", { name: "Creating invitation" })).toBeDisabled();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => vi.advanceTimersByTimeAsync(authRequestTimeoutMs + 1));

    expect(screen.getByRole("alert")).toHaveTextContent("invitation may still be created");
    expect(screen.getByRole("button", { name: "Create invitation" })).toBeEnabled();
  });

  it("releases a stalled teammate role change", async () => {
    const stalled = new Promise(() => undefined);
    await renderLoadedTeam(teamClient({ update: stalled }));
    vi.useFakeTimers();
    const role = screen.getByRole("combobox", { name: "Role for sales@example.com" });
    fireEvent.change(role, { target: { value: "dispatcher" } });
    expect(role).toBeDisabled();

    await act(async () => vi.advanceTimersByTimeAsync(authRequestTimeoutMs + 1));

    expect(screen.getByRole("alert")).toHaveTextContent("teammate change may still be saved");
    expect(role).toBeEnabled();
  });

  it("releases a stalled invitation cancellation", async () => {
    const stalled = new Promise(() => undefined);
    await renderLoadedTeam(teamClient({ remove: stalled }));
    vi.useFakeTimers();
    const cancel = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancel);
    expect(cancel).toBeDisabled();

    await act(async () => vi.advanceTimersByTimeAsync(authRequestTimeoutMs + 1));

    expect(screen.getByRole("alert")).toHaveTextContent("invitation may still be canceled");
    expect(cancel).toBeEnabled();
  });

  it("keeps a created invitation link when the following refresh fails", async () => {
    const client = teamClient();
    await renderLoadedTeam(client);
    mocks.getSupabase.mockReset().mockResolvedValueOnce(client).mockResolvedValueOnce(null);
    fireEvent.change(screen.getByRole("textbox", { name: "Work email" }), {
      target: { value: "new@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create invitation" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "invitation was created, but the team list could not refresh",
    );
    expect(screen.getByText("Secure invitation created")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create invitation" })).toBeEnabled();
  });
});
