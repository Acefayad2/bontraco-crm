import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthRequestTimeoutError, authRequestTimeoutMs } from "../lib/auth-request-deadline";
import { JobCommercialPanel } from "./JobCommercialPanel";

const originalClipboard = navigator.clipboard;

const mocks = vi.hoisted(() => ({
  demoMode: false,
  from: vi.fn(),
  rpc: vi.fn(),
  getSupabase: vi.fn(),
  workspace: {
    id: "20000000-0000-4000-8000-000000000001",
    name: "Estimate Test",
    slug: "estimate-test",
    role: "owner",
    trades: ["roofing"],
    entitlements: ["core_crm"],
  },
}));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    demoMode: mocks.demoMode,
    user: { id: "10000000-0000-4000-8000-000000000001" },
    session: { access_token: "test-access-token" },
  }),
}));

vi.mock("../workspace/WorkspaceContext", () => ({
  useWorkspace: () => ({
    workspace: mocks.workspace,
  }),
}));

vi.mock("../lib/supabase", () => ({
  getSupabase: mocks.getSupabase,
}));

function emptyQuery() {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    single: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockResolvedValue({ data: [], error: null });
  query.single.mockResolvedValue({
    data: {
      estimate_default_tax_rate: 0,
      estimate_default_valid_days: 30,
      estimate_default_customer_note: null,
      estimate_default_terms: null,
    },
    error: null,
  });
  return query;
}

