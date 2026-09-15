/* global Request */
import { describe, expect, it } from "vitest";
import { selectedWorkspaceId } from "../../netlify/functions/_shared/workspace-request.mjs";

describe("server workspace targeting", () => {
  it("accepts a valid selected workspace id", () => {
    const request = new Request("https://bontraco.test", {
      headers: { "x-bontraco-account-id": "0d141279-3cef-4ee5-9fe6-477d1e65a979" },
    });
    expect(selectedWorkspaceId(request)).toBe("0d141279-3cef-4ee5-9fe6-477d1e65a979");
  });

  it("rejects missing and malformed workspace ids", () => {
    expect(selectedWorkspaceId(new Request("https://bontraco.test"))).toBeNull();
    const request = new Request("https://bontraco.test", {
      headers: { "x-bontraco-account-id": "someone-elses-company" },
    });
    expect(selectedWorkspaceId(request)).toBeNull();
  });
});
