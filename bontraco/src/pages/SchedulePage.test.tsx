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

import { SchedulePage } from "./SchedulePage";

const appointment = {
  id: "appointment-one",
  assigned_to: null,
  title: "Roof inspection",
  starts_at: "2099-09-13T12:00:00.000Z",
  ends_at: "2099-09-13T13:00:00.000Z",
  status: "scheduled",
  notes: null,
  job: { title: "Storm repair" },
  contact: { first_name: "Jordan", last_name: "Homeowner", company_name: null },
};

function resultBuilder(result: unknown) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    gte: () => builder,
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

function scheduleClient({
  read,
  insert = Promise.resolve({ error: null }),
  update = Promise.resolve({ error: null }),
}: { read?: unknown; insert?: unknown; update?: unknown } = {}) {
  return {
    from: vi.fn((table: string) => {
      const result =
        read ??
        (table === "appointments"
          ? { data: [appointment], error: null }
          : table === "contacts"
            ? {
                data: [
                  {
                    id: "contact-one",
                    first_name: "Jordan",
                    last_name: "Homeowner",
                    company_name: null,
                  },
                ],
                error: null,
              }
            : table === "jobs"
              ? { data: [{ id: "job-one", title: "Storm repair" }], error: null }
              : {
                  data: [
                    {
                      user_id: "sales-one",
                      display_name: "Sam Sales",
                      email: "sales@example.com",
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
  };
}

async function renderLoadedSchedule(client: ReturnType<typeof scheduleClient>) {
  mocks.getSupabase.mockResolvedValue(client);
  render(<SchedulePage />);
  expect(await screen.findByText("Roof inspection")).toBeInTheDocument();
}

async function advanceRequestDeadline() {
  await act(async () => vi.advanceTimersByTimeAsync(authRequestTimeoutMs + 1));
}

describe("SchedulePage request recovery", () => {
  beforeEach(() => mocks.getSupabase.mockReset());

  afterEach(() => vi.useRealTimers());

  it("releases schedule loading when the client is unavailable", async () => {
    mocks.getSupabase.mockResolvedValue(null);
    render(<SchedulePage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("could not load the schedule");
    expect(screen.queryByText("Loading schedule")).not.toBeInTheDocument();
  });

  it("releases a stalled initial schedule request", async () => {
    vi.useFakeTimers();
    const stalled = new Promise(() => undefined);
    mocks.getSupabase.mockResolvedValue(scheduleClient({ read: stalled }));
    render(<SchedulePage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("Loading schedule")).toBeInTheDocument();

    await advanceRequestDeadline();

    expect(screen.getByRole("alert")).toHaveTextContent("could not load the schedule");
    expect(screen.queryByText("Loading schedule")).not.toBeInTheDocument();
  });

  it("releases a stalled appointment creation without encouraging a duplicate", async () => {
    const stalled = new Promise(() => undefined);
    await renderLoadedSchedule(scheduleClient({ insert: stalled }));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "New appointment" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Appointment title" }), {
      target: { value: "New inspection" },
    });
    fireEvent.change(screen.getByLabelText("Starts"), {
      target: { value: "2099-09-14T12:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save appointment" }));
    expect(screen.getByRole("button", { name: "Saving appointment" })).toBeDisabled();

    await advanceRequestDeadline();

    expect(screen.getByRole("alert")).toHaveTextContent("may still be scheduled");
    expect(screen.getByRole("button", { name: "Save appointment" })).toBeEnabled();
  });

  it("releases a stalled appointment status change", async () => {
    const stalled = new Promise(() => undefined);
    await renderLoadedSchedule(scheduleClient({ update: stalled }));
    vi.useFakeTimers();
    const status = screen.getByRole("combobox", { name: "Status for Roof inspection" });
    fireEvent.change(status, { target: { value: "confirmed" } });
    expect(status).toBeDisabled();

    await advanceRequestDeadline();

    expect(screen.getByRole("alert")).toHaveTextContent("status may still be updated");
    expect(status).toBeEnabled();
  });

  it("releases a stalled appointment assignment", async () => {
    const stalled = new Promise(() => undefined);
    await renderLoadedSchedule(scheduleClient({ update: stalled }));
    vi.useFakeTimers();
    const assignee = screen.getByRole("combobox", { name: "Assignee for Roof inspection" });
    fireEvent.change(assignee, { target: { value: "sales-one" } });
    expect(assignee).toBeDisabled();

    await advanceRequestDeadline();

    expect(screen.getByRole("alert")).toHaveTextContent("assignment may still be saved");
    expect(assignee).toBeEnabled();
  });

  it("distinguishes successful creation from a failed calendar refresh", async () => {
    const client = scheduleClient();
    await renderLoadedSchedule(client);
    mocks.getSupabase.mockReset().mockResolvedValueOnce(client).mockResolvedValueOnce(null);
    fireEvent.click(screen.getByRole("button", { name: "New appointment" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Appointment title" }), {
      target: { value: "New inspection" },
    });
    fireEvent.change(screen.getByLabelText("Starts"), {
      target: { value: "2099-09-14T12:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save appointment" }));

    expect(
      await screen.findByText(
        "The appointment was scheduled, but the calendar could not refresh. Reload Bontraco.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "New appointment" })).not.toBeInTheDocument();
  });
});
