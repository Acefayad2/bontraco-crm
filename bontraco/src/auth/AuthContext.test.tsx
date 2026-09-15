import { act, render, screen } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSupabase: vi.fn(),
}));

vi.mock("../lib/config", () => ({
  config: { supabaseConfigured: true, demoMode: false },
}));

vi.mock("../lib/supabase", () => ({
  getSupabase: mocks.getSupabase,
}));

import { AuthProvider, initialSessionTimeoutMs, useAuth } from "./AuthContext";

function AuthProbe() {
  const { loading, user } = useAuth();
  return <span>{loading ? "loading" : `ready:${user?.id || "guest"}`}</span>;
}

async function flushClient() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("AuthProvider initial session boundary", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.getSupabase.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the initial auth event and cleans up its subscription", async () => {
    const unsubscribe = vi.fn();
    let listener: ((event: string, session: Session | null) => void) | undefined;
    mocks.getSupabase.mockResolvedValue({
      auth: {
        onAuthStateChange: vi.fn((callback) => {
          listener = callback;
          return { data: { subscription: { unsubscribe } } };
        }),
      },
    });

    const view = render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );
    await flushClient();
    expect(screen.getByText("loading")).toBeInTheDocument();

    act(() => listener?.("INITIAL_SESSION", { user: { id: "user-one" } } as Session));
    expect(screen.getByText("ready:user-one")).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);

    view.unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("releases the login screen when initial session restoration stalls", async () => {
    mocks.getSupabase.mockResolvedValue({
      auth: {
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
      },
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );
    await flushClient();
    await act(async () => vi.advanceTimersByTimeAsync(initialSessionTimeoutMs));

    expect(screen.getByText("ready:guest")).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith(
      "Unable to restore the session before the safety deadline.",
    );
    consoleError.mockRestore();
  });

  it("fails open to the login screen when no client can be created", async () => {
    mocks.getSupabase.mockResolvedValue(null);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );
    await flushClient();

    expect(screen.getByText("ready:guest")).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("releases the login screen when client initialization fails", async () => {
    mocks.getSupabase.mockRejectedValue(new Error("private provider detail"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );
    await flushClient();

    expect(screen.getByText("ready:guest")).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith("Unable to initialize authentication.");
    expect(consoleError).not.toHaveBeenCalledWith(expect.stringContaining("private provider"));
    consoleError.mockRestore();
  });
});
