import { describe, expect, it } from "vitest";
import { verifyAccountExportIntegrity } from "./account-export-integrity";

const encoded = new TextEncoder().encode("Bontraco export\n");
const bytes = encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength);
const sha256 = "51e58537a0167300b937446b647273b3a40106edd9b804112732f55a65ddae42";

function subtleReturning(digest: string) {
  const result = Uint8Array.from(digest.match(/../g) || [], (pair) => Number.parseInt(pair, 16));
  return { digest: async () => result.buffer } as unknown as SubtleCrypto;
}

describe("account export integrity", () => {
  it("accepts the exact downloaded bytes and server digest", async () => {
    await expect(
      verifyAccountExportIntegrity(bytes, sha256, subtleReturning(sha256)),
    ).resolves.toBe(sha256);
  });

  it("rejects a missing or malformed server digest", async () => {
    await expect(verifyAccountExportIntegrity(bytes, null)).rejects.toThrow(
      "Workspace export integrity check failed",
    );
    await expect(verifyAccountExportIntegrity(bytes, "not-a-checksum")).rejects.toThrow(
      "Workspace export integrity check failed",
    );
  });

  it("rejects bytes that do not match the server digest", async () => {
    const changed = new TextEncoder().encode("Changed export\n").buffer;
    await expect(
      verifyAccountExportIntegrity(changed, sha256, subtleReturning("0".repeat(64))),
    ).rejects.toThrow("Workspace export integrity check failed");
  });
});
