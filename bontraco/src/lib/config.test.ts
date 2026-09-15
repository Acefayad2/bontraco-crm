import { describe, expect, it } from "vitest";
import { isAllowedDemoHostname } from "./config";

describe("demo host restrictions", () => {
  it.each(["localhost", "127.0.0.1", "app.localhost", "deploy-id--bontraco.netlify.app"])(
    "allows %s",
    (hostname) => expect(isAllowedDemoHostname(hostname)).toBe(true),
  );

  it.each([
    "bontraco.netlify.app",
    "app.bontraco.com",
    "preview.bontraco.com",
    "bontraco.netlify.app.attacker.test",
  ])("rejects %s", (hostname) => expect(isAllowedDemoHostname(hostname)).toBe(false));
});
