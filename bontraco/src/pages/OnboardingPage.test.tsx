import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authRequestTimeoutMs } from "../lib/auth-request-deadline";

const mocks = vi.hoisted(() => ({
  getSupabase: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({
  getSupabase: mocks.getSupabase,
}));

vi.mock("../workspace/WorkspaceContext", () => ({
  useWorkspace: () => ({ refresh: mocks.refresh }),
}));

import { OnboardingPage } from "./OnboardingPage";

function renderOnboarding() {
  render(
    <MemoryRouter>
      <OnboardingPage />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Company name" }), {
    target: { value: "Ace Roofing" },
  });
  fireEvent.submit(screen.getByRole("button", { name: /Continue to Bontraco/ }).closest("form")!);
}

describe("OnboardingPage", () => {
  beforeEach(() => {
    mocks.getSupabase.mockReset();
    mocks.refresh.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => vi.useRealTimers());

  it("creates the owner workspace and refreshes access", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    mocks.getSupabase.mockResolvedValue({ rpc });

    renderOnboarding();

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(rpc).toHaveBeenCalledWith("create_bontraco_account", {
      account_name: "Ace Roofing",
      account_slug: "ace-roofing",
      primary_trade: "roofing",
    });
    expect(screen.getByRole("button", { name: /Continue to Bontraco/ })).toBeEnabled();
  });

  it("releases a stalled creation without encouraging a duplicate", async () => {
    vi.useFakeTimers();
    mocks.getSupabase.mockResolvedValue({
      rpc: vi.fn(() => new Promise(() => undefined)),
    });

    renderOnboarding();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole("button", { name: "Creating workspace" })).toBeDisabled();

    await act(async () => vi.advanceTimersByTimeAsync(authRequestTimeoutMs));

    expect(
      screen.getByText(
        "Bontraco did not respond in time. Your workspace may still be created; wait a minute, then refresh before trying again.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continue to Bontraco/ })).toBeEnabled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("distinguishes a completed workspace from a failed access refresh", async () => {
    mocks.getSupabase.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ error: null }),
    });
    mocks.refresh.mockRejectedValue(new Error("private database detail"));

    renderOnboarding();

    expect(
      await screen.findByText(
        "Your workspace was created, but access could not refresh. Reload Bontraco.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/private database detail/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continue to Bontraco/ })).toBeEnabled();
  });

  it("shows a connection error when the Supabase client is unavailable", async () => {
    mocks.getSupabase.mockResolvedValue(null);

    renderOnboarding();

    expect(
      await screen.findByText(
        "Bontraco could not connect. Check your internet connection and try again.",
      ),
    ).toBeInTheDocument();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
