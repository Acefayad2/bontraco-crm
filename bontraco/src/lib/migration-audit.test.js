import { describe, expect, it } from "vitest";
import { auditMigrations } from "../../scripts/migration-audit.mjs";

const safeMigration = {
  name: "20260913000100_add_safe_policy.sql",
  content:
    "create policy safe_read on public.records for select to authenticated using (owner_id = (select auth.uid()));",
};

describe("migration audit", () => {
  it("accepts a normalized migration with current authorization syntax", () => {
    expect(auditMigrations([safeMigration], 1)).toEqual([]);
  });

  it("rejects reduced coverage, duplicate versions, conflicts, and deprecated auth checks", () => {
    const errors = auditMigrations(
      [
        safeMigration,
        {
          name: "20260913000100_Bad-Name.sql",
          content: "<<<<<<< branch\nselect auth.role();\n=======\n>>>>>>> main",
        },
      ],
      3,
    );
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("expected at least 3"),
        expect.stringContaining("filename must use"),
      ]),
    );
  });

  it("rejects duplicate normalized versions and unsafe migration contents", () => {
    const errors = auditMigrations(
      [
        safeMigration,
        {
          name: "20260913000100_second_policy.sql",
          content: "<<<<<<< branch\nselect auth.role();",
        },
      ],
      2,
    );
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("duplicate migration version"),
        expect.stringContaining("unresolved conflict marker"),
        expect.stringContaining("deprecated auth.role()"),
      ]),
    );
  });
});