describe("JobCommercialPanel", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: originalClipboard,
    });
  });

  beforeEach(() => {
    vi.stubEnv("VITE_DEMO_MODE", "false");
    mocks.demoMode = false;
    mocks.from.mockReset().mockImplementation(() => emptyQuery());
    mocks.rpc.mockReset().mockResolvedValue({ data: "estimate-id", error: null });
    mocks.getSupabase.mockReset().mockResolvedValue({ from: mocks.from, rpc: mocks.rpc });
  });

  it("renders a customer-ready estimate preview in sample mode", async () => {
    vi.stubEnv("VITE_DEMO_MODE", "true");
    mocks.demoMode = true;
    const user = userEvent.setup();
    render(<JobCommercialPanel jobId="demo-j1" />);

    await user.click(await screen.findByRole("button", { name: /Preview\s*EST-1048/ }));

    const dialog = screen.getByRole("dialog", { name: "EST-1048" });
    expect(dialog).toBeVisible();
    expect(within(dialog).getByText("Maria Torres")).toBeVisible();
    expect(within(dialog).getByText("Architectural shingle roof replacement")).toBeVisible();
    expect(within(dialog).getByText("$18,328.13")).toBeVisible();
    expect(within(dialog).getByText("(630) 555-0100 · estimates@blueridge.example")).toBeVisible();
    expect(within(dialog).getByRole("link", { name: "blueridge.example" })).toHaveAttribute(
      "href",
      "https://blueridge.example",
    );
    expect(dialog.querySelector(".estimate-document-sheet")).toHaveStyle(
      "--proposal-accent: #0F5B4F",
    );
    expect(within(dialog).getByRole("button", { name: "Print or save PDF" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Close estimate preview" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Preview\s*INV-1048/ }));
    const invoiceDialog = screen.getByRole("dialog", { name: "INV-1048" });
    expect(within(invoiceDialog).getByText("Customer invoice preview")).toBeVisible();
    expect(within(invoiceDialog).getByText("Architectural shingle roof replacement")).toBeVisible();
    expect(within(invoiceDialog).getByText("$12,828.13")).toBeVisible();
    expect(
      within(invoiceDialog).getByText("(630) 555-0100 · billing@blueridge.example"),
    ).toBeVisible();
    expect(within(invoiceDialog).getByRole("button", { name: "Print or save PDF" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Close invoice preview" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("submits a multi-line scope through the atomic estimate RPC", async () => {
    const user = userEvent.setup();
    render(<JobCommercialPanel jobId="30000000-0000-4000-8000-000000000001" />);

    await user.click(screen.getByRole("button", { name: /Estimate/ }));
    await user.type(screen.getByLabelText("Description"), "Architectural shingles");
    await user.type(screen.getByLabelText("Unit price"), "12000");
    await user.click(screen.getByRole("button", { name: "Add line" }));

    const descriptions = screen.getAllByLabelText("Description");
    const prices = screen.getAllByLabelText("Unit price");
    await user.type(descriptions[1], "Permit and disposal");
    await user.type(prices[1], "850");
    await user.click(screen.getByRole("button", { name: "Create draft estimate" }));

    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(1));
    expect(mocks.rpc).toHaveBeenCalledWith(
      "create_bontraco_estimate",
      expect.objectContaining({
        target_account_id: "20000000-0000-4000-8000-000000000001",
        target_job_id: "30000000-0000-4000-8000-000000000001",
        target_items: [
          expect.objectContaining({
            description: "Architectural shingles",
            quantity: 1,
            unit_price: 12000,
            taxable: true,
          }),
          expect.objectContaining({
            description: "Permit and disposal",
            quantity: 1,
            unit_price: 850,
            taxable: true,
          }),
        ],
      }),
    );
    expect(await screen.findByText("Multi-line draft estimate created atomically.")).toBeVisible();
  });

  it("releases a stalled commercial-record load", async () => {
    mocks.getSupabase.mockReset().mockImplementation(() => new Promise(() => undefined));
    vi.useFakeTimers();
    render(<JobCommercialPanel jobId="30000000-0000-4000-8000-000000000001" />);

    await act(async () => vi.advanceTimersByTimeAsync(authRequestTimeoutMs + 1));

    expect(screen.getByRole("status")).toHaveTextContent(
      "could not load this job's financial records",
    );
  });

  it("ignores a late timeout from a previously selected job", async () => {
    let rejectFirst: (reason?: unknown) => void = () => undefined;
    const stalled = new Promise((_resolve, reject) => {
      rejectFirst = reject;
    });
    mocks.getSupabase
      .mockReset()
      .mockImplementationOnce(() => stalled)
      .mockResolvedValue({ from: mocks.from, rpc: mocks.rpc });
    const { rerender } = render(
      <JobCommercialPanel jobId="30000000-0000-4000-8000-000000000001" />,
    );
    await waitFor(() => expect(mocks.getSupabase).toHaveBeenCalledTimes(1));

    rerender(<JobCommercialPanel jobId="30000000-0000-4000-8000-000000000002" />);
    await waitFor(() => expect(mocks.getSupabase).toHaveBeenCalledTimes(2));
    await act(async () => rejectFirst(new AuthRequestTimeoutError()));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("releases a stalled estimate-document load", async () => {
    const estimate = {
      id: "estimate-one",
      estimate_number: "EST-2001",
      status: "draft",
      subtotal: 100,
      tax_amount: 0,
      total: 100,
      valid_until: null,
      customer_note: null,
      terms: null,
      created_at: "2026-09-14T00:00:00.000Z",
    };
    mocks.from.mockImplementation((table: string) => {
      const query = emptyQuery();
      if (table === "estimates") {
        query.order.mockResolvedValue({ data: [estimate], error: null });
      }
      return query;
    });
    render(<JobCommercialPanel jobId="30000000-0000-4000-8000-000000000001" />);
    const preview = await screen.findByRole("button", { name: /Preview\s*EST-2001/ });
    mocks.getSupabase.mockReset().mockImplementation(() => new Promise(() => undefined));
    vi.useFakeTimers();

    fireEvent.click(preview);
    expect(screen.getByRole("button", { name: /Loading…\s*EST-2001/ })).toBeDisabled();
    await act(async () => vi.advanceTimersByTimeAsync(authRequestTimeoutMs + 1));

    expect(screen.getByRole("status")).toHaveTextContent(
      "could not assemble this estimate document",
    );
    expect(screen.getByRole("button", { name: /Preview\s*EST-2001/ })).toBeEnabled();
  });

  it("releases a stalled estimate creation with uncertainty guidance", async () => {
    const user = userEvent.setup();
    render(<JobCommercialPanel jobId="30000000-0000-4000-8000-000000000001" />);
    await waitFor(() => expect(mocks.getSupabase).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: /Estimate/ }));
    await user.type(screen.getByLabelText("Description"), "Emergency roof repair");
    await user.type(screen.getByLabelText("Unit price"), "900");
    mocks.rpc.mockReset().mockImplementation(() => new Promise(() => undefined));
    vi.useFakeTimers();

    fireEvent.click(screen.getByRole("button", { name: "Create draft estimate" }));
    expect(screen.getByRole("button", { name: "Creating…" })).toBeDisabled();
    await act(async () => vi.advanceTimersByTimeAsync(authRequestTimeoutMs + 1));

    expect(screen.getByRole("status")).toHaveTextContent("estimate may still be created");
    expect(screen.getByRole("button", { name: "Create draft estimate" })).toBeEnabled();
  });

  it("keeps a confirmed estimate when its financial refresh fails", async () => {
    const user = userEvent.setup();
    const client = { from: mocks.from, rpc: mocks.rpc };
    render(<JobCommercialPanel jobId="30000000-0000-4000-8000-000000000001" />);
    await waitFor(() => expect(mocks.getSupabase).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: /Estimate/ }));
    await user.type(screen.getByLabelText("Description"), "Emergency roof repair");
    await user.type(screen.getByLabelText("Unit price"), "900");
    mocks.getSupabase.mockReset().mockResolvedValueOnce(client).mockResolvedValueOnce(null);

    await user.click(screen.getByRole("button", { name: "Create draft estimate" }));

    expect(
      await screen.findByText(
        "The estimate was created, but financial records could not refresh. Reload Bontraco.",
      ),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Create draft estimate" })).not.toBeInTheDocument();
  });

  it("releases a stalled customer-link request", async () => {
    const estimate = {
      id: "estimate-one",
      estimate_number: "EST-2001",
      status: "draft",
      subtotal: 100,
      tax_amount: 0,
      total: 100,
      valid_until: null,
      customer_note: null,
      terms: null,
      created_at: "2026-09-14T00:00:00.000Z",
    };
    mocks.from.mockImplementation((table: string) => {
      const query = emptyQuery();
      if (table === "estimates") {
        query.order.mockResolvedValue({ data: [estimate], error: null });
      }
      return query;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => undefined)),
    );
    render(<JobCommercialPanel jobId="30000000-0000-4000-8000-000000000001" />);
    const share = await screen.findByRole("button", { name: "Customer link" });
    vi.useFakeTimers();

    fireEvent.click(share);
    expect(screen.getByRole("button", { name: "Creating link…" })).toBeDisabled();
    await act(async () => vi.advanceTimersByTimeAsync(authRequestTimeoutMs + 1));

    expect(screen.getByRole("status")).toHaveTextContent("customer link may still be created");
    expect(screen.getByRole("button", { name: "Customer link" })).toBeEnabled();
  });

  it("keeps a generated link available when clipboard access fails", async () => {
    const estimate = {
      id: "estimate-one",
      estimate_number: "EST-2001",
      status: "draft",
      subtotal: 100,
      tax_amount: 0,
      total: 100,
      valid_until: null,
      customer_note: null,
      terms: null,
      created_at: "2026-09-14T00:00:00.000Z",
    };
    mocks.from.mockImplementation((table: string) => {
      const query = emptyQuery();
      if (table === "estimates") {
        query.order.mockResolvedValue({ data: [estimate], error: null });
      }
      return query;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ share_url: "https://customer.example/estimate/test" }),
        }),
      ),
    );
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    render(<JobCommercialPanel jobId="30000000-0000-4000-8000-000000000001" />);
    fireEvent.click(await screen.findByRole("button", { name: "Customer link" }));
    const link = await screen.findByRole("textbox", { name: "Customer estimate link" });

    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

    expect(await screen.findByText(/Select and copy it manually/)).toBeVisible();
    expect(link).toHaveValue("https://customer.example/estimate/test");
    expect(screen.getByRole("button", { name: "Copy link" })).toBeEnabled();
  });
});
