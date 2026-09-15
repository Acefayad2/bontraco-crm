import { describe, expect, it } from "vitest";
import { auditRepositoryEntries } from "../../scripts/repository-secret-audit.mjs";

describe("repository secret audit", () => {
  it("accepts ordinary source and public identifiers", () => {
    expect(
      auditRepositoryEntries([
        { path: "src/config.ts", content: "const project = 'public-project-reference'" },
      ]),
    ).toEqual([]);
  });

  it("rejects recognizable credentials without echoing their values", () => {
    const secret = ["gsk", "abcdefghijklmnopqrstuvwxyz123456"].join("_");
    const errors = auditRepositoryEntries([
      { path: "src/provider.ts", content: `const key = "${secret}"` },
    ]);
    expect(errors).toEqual(["src/provider.ts: recognizable secret value is not allowed"]);
    expect(errors.join(" ")).not.toContain(secret);
  });
});
