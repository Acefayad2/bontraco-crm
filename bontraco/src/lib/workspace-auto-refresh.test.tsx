import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceAutoRefresh } from "./workspace-auto-refresh";

function Harness({
  enabled = true,
  refresh,
  workspaceId = "workspace-1",
}: {
  enabled?: boolean;
  refresh: () => Promise<unknown>;
  workspaceId?: string;
}) {
  useWorkspaceAutoRefresh(enabled, refresh, workspaceId, 30_000);
  return null;
}

describe("useWorkspaceAutoRefresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("refreshes visible workspace data every thirty seconds", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    render(<Harness refresh={refresh} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("refreshes on focus but throttles duplicate focus events", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    render(<Harness refresh={refresh} />);

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("focus"));
      await Promise.resolve();
    });

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does not refresh demo or unselected workspaces", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    render(<Harness enabled={false} refresh={refresh} workspaceId="" />);

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(refresh).not.toHaveBeenCalled();
  });

  it("does not overlap slow refresh requests", async () => {
    let finish: (() => void) | undefined;
    const refresh = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    render(<Harness refresh={refresh} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(refresh).toHaveBeenCalledTimes(1);

    await act(async () => {
      finish?.();
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
