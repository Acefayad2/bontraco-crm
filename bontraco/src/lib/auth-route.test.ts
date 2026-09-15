import { describe, expect, it } from "vitest";
import { guestRouteState } from "./auth-route";

describe("guestRouteState", () => {
  it("waits for session restoration before deciding", () => {
    expect(guestRouteState(true, false)).toBe("loading");
    expect(guestRouteState(true, true)).toBe("loading");
  });

  it("redirects an authenticated user", () => {
    expect(guestRouteState(false, true)).toBe("authenticated");
  });

  it("allows a guest to use public authentication", () => {
    expect(guestRouteState(false, false)).toBe("guest");
  });
});
