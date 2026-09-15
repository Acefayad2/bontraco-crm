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

import { TasksPage } from "./TasksPage";

const task = {
  id: "task-one",
  title: "Call homeowner",
  assigned_to: "owner-one",
  due_at: null,
  completed_at: null,
  job: null,
  lead: null,
};

function resultBuilder(result: unknown) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    not: () => builder,
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

function taskClient({
  read,
  insert = Promise.resolve({ error: null }),
  update = Promise.resolve({ error: null }),
}: { read?: unknown; insert?: unknown; update?: unknown } = {}) {
  return {
    from: vi.fn((table: string) => {
      const result =
        read ??
        (table === "tasks"
          ? { data: [task], error: null }
          : table === "memberships"
            ? {
                data: [
                  { user_id: "owner-one", display_name: "Owner One", email: "owner@example.com" },
                ],
                error: null,
              }
            : { data: [], error: null });
      return {
        ...resultBuilder(result),
        insert: () => insert,
        update: () => mutationBuilder(update),
      };
    }),
  };
}

async function renderLoadedTasks(client: ReturnType<typeof taskClient>) {
  mocks.getSupabase.mockResolvedValue(client);
  render(<TasksPage />);
  expect(await screen.findByText("Call homeowner")).toBeInTheDocument();
}

async function advanceRequestDeadline() {
  await act(async () => vi.advanceTimersByTimeAsync(authRequestTimeoutMs + 1));
}

describe("TasksPage request recovery", () => {
  beforeEach(() => mocks.getSupabase.mockReset());

  afterEach(() => vi.useRealTimers());

  it("releases task loading when the client is unavailable", async () => {
    mocks.getSupabase.mockResolvedValue(null);
    render(<TasksPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("could not load tasks");
    expect(screen.queryByText("Loading tasks")).not.toBeInTheDocument();
  });

  it("releases a stalled initial task request", async () => {
    vi.useFakeTimers();
    const stalled = new Promise(() => undefined);
    mocks.getSupabase.mockResolvedValue(taskClient({ read: stalled }));
    render(<TasksPage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("Loading tasks")).toBeInTheDocument();

    await advanceRequestDeadline();

    expect(screen.getByRole("alert")).toHaveTextContent("could not load tasks");
    expect(screen.queryByText("Loading tasks")).not.toBeInTheDocument();
  });

  it("releases stalled task creation without encouraging a duplicate", async () => {
    const stalled = new Promise(() => undefined);
    await renderLoadedTasks(taskClient({ insert: stalled }));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "New task" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Task" }), {
      target: { value: "Inspect roof" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save task" }));
    expect(screen.getByRole("button", { name: "Saving task" })).toBeDisabled();

    await advanceRequestDeadline();

    expect(screen.getByRole("alert")).toHaveTextContent("may still be created");
    expect(screen.getByRole("button", { name: "Save task" })).toBeEnabled();
  });

  it("releases a stalled task completion request", async () => {
    const stalled = new Promise(() => undefined);
    await renderLoadedTasks(taskClient({ update: stalled }));
    vi.useFakeTimers();
    const complete = screen.getByRole("button", { name: "Complete Call homeowner" });
    fireEvent.click(complete);
    expect(complete).toBeDisabled();

    await advanceRequestDeadline();

    expect(screen.getByRole("alert")).toHaveTextContent("may still be updated");
    expect(complete).toBeEnabled();
  });

  it("distinguishes successful creation from a failed task-list refresh", async () => {
    const client = taskClient();
    await renderLoadedTasks(client);
    mocks.getSupabase.mockReset().mockResolvedValueOnce(client).mockResolvedValueOnce(null);
    fireEvent.click(screen.getByRole("button", { name: "New task" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Task" }), {
      target: { value: "Inspect roof" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save task" }));

    expect(
      await screen.findByText(
        "The task was created, but the task list could not refresh. Reload Bontraco.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "New task" })).not.toBeInTheDocument();
  });
});
