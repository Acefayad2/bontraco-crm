import { describe, expect, it } from "vitest";
import {
  backupTables,
  compareRestoreCounts,
  verifyBackupRestore,
} from "../../scripts/backup-restore-verify.mjs";

function completeCounts(value = 1) {
  return Object.fromEntries([...backupTables, "auth.users"].map((table) => [table, value]));
}

describe("backup restore verifier", () => {
  it("accepts an exact critical-table and authentication count match", () => {
    const counts = completeCounts(3);
    expect(compareRestoreCounts(counts, { ...counts })).toEqual({
      matches: true,
      checked: backupTables.length + 1,
      differences: [],
    });
  });

  it("reports count differences without exposing row contents", () => {
    const source = completeCounts(2);
    const restore = completeCounts(2);
    restore.contacts = 1;
    expect(compareRestoreCounts(source, restore)).toMatchObject({
      matches: false,
      differences: [{ key: "contacts", source: 2, restore: 1 }],
    });
  });

  it("rejects an unsafe same-project drill before connecting", async () => {
    await expect(
      verifyBackupRestore({
        SOURCE_SUPABASE_URL: "https://same-project.supabase.co",
        RESTORE_SUPABASE_URL: "https://same-project.supabase.co",
        SOURCE_SUPABASE_SERVICE_ROLE_KEY: "source-secret-that-is-long-enough-123456",
        RESTORE_SUPABASE_SERVICE_ROLE_KEY: "restore-secret-that-is-long-enough-12345",
      }),
    ).rejects.toThrow(/must differ/i);
  });
});
