import { describe, expect, it } from "vitest";
import {
  roleExpectations,
  verifyForeignTargetsHidden,
  verifyRoleSmoke,
} from "../../scripts/role-smoke-verify.mjs";

describe("deployed role smoke verifier", () => {
  it("defines least-privilege visibility for all five roles", () => {
    expect(roleExpectations).toEqual({
      owner: {
        contacts: 3,
        jobs: 3,
        appointments: 3,
        leads: 1,
        suppressions: 3,
        consents: 3,
        foreignIdsHidden: 8,
        integrationStatus: 200,
      },
      admin: {
        contacts: 3,
        jobs: 3,
        appointments: 3,
        leads: 1,
        suppressions: 3,
        consents: 3,
        foreignIdsHidden: 8,
        integrationStatus: 200,
      },
      dispatcher: {
        contacts: 3,
        jobs: 3,
        appointments: 3,
        leads: 1,
        suppressions: 3,
        consents: 3,
        foreignIdsHidden: 8,
        integrationStatus: 403,
      },
      sales: {
        contacts: 1,
        jobs: 1,
        appointments: 1,
        leads: 1,
        suppressions: 1,
        consents: 1,
        foreignIdsHidden: 8,
        integrationStatus: 403,
      },
      field: {
        contacts: 1,
        jobs: 1,
        appointments: 1,
        leads: 0,
        suppressions: 0,
        consents: 0,
        foreignIdsHidden: 8,
        integrationStatus: 403,
      },
    });
  });

  it("rejects any known foreign id returned to an authenticated role", async () => {
    const hiddenClient = {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        }),
      }),
    };
    await expect(
      verifyForeignTargetsHidden(
        hiddenClient,
        { accounts: "foreign-account", contacts: "foreign-contact" },
        "sales",
      ),
    ).resolves.toBe(2);

    const leakingClient = {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: { id: "foreign" }, error: null }) }),
        }),
      }),
    };
    await expect(
      verifyForeignTargetsHidden(leakingClient, { contacts: "foreign-contact" }, "sales"),
    ).rejects.toThrow(/accessed a foreign contacts record/i);
  });

  it("rejects unsafe or malformed verifier input before authentication", async () => {
    await expect(verifyRoleSmoke("bad id", {})).rejects.toThrow(/run id/i);
    await expect(
      verifyRoleSmoke("valid123", {
        VITE_SUPABASE_URL: "http://localhost:54321",
        VITE_SUPABASE_PUBLISHABLE_KEY: "publishable-key-long-enough",
      }),
    ).rejects.toThrow(/HTTPS/i);
  });
});
