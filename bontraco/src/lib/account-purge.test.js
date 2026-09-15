import { describe, expect, it, vi } from "vitest";
import {
  claimPurgeRequest,
  chunkValues,
  privateFilesExportVerified,
  purgeApprovalProblems,
  purgeFailureMessage,
  recordPurgeCompletion,
  recordPurgeFailure,
  recoverStalePurges,
} from "../../netlify/functions/account-purge.mjs";

const approved = {
  status: "approved",
  scheduled_for: "2026-09-01T00:00:00.000Z",
  metadata: {
    export_verified: true,
    export_sha256: "a".repeat(64),
    provider_cleanup_authorized: true,
    approval_ticket: "OPS-1234",
    approved_by: "ops@example.com",
    approved_at: "2026-09-02T00:00:00.000Z",
  },
};

describe("account purge gates", () => {
  it("accepts a due, fully approved request", () => {
    expect(purgeApprovalProblems(approved, new Date("2026-09-09T00:00:00.000Z"))).toEqual([]);
  });

  it("refuses an unverified or premature request", () => {
    const problems = purgeApprovalProblems(
      {
        ...approved,
        scheduled_for: "2026-09-10T00:00:00.000Z",
        metadata: { ...approved.metadata, export_verified: false, approval_ticket: "" },
      },
      new Date("2026-09-09T00:00:00.000Z"),
    );
    expect(problems).toContain("grace_period_not_finished");
    expect(problems).toContain("export_not_verified");
    expect(problems).toContain("approval_ticket_missing");
  });

  it("refuses export verification without a valid artifact checksum", () => {
    const problems = purgeApprovalProblems(
      { ...approved, metadata: { ...approved.metadata, export_sha256: "not-a-checksum" } },
      new Date("2026-09-09T00:00:00.000Z"),
    );

    expect(problems).toContain("export_checksum_invalid");
  });

  it("refuses approval evidence dated before the grace period finished", () => {
    const problems = purgeApprovalProblems(
      {
        ...approved,
        scheduled_for: "2026-09-08T00:00:00.000Z",
        metadata: { ...approved.metadata, approved_at: "2026-09-07T23:59:59.000Z" },
      },
      new Date("2026-09-09T00:00:00.000Z"),
    );

    expect(problems).toContain("approval_timestamp_invalid");
  });

  it("chunks provider cleanup work", () => {
    expect(chunkValues([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("moves only hour-old processing claims to operator review", async () => {
    const query = {
      update: vi.fn(() => query),
      eq: vi.fn(() => query),
      lt: vi.fn(() => query),
      select: vi.fn(async () => ({ data: [{ id: "stale-1" }], error: null })),
    };
    const supabase = { from: vi.fn(() => query) };

    await expect(recoverStalePurges(supabase, new Date("2026-09-12T12:00:00.000Z"))).resolves.toBe(
      1,
    );
    expect(query.update).toHaveBeenCalledWith({
      status: "failed",
      last_error: "Purge worker did not complete; operator review required",
    });
    expect(query.eq).toHaveBeenCalledWith("status", "processing");
    expect(query.lt).toHaveBeenCalledWith("updated_at", "2026-09-12T11:00:00.000Z");
  });

  it("fails the worker safely when stale-claim recovery cannot be recorded", async () => {
    const query = {
      update: () => query,
      eq: () => query,
      lt: () => query,
      select: async () => ({ data: null, error: new Error("private database detail") }),
    };

    await expect(recoverStalePurges({ from: () => query })).rejects.toThrow(
      "Could not recover stale purge claims",
    );
  });

  it("maps purge failures to approved operational categories", () => {
    expect(
      purgeFailureMessage(new Error("Retell cleanup is required but RETELL_API_KEY is missing")),
    ).toBe("Required provider cleanup is not configured; operator review required");
    expect(purgeFailureMessage(new Error("Workspace has more than 200 Retell calls"))).toBe(
      "Workspace exceeds the automated call cleanup limit; manual purge required",
    );
    expect(purgeFailureMessage(new Error("Workspace has more than 1000 files"))).toBe(
      "Workspace exceeds the automated file cleanup limit; manual purge required",
    );
    expect(purgeFailureMessage(new Error("Private file export is required but not verified"))).toBe(
      "Private file export is not verified; operator review required",
    );
  });

  it("requires separate private-file export evidence only when files exist", () => {
    expect(privateFilesExportVerified([], {})).toBe(true);
    expect(privateFilesExportVerified([{ storage_path: "account/file.pdf" }], {})).toBe(false);
    expect(
      privateFilesExportVerified([{ storage_path: "account/file.pdf" }], {
        file_export_verified: true,
      }),
    ).toBe(false);
    expect(
      privateFilesExportVerified([{ storage_path: "account/file.pdf" }], {
        file_export_verified: true,
        file_export_count: 1,
        file_export_manifest_sha256: "b".repeat(64),
      }),
    ).toBe(true);
  });

  it("suppresses unknown database and provider details", () => {
    const message = purgeFailureMessage(
      new Error("relation customer_secret missing; token=provider-secret-42"),
    );
    expect(message).toBe("Account purge could not be completed; operator review required");
    expect(message).not.toMatch(/customer_secret|provider-secret-42/);
  });

  it("fails safely when the sanitized failure state cannot be persisted", async () => {
    const query = {
      update: () => query,
      eq: () => query,
      select: () => query,
      maybeSingle: async () => ({ data: null, error: new Error("private database detail") }),
    };

    await expect(
      recordPurgeFailure(
        { from: () => query },
        "request-id",
        "Account purge could not be completed; operator review required",
      ),
    ).rejects.toThrow("Could not record account purge failure");
  });

  it("rejects a failure transition that matched no processing request", async () => {
    const query = {
      update: () => query,
      eq: () => query,
      select: () => query,
      maybeSingle: async () => ({ data: null, error: null }),
    };

    await expect(
      recordPurgeFailure(
        { from: () => query },
        "request-id",
        "Account purge could not be completed; operator review required",
      ),
    ).rejects.toThrow("Could not record account purge failure");
  });

  it("records completion only when the processing request is still claimable", async () => {
    const update = vi.fn();
    const successfulQuery = {
      update: (value) => {
        update(value);
        return successfulQuery;
      },
      eq: () => successfulQuery,
      select: () => successfulQuery,
      maybeSingle: async () => ({ data: { id: "request-id" }, error: null }),
    };
    const completedAt = new Date("2026-09-12T12:00:00.000Z");

    await expect(
      recordPurgeCompletion({ from: () => successfulQuery }, "request-id", completedAt),
    ).resolves.toBeUndefined();
    expect(update).toHaveBeenCalledWith({
      status: "completed",
      completed_at: completedAt.toISOString(),
      last_error: null,
    });

    const missingQuery = {
      update: () => missingQuery,
      eq: () => missingQuery,
      select: () => missingQuery,
      maybeSingle: async () => ({ data: null, error: null }),
    };
    await expect(
      recordPurgeCompletion({ from: () => missingQuery }, "request-id", completedAt),
    ).rejects.toThrow("Could not record account purge completion");
  });

  it("fails a claimed purge when refreshed approval evidence changed", async () => {
    const claimQuery = {
      update: () => claimQuery,
      eq: () => claimQuery,
      select: () => claimQuery,
      maybeSingle: async () => ({
        data: {
          id: "request-id",
          account_id: "account-id",
          scheduled_for: approved.scheduled_for,
          metadata: { ...approved.metadata, provider_cleanup_authorized: false },
        },
        error: null,
      }),
    };
    const failureUpdate = vi.fn();
    const failureQuery = {
      update: (value) => {
        failureUpdate(value);
        return failureQuery;
      },
      eq: () => failureQuery,
      select: () => failureQuery,
      maybeSingle: async () => ({ data: { id: "request-id" }, error: null }),
    };
    const from = vi.fn().mockReturnValueOnce(claimQuery).mockReturnValueOnce(failureQuery);

    await expect(claimPurgeRequest({ from }, approved)).resolves.toEqual({
      status: "failed",
      problems: ["provider_cleanup_not_authorized"],
    });
    expect(failureUpdate).toHaveBeenCalledWith({
      status: "failed",
      last_error: "Account purge approval changed; operator review required",
    });
  });
});
