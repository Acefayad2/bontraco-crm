import { describe, expect, it } from "vitest";
import {
  normalizePrototypePayload,
  publicPrototypeImportError,
} from "../../netlify/functions/prototype-import.mjs";

describe("prototype CRM import validation", () => {
  it("maps one original client and multiple trade jobs without trusting old assignments", () => {
    const result = normalizePrototypePayload({
      clients: [
        {
          id: "client-1",
          firstName: "Maria",
          lastName: "Torres",
          phone: "630-555-0112",
          address: "101 Main St",
          city: "Naperville",
          zip: "60540",
          repId: "old-rep",
        },
      ],
      jobs: [
        {
          id: "job-1",
          clientId: "client-1",
          trades: {
            roof: { currentStage: "Inspection Complete" },
            gutters: { currentStage: "Material Order" },
          },
          financials: { contractAmount: "$18,500.25" },
        },
      ],
    });

    expect(result.errors).toEqual([]);
    expect(result.targetCounts).toEqual({ contacts: 1, properties: 1, jobs: 2 });
    expect(result.jobs.map((job) => job.trade)).toEqual(["roofing", "general"]);
    expect(result.jobs[0].estimatedValue).toBe(18500.25);
    expect(result.warnings.some((warning) => warning.includes("manual remapping"))).toBe(true);
  });

  it("rejects missing and cross-referenced source ids", () => {
    const result = normalizePrototypePayload({
      clients: [{ firstName: "No id" }],
      jobs: [{ id: "job-2", clientId: "unknown", trades: { roof: {} } }],
    });
    expect(result.errors).toContain("Client 1 is missing an id.");
    expect(result.errors).toContain("Job job-2 references missing client unknown.");
  });

  it("accepts the original API envelope", () => {
    const result = normalizePrototypePayload({
      data: { clients: [{ id: "c1", companyName: "Lakeview HOA" }], jobs: [] },
    });
    expect(result.errors).toEqual([]);
    expect(result.clients[0].firstName).toBe("Lakeview HOA");
  });

  it("does not treat malformed arrays as importable data", () => {
    const result = normalizePrototypePayload({ clients: "not-an-array", jobs: null });
    expect(result.errors).toContain("The file has no clients or jobs.");
  });

  it("does not expose source identifiers or internal failures", () => {
    expect(publicPrototypeImportError()).toBe("Import could not be completed safely");
    expect(publicPrototypeImportError("rollback")).toBe(
      "Import rollback could not be completed safely",
    );
    expect(publicPrototypeImportError()).not.toContain("client-secret-source-id");
  });
});
