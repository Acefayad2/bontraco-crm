import { useEffect, useRef } from "react";

const DEFAULT_INTERVAL_MS = 30_000;
const FOCUS_THROTTLE_MS = 1_000;

export function useWorkspaceAutoRefresh(
  enabled: boolean,
  refresh: () => Promise<unknown>,
  workspaceId = "",
  intervalMs = DEFAULT_INTERVAL_MS,
) {
  const refreshRef = useRef(refresh);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!enabled || !workspaceId) return;

    let disposed = false;
    let inFlight = false;
    let lastStartedAt = 0;

    const runRefresh = () => {
      const now = Date.now();
      if (
        disposed ||
        inFlight ||
        document.visibilityState === "hidden" ||
        now - lastStartedAt < FOCUS_THROTTLE_MS
      )
        return;
      inFlight = true;
      lastStartedAt = now;
      void Promise.resolve(refreshRef.current())
        .catch(() => undefined)
        .finally(() => {
          inFlight = false;
        });
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") runRefresh();
    };
    const timer = window.setInterval(runRefresh, intervalMs);
    window.addEventListener("focus", runRefresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", runRefresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [enabled, intervalMs, workspaceId]);
}
