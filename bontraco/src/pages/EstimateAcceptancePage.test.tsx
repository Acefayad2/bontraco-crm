import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EstimateAcceptancePage, estimateShareRequestTimeoutMs } from "./EstimateAcceptancePage";

const proposal = {
  schema_version: 1,
  company: {
    name: "North Shore Roofing",
    legal_name: "North Shore Roofing LLC",
    phone: "(847) 555-0123",
    accent_color: "#0F5B4F",
  },
  customer: {
    first_name: "Jordan",
    last_name: "Lee",
    email: "jordan@example.com",
  },
  property: {
    address_line_1: "42 Sheridan Road",
    city: "Evanston",
    region: "IL",
    postal_code: "60201",
  },
  job: { title: "Roof replacement", trade: "roofing" },
  estimate: {
    number: "EST-2042",
    status: "sent",
    subtotal: 10000,
    tax_amount: 625,
    total: 10625,
    valid_until: "2026-10-01",
    terms: "Deposit due before scheduling.",
    issued_at: "2026-09-09T18:00:00.000Z",
  },
  items: [
    {
      description: "Architectural shingle roof replacement",
      quantity: 20,
      unit: "square",
      unit_price: 500,
      taxable: true,
      line_total: 10000,
    },
  ],
  share: {
    status: "viewed",
    expires_at: "2026-10-02T00:00:00.000Z",
    viewed_at: "2026-09-09T18:05:00.000Z",
  },
};

describe("EstimateAcceptancePage", () => {
  beforeEach(() => {
    window.location.hash = "a".repeat(43);
    window.scrollTo = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.location.hash = "";
  });

  it("shows the frozen proposal and records customer acceptance", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ estimate: proposal }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            estimate: {
              ...proposal,
              share: {
                ...proposal.share,
                status: "accepted",
                accepted_at: "2026-09-09T18:10:00.000Z",
                signer_name: "Jordan Lee",
                signer_email: "jordan@example.com",
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    const user = userEvent.setup();

    render(<EstimateAcceptancePage />);

    expect(await screen.findByRole("heading", { name: "EST-2042" })).toBeVisible();
    expect(screen.getByText("Jordan Lee")).toBeVisible();
    expect(screen.getByText("Architectural shingle roof replacement")).toBeVisible();
    expect(screen.getByText("$10,625.00")).toBeVisible();

    await user.type(screen.getByLabelText("Full name"), "Jordan Lee");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Accept estimate" }));

    expect(await screen.findByText("Estimate accepted")).toBeVisible();
    expect(screen.getByText(/Jordan Lee accepted on/)).toBeVisible();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/.netlify/functions/estimate-share-accept",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"signer_name":"Jordan Lee"'),
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Accept estimate" })).toBeNull(),
    );
  });

  it("releases a customer from a stalled estimate load", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => undefined));
    render(<EstimateAcceptancePage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => vi.advanceTimersByTimeAsync(estimateShareRequestTimeoutMs + 1));

    expect(screen.getByRole("heading", { name: "Estimate unavailable" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "This estimate link is unavailable or expired. Ask the company for a new link.",
      ),
    ).toBeInTheDocument();
  });

  it("releases acceptance controls after an uncertain stalled submission", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ estimate: proposal }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockReturnValueOnce(new Promise(() => undefined));
    render(<EstimateAcceptancePage />);
    expect(await screen.findByRole("heading", { name: "EST-2042" })).toBeVisible();
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Jordan Lee" } });
    fireEvent.click(screen.getByRole("checkbox"));
    vi.useFakeTimers();

    fireEvent.click(screen.getByRole("button", { name: "Accept estimate" }));
    expect(screen.getByRole("button", { name: "Recording acceptance…" })).toBeDisabled();
    await act(async () => vi.advanceTimersByTimeAsync(estimateShareRequestTimeoutMs + 1));

    expect(
      screen.getByText(
        "Your acceptance may still be recording. Reload this page before trying again.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept estimate" })).toBeEnabled();
  });
});
