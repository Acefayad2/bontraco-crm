import { describe, expect, it } from "vitest";
import { auditBuildArtifacts } from "../../scripts/build-artifact-audit.mjs";

describe("production build artifact audit", () => {
  it("accepts ordinary compiled assets", () => {
    expect(
      auditBuildArtifacts([
        { path: "index.html", content: '<script src="/assets/index.js"></script>' },
        { path: "assets/index.js", content: 'const status="connected";' },
        { path: "assets/logo.svg", content: "" },
      ]),
    ).toEqual([]);
  });

  it("rejects source-map files and embedded source-map references", () => {
    expect(
      auditBuildArtifacts([
        { path: "assets/index.js.map", content: "{}" },
        { path: "assets/index.js", content: "//# sourceMappingURL=index.js.map" },
      ]),
    ).toEqual([
      "assets/index.js.map: source map is not allowed",
      "assets/index.js: embedded source map reference is not allowed",
    ]);
  });

  it.each([
    ["gsk", "abcdefghijklmnopqrstuvwxyz123456"].join("_"),
    ["tvly", "abcdefghijklmnopqrstuvwxyz123456"].join("-"),
    ["sk", "live", "abcdefghijklmnopqrstuvwxyz"].join("_"),
    ["whsec", "abcdefghijklmnopqrstuvwxyz"].join("_"),
    ["sb", "secret", "abcdefghijklmnopqrstuvwxyz"].join("_"),
    ["AI", "za", "abcdefghijklmnopqrstuvwxyz123456"].join(""),
  ])("rejects a recognizable browser-bundled secret without echoing it", (secret) => {
    const errors = auditBuildArtifacts([
      { path: "assets/index.js", content: `const key="${secret}"` },
    ]);
    expect(errors).toEqual(["assets/index.js: recognizable secret value is not allowed"]);
    expect(errors.join(" ")).not.toContain(secret);
  });

  it("checks non-code deployed assets too", () => {
    expect(
      auditBuildArtifacts([
        {
          path: "assets/logo.svg",
          content: `<svg><metadata>${["gsk", "abcdefghijklmnopqrstuvwxyz123456"].join("_")}</metadata></svg>`,
        },
      ]),
    ).toEqual(["assets/logo.svg: recognizable secret value is not allowed"]);
  });

  it("rejects a hardcoded secret in a serverless function source", () => {
    expect(
      auditBuildArtifacts([
        {
          path: "netlify/functions/provider.mjs",
          content: `const providerKey = "${["tvly", "abcdefghijklmnopqrstuvwxyz123456"].join("-")}";`,
        },
      ]),
    ).toEqual(["netlify/functions/provider.mjs: recognizable secret value is not allowed"]);
  });

  it("allows demo fixtures only outside the production deployment context", () => {
    const entries = [
      {
        path: "dist/assets/LeadsPage.js",
        content: 'const lead={id:"demo-lead",assignedTo:"demo-sales"};',
      },
    ];

    expect(auditBuildArtifacts(entries)).toEqual([]);
    expect(auditBuildArtifacts(entries, { production: false })).toEqual([]);
  });

  it.each(["demo-owner", "sales@example.com", "Blue Ridge Exteriors"])(
    "rejects production demo fixture content without echoing it: %s",
    (fixture) => {
      const errors = auditBuildArtifacts(
        [{ path: "dist/assets/workspace.js", content: `const fixture="${fixture}";` }],
        { production: true },
      );
      expect(errors).toEqual([
        "dist/assets/workspace.js: demo fixture content is not allowed in production",
      ]);
      expect(errors.join(" ")).not.toContain(fixture);
    },
  );

  it("rejects an oversized individual browser script", () => {
    expect(
      auditBuildArtifacts([{ path: "dist/assets/route.js", content: "compiled", size: 358401 }]),
    ).toEqual(["dist/assets/route.js: browser script exceeds 350 KiB"]);
  });

  it("rejects excessive aggregate browser JavaScript", () => {
    expect(
      auditBuildArtifacts([
        { path: "dist/assets/one.js", content: "compiled", size: 350000 },
        { path: "dist/assets/two.js", content: "compiled", size: 350000 },
        { path: "dist/assets/three.js", content: "compiled", size: 350000 },
        { path: "dist/assets/four.js", content: "compiled", size: 100000 },
      ]),
    ).toEqual(["dist: browser scripts exceed 1100 KiB"]);
  });
});
