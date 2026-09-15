import { act, fireEvent, render, screen } from "@testing-library/react";
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
  useAuth: () => ({ demoMode: false, user: { id: "owner-one" } }),
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

import { CustomersPage } from "./CustomersPage";

const contact = {
  id: "contact-one",
  assigned_to: "owner-one",
  first_name: "Jordan",
  last_name: "Homeowner",
  company_name: null,
  email: "jordan@example.com",
  phone: "5551234567",
  source: "manual",
  updated_at: "2026-09-13T12:00:00.000Z",
};

const mergeTarget = {
  ...contact,
  id: "contact-two",
  first_name: "Morgan",
  last_name: "Homeowner",
  email: "morgan@example.com",
};

function mutationBuilder(result: unknown) {
  const builder = {
    eq: () => builder,
    is: () => builder,
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

function resultBuilder(result: unknown, update: unknown, insert: unknown) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    is: () => builder,
    order: () => builder,
    limit: () => builder,
    update: () => mutationBuilder(update),
    insert: () => insert,
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

function customerClient(
  options: {
    stalled?: boolean;
    failedTable?: string;
    rpc?: unknown;
    update?: unknown;
    insert?: unknown;
    contacts?: (typeof contact)[];
    suppressions?: unknown[];
  } = {},
) {
  const stalled = new Promise(() => undefined);
  const update = options.update ?? Promise.resolve({ error: null });
  const insert = options.insert ?? Promise.resolve({ error: null });
  return {
    from: vi.fn((table: string) => {
      if (options.stalled) return resultBuilder(stalled, update, insert);
      const data =
        table === "contacts"
          ? (options.contacts ?? [contact])
          : table === "memberships"
            ? [{ user_id: "owner-one", display_name: "Owner One", email: "owner@example.com" }]
            : table === "properties"
              ? [
                  {
                    id: "property-one",
                    label: "Home",
                    address_line_1: "1 Main Street",
                    address_line_2: null,
                    city: "Chicago",
                    region: "IL",
                    postal_code: "60601",
                    active: true,
                  },
                ]
              : table === "communication_suppressions"
                ? (options.suppressions ?? [])
                : [];
      return resultBuilder(
        {
          data,
          error: options.failedTable === table ? new Error("query failed") : null,
        },
        update,
        insert,
      );
    }),
    rpc: () => options.rpc ?? Promise.resolve({ error: null }),
  };
}

async function advanceRequestDeadline() {
  await act(async () => vi.advanceTimersByTimeAsync(authRequestTimeoutMs + 1));
}

async function renderLoadedCustomers(client = customerClient()) {
  mocks.getSupabase.mockResolvedValue(client);
  render(<CustomersPage />);
  expect(await screen.findByText("Jordan Homeowner")).toBeInTheDocument();
}

describe("CustomersPage read recovery", () => {
  beforeEach(() => mocks.getSupabase.mockReset());

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("releases customer loading when the client is unavailable", async () => {
    mocks.getSupabase.mockResolvedValue(null);
    render(<CustomersPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("could not load customers");
    expect(screen.queryByText("Loading customers")).not.toBeInTheDocument();
  });

  it("releases a stalled customer-list request", async () => {
    vi.useFakeTimers();
    mocks.getSupabase.mockResolvedValue(customerClient({ stalled: true }));
    render(<CustomersPage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await advanceRequestDeadline();

    expect(screen.getByRole("alert")).toHaveTextContent("could not load customers");
    expect(screen.queryByText("Loading customers")).not.toBeInTheDocument();
  });

  it("releases detail loading when the client becomes unavailable", async () => {
    const client = customerClient();
    await renderLoadedCustomers(client);
    mocks.getSupabase.mockReset().mockResolvedValue(null);
    fireEvent.click(screen.getByRole("button", { name: "View customer" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "could not load all customer details",
    );
    expect(screen.queryByText("Loading locations…")).not.toBeInTheDocument();
    expect(screen.queryByText("Loading jobs…")).not.toBeInTheDocument();
  });

  it("releases a stalled customer-detail request", async () => {
    const client = customerClient();
    await renderLoadedCustomers(client);
    mocks.getSupabase.mockReset().mockResolvedValue(customerClient({ stalled: true }));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "View customer" }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("Loading locations…")).toBeInTheDocument();

    await advanceRequestDeadline();

    expect(screen.getByRole("alert")).toHaveTextContent("could not load all customer details");
    expect(screen.queryByText("Loading locations…")).not.toBeInTheDocument();
  });

  it("rejects partial customer details", async () => {
    const client = customerClient();
    await renderLoadedCustomers(client);
    mocks.getSupabase.mockReset().mockResolvedValue(customerClient({ failedTable: "jobs" }));
    fireEvent.click(screen.getByRole("button", { name: "View customer" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "could not load all customer details",
    );
    expect(screen.queryByText("1 Main Street")).not.toBeInTheDocument();
  });

  it("releases stalled customer creation without encouraging a duplicate", async () => {
    const client = customerClient();
    await renderLoadedCustomers(client);
    const stalled = new Promise(() => undefined);
    mocks.getSupabase.mockReset().mockResolvedValue(customerClient({ rpc: stalled }));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Add customer" }));
    fireEvent.change(screen.getByRole("textbox", { name: "First name" }), {
      target: { value: "Taylor" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save customer" }));
    expect(screen.getByRole("button", { name: "Saving customer" })).toBeDisabled();

    await advanceRequestDeadline();

    expect(screen.getByRole("alert")).toHaveTextContent("may still be created");
    expect(screen.getByRole("button", { name: "Save customer" })).toBeEnabled();
  });

  it("releases a stalled customer assignment", async () => {
    const client = customerClient();
    await renderLoadedCustomers(client);
    const stalled = new Promise(() => undefined);
    mocks.getSupabase.mockReset().mockResolvedValue(customerClient({ update: stalled }));
    vi.useFakeTimers();
    const assignee = screen.getByRole("combobox", { name: "Assignee for Jordan Homeowner" });
    fireEvent.change(assignee, { target: { value: "" } });
    expect(assignee).toBeDisabled();

    await advanceRequestDeadline();

    expect(screen.getByRole("alert")).toHaveTextContent("assignment may still be saved");
    expect(assignee).toBeEnabled();
  });

  it("distinguishes successful creation from a failed customer-list refresh", async () => {
    const client = customerClient();
    await renderLoadedCustomers(client);
    mocks.getSupabase.mockReset().mockResolvedValueOnce(client).mockResolvedValueOnce(null);
    fireEvent.click(screen.getByRole("button", { name: "Add customer" }));
    fireEvent.change(screen.getByRole("textbox", { name: "First name" }), {
      target: { value: "Taylor" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save customer" }));

    expect(
      await screen.findByText(
        "The customer was created, but the customer list could not refresh. Reload Bontraco.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Add a customer" })).not.toBeInTheDocument();
  });

  it("releases a stalled service-location creation without encouraging a duplicate", async () => {
    await renderLoadedCustomers();
    fireEvent.click(screen.getByRole("button", { name: "View customer" }));
    expect(await screen.findByText("1 Main Street, Chicago, IL, 60601")).toBeInTheDocument();
    const stalled = new Promise(() => undefined);
    mocks.getSupabase.mockReset().mockResolvedValue(customerClient({ insert: stalled }));
    vi.useFakeTimers();
    fireEvent.change(screen.getByRole("textbox", { name: "Street address" }), {
      target: { value: "2 Main Street" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "City" }), {
      target: { value: "Chicago" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add location" }));
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();

    await advanceRequestDeadline();

    expect(screen.getByRole("alert")).toHaveTextContent("may still be added");
    expect(screen.getByRole("button", { name: "Add location" })).toBeEnabled();
  });

  it("releases a stalled service-location update", async () => {
    await renderLoadedCustomers();
    fireEvent.click(screen.getByRole("button", { name: "View customer" }));
    expect(await screen.findByText("1 Main Street, Chicago, IL, 60601")).toBeInTheDocument();
    const stalled = new Promise(() => undefined);
    mocks.getSupabase.mockReset().mockResolvedValue(customerClient({ update: stalled }));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Save location" }));
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();

    await advanceRequestDeadline();

    expect(screen.getByRole("alert")).toHaveTextContent("may still be updated");
    expect(screen.getByRole("button", { name: "Save location" })).toBeEnabled();
  });

  it("releases a stalled service-location status change", async () => {
    await renderLoadedCustomers();
    fireEvent.click(screen.getByRole("button", { name: "View customer" }));
    expect(await screen.findByText("1 Main Street, Chicago, IL, 60601")).toBeInTheDocument();
    const stalled = new Promise(() => undefined);
    mocks.getSupabase.mockReset().mockResolvedValue(customerClient({ rpc: stalled }));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(screen.getByRole("button", { name: "Archive" })).toBeDisabled();

    await advanceRequestDeadline();

    expect(screen.getByRole("alert")).toHaveTextContent("may still be changed");
    expect(screen.getByRole("button", { name: "Archive" })).toBeEnabled();
  });

  it("distinguishes a successful location creation from a failed detail refresh", async () => {
    const client = customerClient();
    await renderLoadedCustomers(client);
    fireEvent.click(screen.getByRole("button", { name: "View customer" }));
    expect(await screen.findByText("1 Main Street, Chicago, IL, 60601")).toBeInTheDocument();
    mocks.getSupabase.mockReset().mockResolvedValueOnce(client).mockResolvedValueOnce(null);
    fireEvent.change(screen.getByRole("textbox", { name: "Street address" }), {
      target: { value: "2 Main Street" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "City" }), {
      target: { value: "Chicago" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add location" }));

    expect(
      await screen.findByText(
        "The service location was added, but customer details could not refresh. Reload Bontraco.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Street address" })).toHaveValue("");
  });

  it("releases a stalled customer merge without encouraging a duplicate", async () => {
    const client = customerClient({ contacts: [contact, mergeTarget] });
    await renderLoadedCustomers(client);
    fireEvent.click(screen.getAllByRole("button", { name: "View customer" })[0]);
    expect(await screen.findByText("Merge duplicate customer")).toBeInTheDocument();
    const stalled = new Promise(() => undefined);
    mocks.getSupabase.mockReset().mockResolvedValue(customerClient({ rpc: stalled }));
    vi.useFakeTimers();
    fireEvent.change(screen.getByRole("combobox", { name: "Customer record to keep" }), {
      target: { value: mergeTarget.id },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Type MERGE to confirm" }), {
      target: { value: "MERGE" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Merge and remove duplicate" }));
    expect(screen.getByRole("button", { name: "Merging…" })).toBeDisabled();

    await advanceRequestDeadline();

    expect(screen.getByRole("alert")).toHaveTextContent("may still be merged");
    expect(screen.getByRole("button", { name: "Merge and remove duplicate" })).toBeEnabled();
  });

  it("distinguishes a successful merge from a failed customer-list refresh", async () => {
    const client = customerClient({ contacts: [contact, mergeTarget] });
    await renderLoadedCustomers(client);
    fireEvent.click(screen.getAllByRole("button", { name: "View customer" })[0]);
    expect(await screen.findByText("Merge duplicate customer")).toBeInTheDocument();
    mocks.getSupabase.mockReset().mockResolvedValueOnce(client).mockResolvedValueOnce(null);
    fireEvent.change(screen.getByRole("combobox", { name: "Customer record to keep" }), {
      target: { value: mergeTarget.id },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Type MERGE to confirm" }), {
      target: { value: "MERGE" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Merge and remove duplicate" }));

    expect(
      await screen.findByText(
        "Jordan Homeowner was merged into Morgan Homeowner, but the customer list could not refresh. Reload Bontraco.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Jordan Homeowner" })).not.toBeInTheDocument();
  });

  it("releases a stalled do-not-contact write", async () => {
    await renderLoadedCustomers();
    fireEvent.click(screen.getByRole("button", { name: "View customer" }));
    expect(await screen.findByText("Contact preferences")).toBeInTheDocument();
    const stalled = new Promise(() => undefined);
    mocks.getSupabase.mockReset().mockResolvedValue(customerClient({ insert: stalled }));
    vi.useFakeTimers();
    fireEvent.change(screen.getByRole("textbox", { name: "Reason or recipient request" }), {
      target: { value: "Requested no more calls" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Record do-not-contact" }));
    expect(screen.getByRole("button", { name: "Saving" })).toBeDisabled();

    await advanceRequestDeadline();

    expect(screen.getByText(/do-not-contact preference may still be saved/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Record do-not-contact" })).toBeEnabled();
  });

  it("releases a stalled do-not-contact lift", async () => {
    const suppression = {
      id: "suppression-one",
      channel: "voice",
      destination: "+15551234567",
      reason: "Requested no more calls",
      source: "recipient_request",
      suppressed_at: "2026-09-13T12:00:00.000Z",
      lifted_at: null,
    };
    await renderLoadedCustomers(customerClient({ suppressions: [suppression] }));
    fireEvent.click(screen.getByRole("button", { name: "View customer" }));
    expect(await screen.findByRole("button", { name: "Lift" })).toBeInTheDocument();
    vi.spyOn(window, "prompt").mockReturnValue("Recipient opted back in");
    const stalled = new Promise(() => undefined);
    mocks.getSupabase.mockReset().mockResolvedValue(customerClient({ update: stalled }));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Lift" }));
    expect(screen.getByRole("button", { name: "Lift" })).toBeDisabled();

    await advanceRequestDeadline();

    expect(screen.getByText(/do-not-contact preference may still be lifted/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lift" })).toBeEnabled();
  });

  it("releases a stalled consent-evidence write", async () => {
    await renderLoadedCustomers();
    fireEvent.click(screen.getByRole("button", { name: "View customer" }));
    expect(await screen.findByText("Consent evidence")).toBeInTheDocument();
    const stalled = new Promise(() => undefined);
    mocks.getSupabase.mockReset().mockResolvedValue(customerClient({ insert: stalled }));
    vi.useFakeTimers();
    fireEvent.change(screen.getByRole("textbox", { name: "Evidence note" }), {
      target: { value: "Signed form received" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Record consent" }));
    expect(screen.getByRole("button", { name: "Record consent" })).toBeDisabled();

    await advanceRequestDeadline();

    expect(screen.getByText(/consent event may still be recorded/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Record consent" })).toBeEnabled();
  });

  it("keeps a saved do-not-contact event when its detail refresh fails", async () => {
    const client = customerClient();
    await renderLoadedCustomers(client);
    fireEvent.click(screen.getByRole("button", { name: "View customer" }));
    expect(await screen.findByText("Contact preferences")).toBeInTheDocument();
    mocks.getSupabase.mockReset().mockResolvedValueOnce(client).mockResolvedValueOnce(null);
    fireEvent.change(screen.getByRole("textbox", { name: "Reason or recipient request" }), {
      target: { value: "Requested no more calls" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Record do-not-contact" }));

    expect(
      await screen.findByText(
        "Do-not-contact preference saved, but customer details could not refresh. Reload Bontraco.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Reason or recipient request" })).toHaveValue("");
  });
});
