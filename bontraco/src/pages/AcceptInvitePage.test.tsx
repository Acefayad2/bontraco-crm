import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authRequestTimeoutMs } from "../lib/auth-request-deadline";

const mocks = vi.hoisted(() => ({
  getSupabase: vi.fn(),
  refresh: vi.fn(),
  user: { id: "member-one" },
}));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock("../workspace/WorkspaceContext", () => ({
  useWorkspace: () => ({ refresh: mocks.refresh }),
}));

vi.mock("../lib/supabase", () => ({
  getSupabase: mocks.getSupabase,
}));

import { AcceptInvitePage } from "./AcceptInvitePage";

function renderInvitation() {
  return render(
    <MemoryRouter initialEntries={["/accept-invite?token=invite-token"]}>
      <Routes>
        <Route path="/accept-invite" element={<AcceptInvitePage />} />
        <Route path="/app" element={<h1>Company workspace</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AcceptInvitePage", () => {
  beforeEach(() => {
    sessionStorage.clear();
    mocks.getSupabase.mockReset();
    mocks.refresh.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => vi.useRealTimers());

  it("completes an invitation, clears its token, and enters the workspace", async () => {
    sessionStorage.setItem("bontraco_invite_token", "invite-token");
    const rpc = vi.fn().mockResolvedValue({ error: null });
    mocks.getSupabase.mockResolvedValue({ rpc });

    renderInvitation();

    expect(await screen.findByRole("heading", { name: "Company workspace" })).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith("accept_bontraco_invitation", {
      raw_token: "invite-token",
    });
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem("bontraco_invite_token")).toBeNull();
  });

  it("releases a stalled invitation with safe retry guidance", async () => {
    vi.useFakeTimers();
    mocks.getSupabase.mockResolvedValue({
      rpc: vi.fn(() => new Promise(() => undefined)),
    });

    renderInvitation();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("Verifying your invitation and company access.")).toBeInTheDocument();

    await act(async () => vi.advanceTimersByTimeAsync(authRequestTimeoutMs));

    expect(
      screen.getByText(
        "Bontraco did not respond in time. Your request may still finish; wait a minute before trying again.",
      ),
    ).toBeInTheDocument();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("shows a recoverable error when the Supabase client is unavailable", async () => {
    mocks.getSupabase.mockResolvedValue(null);

    renderInvitation();

    await waitFor(() =>
      expect(
        screen.getByText(
          "Bontraco could not connect. Check your internet connection and try again.",
        ),
      ).toBeInTheDocument(),
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
