import { describe, expect, it } from "vitest";
import { auditSqlSuites } from "../../scripts/sql-suite-audit.mjs";

const safeSuite = {
  name: "tenant_isolation.sql",
  content: "begin;\ndo $$ begin raise exception 'denied'; end $$;\nrollback;",
};

describe("SQL suite audit", () => {
  it("accepts transaction-wrapped assertion suites", () => {
    expect(auditSqlSuites([safeSuite], 1)).toEqual([]);
  });

  it("rejects missing coverage, unsafe commits, and non-asserting scripts", () => {
    const errors = auditSqlSuites(
      [{ name: "Unsafe Test.sql", content: "begin;\nselect 1;\ncommit;" }],
      2,
    );
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("expected at least 2"),
        expect.stringContaining("filename is not normalized"),
        expect.stringContaining("missing transaction rollback"),
        expect.stringContaining("committed fixtures are forbidden"),
        expect.stringContaining("missing failure assertion"),
      ]),
    );
  });
});
