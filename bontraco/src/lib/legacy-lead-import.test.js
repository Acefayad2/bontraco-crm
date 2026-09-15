/* global Request */
import { describe, expect, it } from "vitest";
import handler from "../../netlify/functions/legacy-lead-import.mjs";

describe("legacy lead import endpoint", () => {
  it("accepts only POST requests", async () => {
    const response = await handler(new Request("https://bontraco.test/import"));
    expect(response.status).toBe(405);
  });

  it("rejects anonymous import attempts", async () => {
    const response = await handler(new Request("https://bontraco.test/import", { method: "POST" }));
    expect(response.status).toBe(401);
  });
});
