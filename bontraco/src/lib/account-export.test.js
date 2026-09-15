import { describe, expect, it, vi } from "vitest";
import {
  accountExportSha256,
  readAccountTable,
  readWorkspaceUserIdentities,
  recordAccountExport,
  safeExportFilename,
  safeInvitationColumns,
  serializeAccountExport,
} from "../../netlify/functions/account-export.mjs";
import { accountDataTables } from "../../netlify/functions/_shared/account-data-tables.mjs";

describe("account export filenames", () => {
  it("removes path and punctuation characters", () => {
    expect(safeExportFilename("../Blue Ridge & Sons", new Date("2026-09-09T12:00:00Z"))).toBe(
      "bontraco-blue-ridge-sons-2026-09-09.json",
    );
  });

  it("uses a stable fallback", () => {
    expect(safeExportFilename("***", new Date("2026-09-09T12:00:00Z"))).toBe(
      "bontraco-workspace-2026-09-09.json",
    );
  });
});

describe("account export coverage", () => {
  it("includes durable communication preference history", () => {
    expect(accountDataTables).toEqual(
      expect.arrayContaining(["communication_suppressions", "communication_consents"]),
    );
  });

  it("does not expose invitation credential hashes", () => {
    expect(accountDataTables).not.toContain("invitations");
    expect(safeInvitationColumns).not.toContain("token_digest");
  });

  it("exports only operational invitation fields", async () => {
    const select = vi.fn();
    const query = {
      select: (columns) => {
        select(columns);
        return query;
      },
      eq: () => query,
      range: async () => ({ data: [], error: null }),
    };

    await readAccountTable(
      { from: () => query },
      "invitations",
      "account-id",
      safeInvitationColumns,
    );

    expect(select).toHaveBeenCalledWith(
      "id,email,role,invited_by,expires_at,accepted_at,created_at",
    );
  });

  it("exports only safe identity fields for unique workspace members", async () => {
    const getUserById = vi.fn(async (id) => ({
      data: {
        user: {
          id,
          email: `${id}@example.com`,
          phone: "+13125550123",
          created_at: "2026-09-01T00:00:00.000Z",
          last_sign_in_at: null,
          email_confirmed_at: "2026-09-01T00:05:00.000Z",
          app_metadata: { provider: "email" },
          user_metadata: { private_note: "do not export" },
        },
      },
      error: null,
    }));

    const users = await readWorkspaceUserIdentities({ auth: { admin: { getUserById } } }, [
      { user_id: "owner" },
      { user_id: "staff" },
      { user_id: "owner" },
    ]);

    expect(getUserById).toHaveBeenCalledTimes(2);
    expect(users).toEqual([
      {
        id: "owner",
        email: "owner@example.com",
        created_at: "2026-09-01T00:00:00.000Z",
        last_sign_in_at: null,
        email_confirmed_at: "2026-09-01T00:05:00.000Z",
      },
      {
        id: "staff",
        email: "staff@example.com",
        created_at: "2026-09-01T00:00:00.000Z",
        last_sign_in_at: null,
        email_confirmed_at: "2026-09-01T00:05:00.000Z",
      },
    ]);
  });

  it("fails the export when a workspace identity cannot be read", async () => {
    const getUserById = vi.fn().mockResolvedValue({ data: {}, error: new Error("private detail") });

    await expect(
      readWorkspaceUserIdentities({ auth: { admin: { getUserById } } }, [{ user_id: "owner" }]),
    ).rejects.toThrow("Could not export workspace user identity");
  });
});

describe("account export pagination", () => {
  const page = Array.from({ length: 1000 }, (_, index) => ({ id: `row-${index}` }));

  function client(range) {
    const query = {
      select: () => query,
      eq: () => query,
      range,
    };
    return { from: () => query };
  }

  it("collects every page when the table remains below the safety limit", async () => {
    const range = vi
      .fn()
      .mockResolvedValueOnce({ data: page, error: null })
      .mockResolvedValueOnce({ data: [{ id: "final-row" }], error: null });

    const rows = await readAccountTable(client(range), "leads", "account-id");

    expect(rows).toHaveLength(1001);
    expect(range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(range).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

  it("refuses to issue an incomplete export at the per-table safety limit", async () => {
    const range = vi.fn().mockResolvedValue({ data: page, error: null });

    await expect(readAccountTable(client(range), "leads", "account-id")).rejects.toThrow(
      "Could not safely export more than 50000 leads rows",
    );
    expect(range).toHaveBeenCalledTimes(50);
  });
});

describe("account export audit", () => {
  const exportedAt = new Date("2026-09-12T14:00:00.000Z");

  it("records the completed export before it can be returned", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });

    await expect(
      recordAccountExport(
        { from: () => ({ insert }) },
        "account-id",
        "user-id",
        exportedAt,
        "a".repeat(64),
      ),
    ).resolves.toBeUndefined();
    expect(insert).toHaveBeenCalledWith({
      account_id: "account-id",
      actor_id: "user-id",
      kind: "account_exported",
      summary: "Workspace data export downloaded",
      metadata: {
        exported_at: exportedAt.toISOString(),
        truncated_tables: [],
        sha256: "a".repeat(64),
      },
    });
  });

  it("fails closed when the export audit cannot be persisted", async () => {
    const insert = vi.fn().mockResolvedValue({ error: new Error("private database detail") });

    await expect(
      recordAccountExport(
        { from: () => ({ insert }) },
        "account-id",
        "user-id",
        exportedAt,
        "a".repeat(64),
      ),
    ).rejects.toThrow("Could not record account export");
  });
});

describe("account export response size", () => {
  it("serializes a normal export once for the attachment response", () => {
    const payload = { export_version: 1, data: { leads: [{ id: "lead-id" }] } };

    expect(JSON.parse(serializeAccountExport(payload))).toEqual(payload);
  });

  it("refuses a payload that cannot fit the buffered function response", () => {
    const payload = { data: "é".repeat(2_750_000) };

    expect(() => serializeAccountExport(payload)).toThrow(
      "Account export exceeds the safe response size",
    );
  });

  it("computes a stable SHA-256 for the exact serialized attachment", () => {
    expect(accountExportSha256("Bontraco export\n")).toBe(
      "51e58537a0167300b937446b647273b3a40106edd9b804112732f55a65ddae42",
    );
  });
});
