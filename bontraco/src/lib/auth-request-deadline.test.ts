import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthRequestTimeoutError, withAuthRequestDeadline } from "./auth-request-deadline";

describe("withAuthRequestDeadline", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns a completed authentication result and clears its deadline", async () => {
    await expect(withAuthRequestDeadline(Promise.resolve("signed-in"), 100)).resolves.toBe(
      "signed-in",
    );
    expect(vi.getTimerCount()).toBe(0);
  });

  it("preserves a provider failure and clears its deadline", async () => {
    const providerError = new Error("provider rejected request");
    await expect(withAuthRequestDeadline(Promise.reject(providerError), 100)).rejects.toBe(
      providerError,
    );
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects a stalled request with a stable timeout error", async () => {
    const request = withAuthRequestDeadline(new Promise<never>(() => undefined), 100);
    const rejection = expect(request).rejects.toBeInstanceOf(AuthRequestTimeoutError);

    await vi.advanceTimersByTimeAsync(100);
    await rejection;
    expect(vi.getTimerCount()).toBe(0);
  });
});
